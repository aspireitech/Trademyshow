import {
  AllProvidersFailedError,
  ProviderError,
  type AttemptLog,
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
  type ProviderName,
} from "./types";

export interface RouterOptions {
  /** Retries against the SAME provider for transient errors before failing over. */
  transientRetries?: number;
  /** Base backoff in ms; doubles per retry. */
  backoffBaseMs?: number;
  /** Default cooldown applied to a rate-limited provider with no Retry-After. */
  cooldownMs?: number;
  /** Longest cooldown we will honour from a provider's Retry-After hint. */
  maxCooldownMs?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onAttempt?: (log: AttemptLog) => void;
}

interface ProviderState {
  /** Epoch ms until which the provider is skipped (rate limited). */
  cooldownUntil: number;
  /** Set when credentials are bad — no point retrying this process. */
  disabled: boolean;
  consecutiveFailures: number;
  lastError?: string;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Tries providers in priority order and fails over automatically.
 *
 * Failover rules (see FailureKind):
 *  - rate_limit -> cool the provider down (honouring Retry-After) and move on
 *    immediately. This is the primary case: Gemini hits its quota, the request
 *    is served by Anthropic, and Gemini is skipped entirely until its window
 *    resets rather than being retried on every call.
 *  - transient  -> retry the same provider with exponential backoff, then move on.
 *  - auth       -> disable the provider for this process and move on.
 *  - refusal    -> move on; a different model may answer.
 *  - permanent  -> rethrow. A malformed request fails everywhere, and failing
 *                  over would hide the bug behind a bigger bill.
 */
export class LLMRouter {
  private state = new Map<ProviderName, ProviderState>();
  private readonly opts: Required<Omit<RouterOptions, "onAttempt">> & Pick<RouterOptions, "onAttempt">;

  constructor(
    readonly providers: LLMProvider[],
    options: RouterOptions = {},
  ) {
    this.opts = {
      transientRetries: options.transientRetries ?? 1,
      backoffBaseMs: options.backoffBaseMs ?? 500,
      cooldownMs: options.cooldownMs ?? 60_000,
      maxCooldownMs: options.maxCooldownMs ?? 15 * 60_000,
      sleep: options.sleep ?? defaultSleep,
      now: options.now ?? Date.now,
      onAttempt: options.onAttempt,
    };
    for (const p of providers) {
      this.state.set(p.name, { cooldownUntil: 0, disabled: false, consecutiveFailures: 0 });
    }
  }

  /** Providers that are configured, not disabled, and not cooling down. */
  private eligible(): LLMProvider[] {
    const now = this.opts.now();
    return this.providers.filter((p) => {
      const s = this.state.get(p.name)!;
      return p.isConfigured() && !s.disabled && s.cooldownUntil <= now;
    });
  }

  async complete(req: LLMRequest): Promise<LLMResponse & { attempts: AttemptLog[] }> {
    const attempts: AttemptLog[] = [];
    const failures: { provider: ProviderName; kind: ProviderError["kind"]; message: string }[] = [];

    for (const provider of this.eligible()) {
      const maxTries = this.opts.transientRetries + 1;

      for (let attempt = 0; attempt < maxTries; attempt++) {
        const startedAt = this.opts.now();
        try {
          const res = await provider.complete(req);
          const log: AttemptLog = { provider: provider.name, ok: true, ms: this.opts.now() - startedAt };
          attempts.push(log);
          this.opts.onAttempt?.(log);
          const s = this.state.get(provider.name)!;
          s.consecutiveFailures = 0;
          s.lastError = undefined;
          return { ...res, attempts };
        } catch (raw) {
          const err =
            raw instanceof ProviderError
              ? raw
              : new ProviderError(provider.name, "transient", String(raw), undefined, raw);
          const log: AttemptLog = {
            provider: provider.name,
            ok: false,
            kind: err.kind,
            message: err.message,
            ms: this.opts.now() - startedAt,
          };
          attempts.push(log);
          this.opts.onAttempt?.(log);

          const s = this.state.get(provider.name)!;
          s.consecutiveFailures++;
          s.lastError = err.message;

          // A malformed request will fail on every provider — surface it.
          if (err.kind === "permanent") throw err;

          if (err.kind === "transient" && attempt < maxTries - 1) {
            await this.opts.sleep(this.opts.backoffBaseMs * 2 ** attempt);
            continue; // retry the same provider
          }

          if (err.kind === "rate_limit") {
            const hinted = err.retryAfterSec != null ? err.retryAfterSec * 1000 : this.opts.cooldownMs;
            s.cooldownUntil = this.opts.now() + Math.min(hinted, this.opts.maxCooldownMs);
          } else if (err.kind === "auth") {
            s.disabled = true;
          }

          failures.push({ provider: provider.name, kind: err.kind, message: err.message });
          break; // fail over to the next provider
        }
      }
    }

    // Nothing eligible succeeded — report why, including providers we skipped.
    for (const p of this.providers) {
      if (failures.some((f) => f.provider === p.name)) continue;
      const s = this.state.get(p.name)!;
      if (!p.isConfigured()) {
        failures.push({ provider: p.name, kind: "auth", message: "not configured" });
      } else if (s.disabled) {
        failures.push({ provider: p.name, kind: "auth", message: s.lastError ?? "disabled" });
      } else if (s.cooldownUntil > this.opts.now()) {
        const secs = Math.ceil((s.cooldownUntil - this.opts.now()) / 1000);
        failures.push({ provider: p.name, kind: "rate_limit", message: `cooling down ${secs}s` });
      }
    }
    throw new AllProvidersFailedError(failures);
  }

  /** Snapshot for health checks and the status endpoint. */
  status(): {
    provider: ProviderName;
    model: string;
    configured: boolean;
    available: boolean;
    disabled: boolean;
    cooldownSecondsRemaining: number;
    lastError?: string;
  }[] {
    const now = this.opts.now();
    return this.providers.map((p) => {
      const s = this.state.get(p.name)!;
      const cooling = Math.max(0, s.cooldownUntil - now);
      return {
        provider: p.name,
        model: p.model,
        configured: p.isConfigured(),
        available: p.isConfigured() && !s.disabled && cooling === 0,
        disabled: s.disabled,
        cooldownSecondsRemaining: Math.ceil(cooling / 1000),
        lastError: s.lastError,
      };
    });
  }

  /** Clear cooldowns/disables — used by tests and the manual reset endpoint. */
  reset(): void {
    for (const s of this.state.values()) {
      s.cooldownUntil = 0;
      s.disabled = false;
      s.consecutiveFailures = 0;
      s.lastError = undefined;
    }
  }
}

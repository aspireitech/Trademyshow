export type ProviderName = "gemini" | "anthropic" | "openai";

export interface LLMRequest {
  system: string;
  user: string;
  maxTokens: number;
}

export interface LLMResponse {
  text: string;
  provider: ProviderName;
  model: string;
}

/**
 * How a provider failure should be handled by the router.
 *
 * - `rate_limit`  quota/RPM exhausted. Fail over immediately and put the
 *                 provider in cooldown so we stop hammering it.
 * - `transient`   5xx, overload, network blip. Retry the same provider with
 *                 backoff before failing over.
 * - `auth`        bad or missing key / permission. Disable the provider for
 *                 the process — retrying cannot help.
 * - `refusal`     the model declined this specific content. Fail over: a
 *                 different provider may answer it.
 * - `permanent`   malformed request. Do NOT fail over — every provider will
 *                 reject it, and failing over hides the bug.
 */
export type FailureKind = "rate_limit" | "transient" | "auth" | "refusal" | "permanent";

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly kind: FailureKind,
    message: string,
    /** Seconds to wait before retrying, when the provider tells us. */
    readonly retryAfterSec?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class AllProvidersFailedError extends Error {
  constructor(readonly failures: { provider: ProviderName; kind: FailureKind; message: string }[]) {
    super(
      `all LLM providers failed: ${failures.map((f) => `${f.provider}(${f.kind})`).join(", ") || "none configured"}`,
    );
    this.name = "AllProvidersFailedError";
  }
}

export interface LLMProvider {
  readonly name: ProviderName;
  readonly model: string;
  /** True when the provider has the credentials it needs to be attempted. */
  isConfigured(): boolean;
  complete(req: LLMRequest): Promise<LLMResponse>;
}

/** Diagnostics surfaced by the router for logging and the /api/llm/status route. */
export interface AttemptLog {
  provider: ProviderName;
  ok: boolean;
  kind?: FailureKind;
  message?: string;
  ms: number;
}

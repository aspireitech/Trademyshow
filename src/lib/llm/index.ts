import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { LLMRouter } from "./router";
import type { LLMProvider, ProviderName } from "./types";

export * from "./types";
export { LLMRouter } from "./router";

const FACTORIES: Record<ProviderName, () => LLMProvider> = {
  gemini: () => new GeminiProvider(),
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
};

const DEFAULT_ORDER: ProviderName[] = ["gemini", "anthropic", "openai"];

/**
 * Build the provider chain from LLM_PROVIDER_ORDER (comma-separated).
 * Defaults to gemini -> anthropic -> openai: Gemini primary, the other two
 * as automatic backups when Gemini is rate limited or unavailable.
 */
export function providerOrder(): ProviderName[] {
  const raw = process.env.LLM_PROVIDER_ORDER;
  if (!raw) return DEFAULT_ORDER;
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderName => s in FACTORIES);
  return parsed.length > 0 ? parsed : DEFAULT_ORDER;
}

let router: LLMRouter | null = null;

/**
 * Process-wide router. Shared deliberately: cooldown state is only useful if
 * every request sees the same "Gemini is rate limited until X" knowledge.
 */
export function getRouter(): LLMRouter {
  if (!router) {
    router = new LLMRouter(
      providerOrder().map((name) => FACTORIES[name]()),
      {
        transientRetries: Number(process.env.LLM_TRANSIENT_RETRIES ?? 1),
        cooldownMs: Number(process.env.LLM_COOLDOWN_MS ?? 60_000),
        onAttempt: (log) => {
          if (log.ok) {
            console.info(`[llm] ${log.provider} ok in ${log.ms}ms`);
          } else {
            console.warn(`[llm] ${log.provider} failed (${log.kind}) in ${log.ms}ms: ${log.message}`);
          }
        },
      },
    );
  }
  return router;
}

/** Test hook: drop the cached router so env changes take effect. */
export function resetRouterForTests(): void {
  router = null;
}

/** True when at least one provider has credentials. */
export function anyProviderConfigured(): boolean {
  return getRouter().providers.some((p) => p.isConfigured());
}

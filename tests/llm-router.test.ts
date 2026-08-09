import { beforeEach, describe, expect, it, vi } from "vitest";
import { classify } from "@/lib/llm/errors";
import { LLMRouter } from "@/lib/llm/router";
import {
  AllProvidersFailedError,
  ProviderError,
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
  type ProviderName,
} from "@/lib/llm/types";

const REQ: LLMRequest = { system: "sys", user: "usr", maxTokens: 100 };

/** Scriptable fake provider: each call shifts the next scripted outcome. */
function fake(
  name: ProviderName,
  script: (ProviderError | "ok" | Error)[],
  configured = true,
): LLMProvider & { calls: number } {
  const p = {
    name,
    model: `${name}-test`,
    calls: 0,
    isConfigured: () => configured,
    async complete(): Promise<LLMResponse> {
      const outcome = script[Math.min(p.calls, script.length - 1)];
      p.calls++;
      if (outcome === "ok") return { text: `hello from ${name}`, provider: name, model: p.model };
      throw outcome;
    },
  };
  return p;
}

const rateLimit = (n: ProviderName, retryAfterSec?: number) =>
  new ProviderError(n, "rate_limit", "quota exceeded", retryAfterSec);

// Deterministic clock so cooldown windows are testable without real waiting.
let clock = 1_000_000;
const now = () => clock;
const sleep = vi.fn(async () => {});

function router(providers: LLMProvider[], opts = {}) {
  return new LLMRouter(providers, { now, sleep, backoffBaseMs: 1, ...opts });
}

beforeEach(() => {
  clock = 1_000_000;
  sleep.mockClear();
});

describe("failover on rate limit (the primary use case)", () => {
  it("switches to the backup when the primary is rate limited", async () => {
    const gemini = fake("gemini", [rateLimit("gemini")]);
    const anthropic = fake("anthropic", ["ok"]);
    const r = router([gemini, anthropic]);

    const res = await r.complete(REQ);
    expect(res.provider).toBe("anthropic");
    expect(res.text).toContain("anthropic");
    expect(gemini.calls).toBe(1);
  });

  it("cascades through all three providers", async () => {
    const gemini = fake("gemini", [rateLimit("gemini")]);
    const anthropic = fake("anthropic", [rateLimit("anthropic")]);
    const openai = fake("openai", ["ok"]);
    const r = router([gemini, anthropic, openai]);

    const res = await r.complete(REQ);
    expect(res.provider).toBe("openai");
    expect(res.attempts.map((a) => a.provider)).toEqual(["gemini", "anthropic", "openai"]);
  });

  it("skips a cooling-down provider on subsequent calls instead of re-hitting it", async () => {
    const gemini = fake("gemini", [rateLimit("gemini")]);
    const anthropic = fake("anthropic", ["ok"]);
    const r = router([gemini, anthropic], { cooldownMs: 60_000 });

    await r.complete(REQ);
    await r.complete(REQ);
    await r.complete(REQ);

    // Gemini was tried once, then skipped while cooling down.
    expect(gemini.calls).toBe(1);
    expect(anthropic.calls).toBe(3);
  });

  it("returns to the primary once its cooldown expires", async () => {
    const gemini = fake("gemini", [rateLimit("gemini"), "ok"]);
    const anthropic = fake("anthropic", ["ok"]);
    const r = router([gemini, anthropic], { cooldownMs: 60_000 });

    expect((await r.complete(REQ)).provider).toBe("anthropic");
    clock += 61_000; // cooldown window passes
    expect((await r.complete(REQ)).provider).toBe("gemini");
  });

  it("honours a Retry-After hint over the default cooldown", async () => {
    const gemini = fake("gemini", [rateLimit("gemini", 5), "ok"]);
    const anthropic = fake("anthropic", ["ok"]);
    const r = router([gemini, anthropic], { cooldownMs: 60_000 });

    await r.complete(REQ);
    clock += 6_000; // past the 5s hint, well short of the 60s default
    expect((await r.complete(REQ)).provider).toBe("gemini");
  });

  it("caps an absurd Retry-After at maxCooldownMs", async () => {
    const gemini = fake("gemini", [rateLimit("gemini", 86_400), "ok"]);
    const anthropic = fake("anthropic", ["ok"]);
    const r = router([gemini, anthropic], { maxCooldownMs: 10_000 });

    await r.complete(REQ);
    clock += 11_000;
    expect((await r.complete(REQ)).provider).toBe("gemini");
  });
});

describe("other failure kinds", () => {
  it("retries the same provider on a transient error before failing over", async () => {
    const gemini = fake("gemini", [new ProviderError("gemini", "transient", "503"), "ok"]);
    const anthropic = fake("anthropic", ["ok"]);
    const r = router([gemini, anthropic], { transientRetries: 1 });

    const res = await r.complete(REQ);
    expect(res.provider).toBe("gemini"); // recovered on retry
    expect(gemini.calls).toBe(2);
    expect(anthropic.calls).toBe(0);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("fails over after transient retries are exhausted", async () => {
    const gemini = fake("gemini", [new ProviderError("gemini", "transient", "503")]);
    const anthropic = fake("anthropic", ["ok"]);
    const r = router([gemini, anthropic], { transientRetries: 2 });

    expect((await r.complete(REQ)).provider).toBe("anthropic");
    expect(gemini.calls).toBe(3); // initial + 2 retries
  });

  it("disables a provider permanently on an auth error", async () => {
    const gemini = fake("gemini", [new ProviderError("gemini", "auth", "bad key")]);
    const anthropic = fake("anthropic", ["ok"]);
    const r = router([gemini, anthropic]);

    await r.complete(REQ);
    await r.complete(REQ);
    expect(gemini.calls).toBe(1); // never retried
    expect(r.status().find((s) => s.provider === "gemini")?.disabled).toBe(true);
  });

  it("fails over on a refusal", async () => {
    const gemini = fake("gemini", [new ProviderError("gemini", "refusal", "declined")]);
    const anthropic = fake("anthropic", ["ok"]);
    expect((await router([gemini, anthropic]).complete(REQ)).provider).toBe("anthropic");
  });

  it("does NOT fail over on a permanent error — it surfaces the bug", async () => {
    const gemini = fake("gemini", [new ProviderError("gemini", "permanent", "bad request")]);
    const anthropic = fake("anthropic", ["ok"]);
    const r = router([gemini, anthropic]);

    await expect(r.complete(REQ)).rejects.toThrow(ProviderError);
    expect(anthropic.calls).toBe(0);
  });

  it("skips unconfigured providers entirely", async () => {
    const gemini = fake("gemini", ["ok"], false);
    const anthropic = fake("anthropic", ["ok"]);
    expect((await router([gemini, anthropic]).complete(REQ)).provider).toBe("anthropic");
    expect(gemini.calls).toBe(0);
  });

  it("throws AllProvidersFailedError with per-provider reasons", async () => {
    const gemini = fake("gemini", [rateLimit("gemini")]);
    const anthropic = fake("anthropic", [new ProviderError("anthropic", "auth", "no key")]);
    const openai = fake("openai", ["ok"], false);
    const r = router([gemini, anthropic, openai]);

    await expect(r.complete(REQ)).rejects.toThrow(AllProvidersFailedError);
    try {
      await r.complete(REQ);
    } catch (e) {
      const err = e as AllProvidersFailedError;
      expect(err.failures.map((f) => f.provider).sort()).toEqual(["anthropic", "gemini", "openai"]);
    }
  });

  it("wraps non-ProviderError throws rather than crashing the router", async () => {
    const gemini = fake("gemini", [new Error("kaboom")]);
    const anthropic = fake("anthropic", ["ok"]);
    expect((await router([gemini, anthropic]).complete(REQ)).provider).toBe("anthropic");
  });
});

describe("status reporting", () => {
  it("reports availability, cooldown and last error", async () => {
    const gemini = fake("gemini", [rateLimit("gemini", 30)]);
    const anthropic = fake("anthropic", ["ok"]);
    const r = router([gemini, anthropic]);
    await r.complete(REQ);

    const [g, a] = r.status();
    expect(g.available).toBe(false);
    expect(g.cooldownSecondsRemaining).toBe(30);
    expect(g.lastError).toContain("quota");
    expect(a.available).toBe(true);
  });

  it("reset() clears cooldowns and disables", async () => {
    const gemini = fake("gemini", [rateLimit("gemini"), "ok"]);
    const r = router([gemini, fake("anthropic", ["ok"])]);
    await r.complete(REQ);
    r.reset();
    expect((await r.complete(REQ)).provider).toBe("gemini");
  });
});

describe("cross-SDK error classification", () => {
  it("classifies HTTP status codes", () => {
    expect(classify("gemini", { status: 429 }).kind).toBe("rate_limit");
    expect(classify("openai", { status: 401 }).kind).toBe("auth");
    expect(classify("anthropic", { status: 500 }).kind).toBe("transient");
    expect(classify("anthropic", { status: 529 }).kind).toBe("transient");
    expect(classify("openai", { status: 400 }).kind).toBe("permanent");
  });

  it("reads nested status shapes", () => {
    expect(classify("gemini", { error: { code: 429 } }).kind).toBe("rate_limit");
    expect(classify("openai", { response: { status: 429 } }).kind).toBe("rate_limit");
  });

  it("classifies provider-specific quota wording without a status code", () => {
    expect(classify("gemini", new Error("RESOURCE_EXHAUSTED")).kind).toBe("rate_limit");
    expect(classify("openai", new Error("insufficient_quota")).kind).toBe("rate_limit");
    expect(classify("anthropic", new Error("Overloaded")).kind).toBe("rate_limit");
    expect(classify("gemini", new Error("API key not valid")).kind).toBe("auth");
    expect(classify("openai", new Error("socket hang up")).kind).toBe("transient");
  });

  it("treats a Google 403 quota message as rate limiting, not auth", () => {
    expect(classify("gemini", { status: 403, message: "Quota exceeded for quota metric" }).kind).toBe(
      "rate_limit",
    );
    expect(classify("gemini", { status: 403, message: "permission denied" }).kind).toBe("auth");
  });

  it("extracts Retry-After from headers and message bodies", () => {
    expect(classify("openai", { status: 429, headers: { "retry-after": "42" } }).retryAfterSec).toBe(42);
    expect(classify("gemini", new Error('{"retryDelay":"37s"}')).retryAfterSec).toBe(37);
  });

  it("defaults unknown failures to transient so the request still has a chance", () => {
    expect(classify("gemini", new Error("something weird")).kind).toBe("transient");
  });
});

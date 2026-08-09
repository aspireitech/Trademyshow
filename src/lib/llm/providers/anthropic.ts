import Anthropic from "@anthropic-ai/sdk";
import { classify } from "../errors";
import { ProviderError, type LLMProvider, type LLMRequest, type LLMResponse } from "../types";

/** Backup provider: Anthropic Claude. */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  readonly model: string;
  private client: Anthropic | null = null;

  constructor(model = process.env.ANTHROPIC_MODEL ?? "claude-opus-5") {
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ProviderError(this.name, "auth", "ANTHROPIC_API_KEY is not set");
    }
    this.client ??= new Anthropic();

    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      });

      // Safety classifiers can decline with HTTP 200 — check before reading content.
      if (res.stop_reason === "refusal") {
        throw new ProviderError(this.name, "refusal", "Claude declined the request");
      }

      let text = "";
      for (const block of res.content) {
        if (block.type === "text") text += block.text;
      }
      if (!text.trim()) {
        throw new ProviderError(this.name, "refusal", "Claude returned no text");
      }
      return { text, provider: this.name, model: this.model };
    } catch (err) {
      throw classify(this.name, err);
    }
  }
}

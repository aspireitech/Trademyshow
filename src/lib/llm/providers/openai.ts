import OpenAI from "openai";
import { classify } from "../errors";
import { ProviderError, type LLMProvider, type LLMRequest, type LLMResponse } from "../types";

/** Second backup: OpenAI. */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  readonly model: string;
  private client: OpenAI | null = null;

  constructor(model = process.env.OPENAI_MODEL ?? "gpt-4o") {
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    if (!process.env.OPENAI_API_KEY) {
      throw new ProviderError(this.name, "auth", "OPENAI_API_KEY is not set");
    }
    this.client ??= new OpenAI();

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: req.maxTokens,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
      });

      const choice = res.choices[0];
      if (choice?.finish_reason === "content_filter") {
        throw new ProviderError(this.name, "refusal", "OpenAI content filter blocked the response");
      }
      const text = choice?.message?.content ?? "";
      if (!text.trim()) {
        throw new ProviderError(this.name, "refusal", "OpenAI returned no text");
      }
      return { text, provider: this.name, model: this.model };
    } catch (err) {
      throw classify(this.name, err);
    }
  }
}

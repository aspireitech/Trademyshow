import { GoogleGenAI } from "@google/genai";
import { classify } from "../errors";
import { ProviderError, type LLMProvider, type LLMRequest, type LLMResponse } from "../types";

/** Primary provider: Google Gemini. */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini" as const;
  readonly model: string;
  private client: GoogleGenAI | null = null;

  constructor(model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash") {
    this.model = model;
  }

  private apiKey(): string | undefined {
    return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const apiKey = this.apiKey();
    if (!apiKey) throw new ProviderError(this.name, "auth", "GEMINI_API_KEY is not set");
    this.client ??= new GoogleGenAI({ apiKey });

    try {
      const res = await this.client.models.generateContent({
        model: this.model,
        contents: req.user,
        config: {
          systemInstruction: req.system,
          maxOutputTokens: req.maxTokens,
        },
      });

      const text = res.text ?? "";
      if (!text.trim()) {
        // Empty output usually means a safety block or a truncated response;
        // treat as a refusal so the router tries the next provider.
        throw new ProviderError(this.name, "refusal", "Gemini returned no text");
      }
      return { text, provider: this.name, model: this.model };
    } catch (err) {
      throw classify(this.name, err);
    }
  }
}

import { z } from 'zod';
import { AIProvider, GenerationOptions } from '../types.js';

export class OpenAIProvider implements AIProvider {
  readonly name: string = 'openai';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(apiKey?: string, baseUrl?: string, defaultModel?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.defaultModel = defaultModel || 'gpt-4o-mini';
  }

  private checkKey() {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment or .env');
    }
  }

  async generateText(prompt: string, options?: GenerationOptions): Promise<string> {
    this.checkKey();
    const model = options?.model || this.defaultModel;

    const messages = [];
    if (options?.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error [${response.status}]: ${err}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content || '';
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: GenerationOptions
  ): Promise<T> {
    this.checkKey();
    const model = options?.model || this.defaultModel;

    const systemInstruction = `${options?.systemInstruction || ''}\nReturn ONLY valid JSON strictly matching the schema. No markdown formatting.`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: options?.temperature ?? 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error [${response.status}]: ${err}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(raw);
      return schema.parse(parsed);
    } catch (err) {
      throw new Error(`Failed to parse OpenAI JSON output: ${String(err)}. Output: ${raw}`);
    }
  }

  async embed(text: string): Promise<number[]> {
    this.checkKey();
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Embedding error: ${err}`);
    }

    const data = (await response.json()) as { data?: { embedding?: number[] }[] };
    return data.data?.[0]?.embedding || [];
  }
}

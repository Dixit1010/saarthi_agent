import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { AIProvider, GenerationOptions } from '../types.js';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private client: GoogleGenAI | null = null;
  private defaultModel = 'gemini-2.5-flash';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.client = new GoogleGenAI({ apiKey: key });
    }
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        throw new Error(
          'GEMINI_API_KEY is not configured. Please provide a valid Gemini API key in your environment or .env file.'
        );
      }
      this.client = new GoogleGenAI({ apiKey: key });
    }
    return this.client;
  }

  async generateText(prompt: string, options?: GenerationOptions): Promise<string> {
    const client = this.getClient();
    const model = options?.model || this.defaultModel;

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: options?.systemInstruction,
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens,
      },
    });

    return response.text || '';
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: GenerationOptions
  ): Promise<T> {
    const client = this.getClient();
    const model = options?.model || this.defaultModel;

    const systemInstruction = `${options?.systemInstruction || ''}\nYou MUST return ONLY valid JSON matching the requested structure without any markdown formatting or commentary.`;

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: options?.temperature ?? 0.1,
      },
    });

    const raw = response.text || '{}';
    try {
      const parsed = JSON.parse(raw);
      return schema.parse(parsed);
    } catch (err) {
      throw new Error(`Failed to parse structured AI output into expected schema: ${String(err)}. Raw output: ${raw}`);
    }
  }

  async embed(text: string): Promise<number[]> {
    const client = this.getClient();
    const response = await client.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });

    return (response.embeddings?.[0]?.values as number[]) || [];
  }
}

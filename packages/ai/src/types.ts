import { z } from 'zod';

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
  model?: string;
}

export interface AIProvider {
  readonly name: string;

  /**
   * Generates unstructured natural language text based on prompt.
   */
  generateText(prompt: string, options?: GenerationOptions): Promise<string>;

  /**
   * Generates structured output validated against a Zod schema.
   */
  generateStructured<T>(prompt: string, schema: z.ZodSchema<T>, options?: GenerationOptions): Promise<T>;

  /**
   * Generates a vector embedding for the input text.
   */
  embed(text: string): Promise<number[]>;
}

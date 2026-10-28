import { AIProvider } from './types.js';
import { GeminiProvider } from './providers/gemini.js';
import { OpenAIProvider } from './providers/openai.js';
import { GroqProvider } from './providers/groq.js';

export function createAIProvider(providerName?: string): AIProvider {
  const provider = (providerName || process.env.AI_PROVIDER || 'gemini').toLowerCase();

  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'groq':
      return new GroqProvider();
    case 'gemini':
    default:
      return new GeminiProvider();
  }
}

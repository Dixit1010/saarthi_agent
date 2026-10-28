import { OpenAIProvider } from './openai.js';

export class GroqProvider extends OpenAIProvider {
  override readonly name = 'groq';

  constructor(apiKey?: string, defaultModel?: string) {
    const key = apiKey || process.env.GROQ_API_KEY || '';
    super(key, 'https://api.groq.com/openai/v1', defaultModel || 'openai/gpt-oss-120b');
  }
}

import mammoth from 'mammoth';
import { ExtractedDocument } from './pdfParser.js';

export async function parseDocxBuffer(buffer: Buffer): Promise<ExtractedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value.trim(),
    metadata: {
      messages: result.messages,
    },
  };
}

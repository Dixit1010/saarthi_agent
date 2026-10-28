import pdfParse from 'pdf-parse';

export interface ExtractedDocument {
  text: string;
  pageCount?: number;
  metadata?: Record<string, unknown>;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ExtractedDocument> {
  const data = await pdfParse(buffer);
  return {
    text: data.text.trim(),
    pageCount: data.numpages,
    metadata: data.info || {},
  };
}

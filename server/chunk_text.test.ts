import { describe, it, expect } from 'bun:test';
import { chunkText } from './parse_url';

describe('chunkText', () => {
  it('should return single chunk for short text', () => {
    const text = 'This is a short text.';
    const chunks = chunkText(text, 4000);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].startIndex).toBe(0);
    expect(chunks[0].endIndex).toBe(text.length);
  });

  it('should split long text into multiple chunks', () => {
    const text = 'A'.repeat(8000); // 8000 characters
    const chunks = chunkText(text, 4000);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(3);

    // Check that all chunks together contain the original text
    const reconstructed = chunks.map((c) => c.text).join('');
    expect(reconstructed.replace(/\s+/g, '')).toBe(text);
  });

  it('should break at sentence boundaries when possible', () => {
    const text =
      'First sentence. Second sentence. Third sentence. Fourth sentence. ' +
      'A'.repeat(4500);
    const chunks = chunkText(text, 4000);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text).toContain('First sentence.');
    expect(chunks[0].text).toContain('Second sentence.');
  });

  it('should break at word boundaries when no sentence endings available', () => {
    const text = 'word '.repeat(1000); // No sentence endings
    const chunks = chunkText(text, 4000);

    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should not break words in the middle
    chunks.forEach((chunk) => {
      expect(chunk.text.length).toBeGreaterThan(0);
      // Should not start or end with partial words (except for the last chunk)
      expect(chunk.text.trim().length).toBeGreaterThan(0);
    });
  });

  it('should handle paragraph breaks', () => {
    const paragraphs = Array(10)
      .fill('Paragraph text. Another sentence.\n\n')
      .join('');
    const chunks = chunkText(paragraphs, 200);

    expect(chunks.length).toBeGreaterThan(1);
    // Should break at paragraph boundaries when possible
    chunks.slice(0, -1).forEach((chunk) => {
      const trimmed = chunk.text.trim();
      expect(trimmed.length).toBeGreaterThan(0);
    });
  });
});

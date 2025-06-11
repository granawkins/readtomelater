import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface ParsedArticle {
  title: string;
  body: string;
}

export interface TextChunk {
  text: string;
  startIndex: number;
  endIndex: number;
}

export async function parse_url(url: string): Promise<ParsedArticle> {
  // Fetch the HTML content
  const response = await fetch(url);
  const html = await response.text();

  // Parse with JSDOM
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  // Extract readable content with Readability
  const reader = new Readability(document);
  const article = reader.parse();

  if (!article) {
    throw new Error('Could not parse article');
  }

  return {
    title: article.title || 'No title found',
    body: article.textContent || 'No content extracted',
  };
}

export function chunkText(
  text: string,
  maxChunkSize: number = 4000
): TextChunk[] {
  if (text.length <= maxChunkSize) {
    return [{ text, startIndex: 0, endIndex: text.length }];
  }

  const chunks: TextChunk[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    let endIndex = Math.min(currentIndex + maxChunkSize, text.length);

    // If we're not at the end of the text, try to find a good breaking point
    if (endIndex < text.length) {
      // Look for sentence endings within the last 200 characters
      const searchStart = Math.max(endIndex - 200, currentIndex);
      const chunk = text.slice(searchStart, endIndex);

      // Look for sentence endings (., !, ?) followed by space or end
      const sentenceEndMatch = chunk.match(/[.!?]\s+/g);
      if (sentenceEndMatch) {
        const lastSentenceEnd = chunk.lastIndexOf(
          sentenceEndMatch[sentenceEndMatch.length - 1]
        );
        if (lastSentenceEnd > 0) {
          endIndex =
            searchStart +
            lastSentenceEnd +
            sentenceEndMatch[sentenceEndMatch.length - 1].length;
        }
      } else {
        // If no sentence ending, look for paragraph breaks
        const paragraphMatch = chunk.match(/\n\s*\n/g);
        if (paragraphMatch) {
          const lastParagraphBreak = chunk.lastIndexOf(
            paragraphMatch[paragraphMatch.length - 1]
          );
          if (lastParagraphBreak > 0) {
            endIndex =
              searchStart +
              lastParagraphBreak +
              paragraphMatch[paragraphMatch.length - 1].length;
          }
        } else {
          // Finally, try to break at word boundaries
          const wordMatch = chunk.match(/\s+/g);
          if (wordMatch) {
            const lastSpace = chunk.lastIndexOf(
              wordMatch[wordMatch.length - 1]
            );
            if (lastSpace > 0) {
              endIndex =
                searchStart +
                lastSpace +
                wordMatch[wordMatch.length - 1].length;
            }
          }
        }
      }
    }

    const chunkText = text.slice(currentIndex, endIndex).trim();
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        startIndex: currentIndex,
        endIndex: endIndex,
      });
    }

    currentIndex = endIndex;
  }

  return chunks;
}

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface ParsedArticle {
  title: string;
  body: string;
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

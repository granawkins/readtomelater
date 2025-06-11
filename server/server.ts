import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/') {
      return new Response('Hello World');
    }

    if (url.pathname === '/api/readability' && req.method === 'POST') {
      try {
        const body = await req.json();
        const targetUrl = body.url;

        if (!targetUrl) {
          return new Response(JSON.stringify({ error: 'URL is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Fetch the HTML content
        const response = await fetch(targetUrl);
        const html = await response.text();

        // Parse with JSDOM
        const dom = new JSDOM(html, { url: targetUrl });
        const document = dom.window.document;

        // Extract readable content with Readability
        const reader = new Readability(document);
        const article = reader.parse();

        if (!article) {
          return new Response(JSON.stringify({ error: 'Could not parse article' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          title: article.title,
          content: article.textContent,
          excerpt: article.excerpt,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to process URL' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);

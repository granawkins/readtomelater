import { parse_url } from './parse_url';

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

        const result = await parse_url(targetUrl);

        return new Response(JSON.stringify({
          title: result.title,
          content: result.body,
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

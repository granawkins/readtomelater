import { parse_url } from './parse_url';
import { generate_audio } from './generate_audio';
import { openaiLogger } from './openai_logger';

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/') {
      return new Response('Hello World');
    }

    if (url.pathname === '/api/readtome' && req.method === 'POST') {
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
        // Generate audio for the full text, chunked appropriately
        const audioResult = await generate_audio(result.body, {
          audioDir: './audio',
        });

        return new Response(
          JSON.stringify({
            title: result.title,
            content: result.body,
            audioHash: audioResult.hash,
            segments: audioResult.segments,
            totalSegments: audioResult.totalSegments,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: `Failed to process URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Get OpenAI usage stats
    if (url.pathname === '/api/stats' && req.method === 'GET') {
      try {
        const stats = await openaiLogger.getSummaryStats();
        return new Response(JSON.stringify(stats), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to get stats' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Serve audio segment files
    if (
      url.pathname.startsWith('/api/audio/segment/') &&
      req.method === 'GET'
    ) {
      const filename = url.pathname.replace('/api/audio/segment/', '');
      const audioPath = `./audio/${filename}`;

      try {
        const file = Bun.file(audioPath);
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Disposition': `inline; filename="${filename}"`,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=31536000',
            },
          });
        } else {
          return new Response('Audio segment not found', { status: 404 });
        }
      } catch {
        return new Response('Error serving audio segment', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);

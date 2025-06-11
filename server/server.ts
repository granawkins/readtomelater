import { parse_url } from './parse_url';
import { generate_audio } from './generate_audio';
import { openaiLogger } from './openai_logger';

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    console.log(`Request: ${req.method} ${url.pathname}`);

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

        // For testing without OpenAI API key, return mock data
        if (!process.env.OPENAI_API_KEY) {
          console.log('No OpenAI API key, returning mock data for testing');
          return new Response(
            JSON.stringify({
              title: 'Test Article',
              content:
                'This is a test article for debugging the streaming audio player.',
              audioHash: 'test-hash',
              segments: [
                {
                  segmentPath: '/api/audio/segment/test.mp3',
                  segmentNumber: 0,
                  hash: 'test-hash-0',
                  fileExists: true,
                },
              ],
              totalSegments: 1,
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            }
          );
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
      (req.method === 'GET' || req.method === 'HEAD')
    ) {
      const filename = url.pathname.replace('/api/audio/segment/', '');
      const audioPath = `./audio/${filename}`;

      console.log(`Serving audio segment: ${filename}, path: ${audioPath}`);

      try {
        const file = Bun.file(audioPath);
        const exists = await file.exists();
        console.log(`File exists: ${exists}`);

        if (exists) {
          return new Response(file, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Disposition': `inline; filename="${filename}"`,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=31536000',
            },
          });
        } else {
          console.log(`File not found: ${audioPath}`);
          return new Response('Audio segment not found', { status: 404 });
        }
      } catch (error) {
        console.error(`Error serving audio segment: ${error}`);
        return new Response('Error serving audio segment', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);

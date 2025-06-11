import { parse_url } from './parse_url';
import { generate_audio } from './generate_audio';

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
        const audioResult = await generate_audio(result.body, {
          audioDir: './audio',
        });

        // Convert chunks to frontend format
        const audioChunks = audioResult.chunks.map((chunk) => ({
          audioPath: `/api/audio/${chunk.hash}.mp3`,
          hash: chunk.hash,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
        }));

        return new Response(
          JSON.stringify({
            title: result.title,
            content: result.body,
            audioChunks,
            totalChunks: audioResult.totalChunks,
            totalLength: audioResult.totalLength,
            // Keep legacy fields for now
            audioPath: audioChunks[0]?.audioPath || '',
            audioHash: audioChunks[0]?.hash || '',
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

    // Serve audio files
    if (url.pathname.startsWith('/api/audio/') && req.method === 'GET') {
      const filename = url.pathname.replace('/api/audio/', '');
      const audioPath = `./audio/${filename}`;

      try {
        const file = Bun.file(audioPath);
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Disposition': `inline; filename="${filename}"`,
            },
          });
        } else {
          return new Response('Audio file not found', { status: 404 });
        }
      } catch {
        return new Response('Error serving audio file', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);

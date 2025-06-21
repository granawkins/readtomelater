import { getAllContent, getContent } from './database.js';
import { processUrl } from './processing.js';

const server = Bun.serve({
  port: 3000,
  hostname: '0.0.0.0',
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/') {
      return new Response(Bun.file('index.html'));
    }

    if (url.pathname === '/api/add-article') {
      const { url: sourceUrl } = await req.json();
      
      try {
        const item = await processUrl(sourceUrl);
        return new Response(JSON.stringify(item), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error adding article:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/content') {
      try {
        const content = getAllContent();
        return new Response(JSON.stringify(content), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error fetching content:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname.startsWith(`/api/stream`)) {
        const id = url.searchParams.get('id');
        const content = getContent(id);        
        const file = Bun.file(content.content_url);
        const fileSize = Number(await file.size);
        
        // Get range header if present
        const rangeHeader = req.headers.get('range');
        let start = 0;
        let end = fileSize - 1;
        
        if (rangeHeader) {
            const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            if (matches) {
                start = Number(matches[1]);
                if (matches[2]) {
                    end = Number(matches[2]);
                }
            }
        }
        
        // Ensure end doesn't exceed file size
        end = Math.min(end, fileSize - 1);
        const chunkSize = end - start + 1;
        
        console.log(`Streaming from ${start} to ${end}, chunk size: ${chunkSize}`);
        
        // Create a readable stream from the file
        const fileStream = await file.arrayBuffer();
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(fileStream.slice(start, end + 1));
                controller.close();
            }
        });
        
        const headers = {
            'Content-Type': 'audio/mpeg',
            'Content-Length': chunkSize.toString(),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes'
        };
        
        // If this is a range request, send 206 Partial Content
        const status = rangeHeader ? 206 : 200;
        
        return new Response(stream, {
            status,
            headers
        });
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running at http://0.0.0.0:${server.port}`);

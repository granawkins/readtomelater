import { getAllContent, getContent, updateSecondsListened } from './database.js';
import { processUrl } from './processing.js';
import { registerUser, loginUser, verifyEmailToken, forgotPassword, resetPassword, authMiddleware } from './auth.js';

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/') {
      return new Response(Bun.file('index.html'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Auth endpoints
    if (url.pathname === '/auth/register') {
      const { email, password } = await req.json();
      try {
        const result = await registerUser(email, password);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/auth/login') {
      const { email, password } = await req.json();
      try {
        const result = await loginUser(email, password);
        const response = new Response(JSON.stringify({ user: result.user }), {
          headers: { 'Content-Type': 'application/json' }
        });
        response.headers.set('Set-Cookie', `auth=${result.token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}`);
        return response;
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/auth/verify') {
      const token = url.searchParams.get('token');
      try {
        const result = await verifyEmailToken(token);
        const response = new Response(`
          <html><body>
            <h1>Email verified successfully!</h1>
            <p>You can now close this tab and return to the app.</p>
            <script>window.close();</script>
          </body></html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
        response.headers.set('Set-Cookie', `auth=${result.token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}`);
        return response;
      } catch (error) {
        return new Response(`
          <html><body>
            <h1>Verification failed</h1>
            <p>${error.message}</p>
          </body></html>
        `, {
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }

    if (url.pathname === '/auth/forgot') {
      const { email } = await req.json();
      try {
        const result = await forgotPassword(email);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/auth/reset') {
      const token = url.searchParams.get('token');
      if (req.method === 'GET') {
        return new Response(`
          <html><body>
            <h1>Reset Password</h1>
            <form method="POST">
              <input type="password" name="password" placeholder="New password" required>
              <button type="submit">Reset Password</button>
            </form>
          </body></html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      if (req.method === 'POST') {
        const formData = await req.formData();
        const password = formData.get('password');
        try {
          await resetPassword(token, password);
          return new Response(`
            <html><body>
              <h1>Password reset successfully!</h1>
              <p>You can now close this tab and login with your new password.</p>
            </body></html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        } catch (error) {
          return new Response(`
            <html><body>
              <h1>Reset failed</h1>
              <p>${error.message}</p>
            </body></html>
          `, {
            status: 400,
            headers: { 'Content-Type': 'text/html' }
          });
        }
      }
    }

    if (url.pathname === '/auth/logout') {
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
      response.headers.set('Set-Cookie', 'auth=; HttpOnly; Path=/; Max-Age=0');
      return response;
    }

    if (url.pathname === '/auth/me') {
      const user = authMiddleware(req);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ user: { id: user.id, email: user.email } }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Protected endpoints
    if (url.pathname === '/api/add-article') {
      const user = authMiddleware(req);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { url: sourceUrl } = await req.json();
      
      try {
        const item = await processUrl(user.id, sourceUrl);
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
      const user = authMiddleware(req);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        const content = getAllContent(user.id);
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

    if (url.pathname === '/api/progress' && req.method === 'POST') {
      try {
        const { id, seconds } = await req.json();
        updateSecondsListened(id, Math.floor(seconds));
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error updating progress:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname.startsWith(`/api/stream`)) {
        const user = authMiddleware(req);
        if (!user) {
          return new Response(JSON.stringify({ error: 'Not authenticated' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const id = url.searchParams.get('id');
        const content = getContent(id);
        if (!content || content.user_id !== user.id) {
          return new Response('Not found', { status: 404 });
        }
        
        const file = Bun.file(content.content_url);
        const fileSize = Number(await file.size);
        
        // Check if content is still being generated
        const isStillGenerating = content.status === 'processing';
        
        // For files still being generated, use live streaming
        if (isStillGenerating) {
            console.log(`Live streaming generating file for content ${id}`);
            
            const headers = {
                'Content-Type': 'audio/mpeg',
                'Accept-Ranges': 'none',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            };
            
            // Create a stream that reads the file as it grows
            const stream = new ReadableStream({
                async start(controller) {
                    let lastSize = 0;
                    let currentContent = getContent(id);
                    
                    // Keep streaming until the file is completed
                    while (currentContent.status === 'processing') {
                        try {
                            const currentFile = Bun.file(content.content_url);
                            const currentSize = Number(await currentFile.size);
                            
                            // If file has grown, read and send the new data
                            if (currentSize > lastSize) {
                                const fileBuffer = await currentFile.arrayBuffer();
                                const newData = fileBuffer.slice(lastSize);
                                controller.enqueue(new Uint8Array(newData));
                                lastSize = currentSize;
                            }
                            
                            // Wait a bit before checking again
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            // Refresh content status
                            currentContent = getContent(id);
                        } catch (error) {
                            console.error('Error in live streaming:', error);
                            break;
                        }
                    }
                    
                    // Send any remaining data when processing is complete
                    try {
                        const finalFile = Bun.file(content.content_url);
                        const finalSize = Number(await finalFile.size);
                        if (finalSize > lastSize) {
                            const fileBuffer = await finalFile.arrayBuffer();
                            const remainingData = fileBuffer.slice(lastSize);
                            controller.enqueue(new Uint8Array(remainingData));
                        }
                    } catch (error) {
                        console.error('Error sending final data:', error);
                    }
                    
                    controller.close();
                }
            });
            
            return new Response(stream, {
                status: 200,
                headers
            });
        }
        
        // For completed files, handle range requests normally
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
        
        console.log(`Streaming completed file from ${start} to ${end}, chunk size: ${chunkSize}`);
        
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

console.log(`Server running at http://localhost:${server.port}`);

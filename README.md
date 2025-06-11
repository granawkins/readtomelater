# Read To Me Later
Send Blogs, websites and PDFs to ReadToMeLater, and have them read to you by an AI on your phone.

## MVP Interface

Website (readtomelater.com)
- Landing:
  - Video demonstrating
  - Login with Google button
- User Home:
  - Your queue, just like a spotify playlist, newest first. Click to play
  - Shows processing status ("Processing...", "Ready", "Failed")
  - An input box where you paste links to add them to your queue
  - On desktop, a 'bookmarklet' you can drag to your bookmarks bar

Backend
- Database:
  - Users: id, google_id, email, created_at
  - Content: id, created_at, user_id, url, title, text, processing_status, duration_seconds, progress_seconds, error_message
- Audio Storage: Local directory ./audio/{content_id}.mp3
- Processing Engine (Background Jobs)
  - Takes content_id from queue
  - Update status: 'processing'
  - Use Readability.js to parse text and title from url, update db
  - Send text to OpenAI TTS, save audio file
  - Update status: 'ready' + duration_seconds (or 'failed' + error_message)
- Server
  - POST /api/add-article {url}: Create record (status: 'queued'), add to processing queue, return immediately
  - GET /api/queue: Return user's articles with status
  - POST /api/progress {content_id, progress_seconds}: Update listening progress
  - GET /api/audio/:content_id: Serve audio file (with auth check)
  - Google OAuth + session management
  - Frontend serving

import { useState } from 'react';
import AudioPlayer from './AudioPlayer';

const Readtome = () => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audioPath, setAudioPath] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    try {
      const response = await fetch('/api/readtome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      setTitle(data.title || 'No title found');
      setContent(data.content || 'No content extracted');
      setAudioPath(data.audioPath || '');
    } catch {
      setTitle('Error');
      setContent('Error extracting content');
      setAudioPath('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Read To Me</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL to parse and listen to"
          style={{ width: '400px', marginRight: '10px' }}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : 'Read To Me'}
        </button>
      </form>
      {title && (
        <div style={{ marginTop: '20px' }}>
          <h3>Title:</h3>
          <p>
            <strong>{title}</strong>
          </p>
        </div>
      )}
      {audioPath && (
        <div style={{ marginTop: '20px' }}>
          <h3>Audio:</h3>
          <AudioPlayer audioUrl={audioPath} />
        </div>
      )}
      {content && (
        <div style={{ marginTop: '20px' }}>
          <h3>Content:</h3>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              maxHeight: '400px',
              overflow: 'auto',
              border: '1px solid #ccc',
              padding: '10px',
            }}
          >
            {content}
          </div>
        </div>
      )}
    </div>
  );
};

export default Readtome;

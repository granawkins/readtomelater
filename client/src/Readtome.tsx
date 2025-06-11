import { useState } from 'react';
import AudioPlayer from './AudioPlayer';

interface AudioChunk {
  index: number;
  audioPath: string;
  audioHash: string;
  startIndex: number;
  endIndex: number;
  textLength: number;
}

const Readtome = () => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
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
      setAudioChunks(data.audioChunks || []);
    } catch {
      setTitle('Error');
      setContent('Error extracting content');
      setAudioChunks([]);
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
      {audioChunks.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Audio:</h3>
          <AudioPlayer audioChunks={audioChunks} title={title} />
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

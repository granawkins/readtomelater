import { useState } from 'react';

const Readability = () => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    try {
      const response = await fetch('/api/readability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      setTitle(data.title || 'No title found');
      setContent(data.content || 'No content extracted');
    } catch {
      setTitle('Error');
      setContent('Error extracting content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Readability Test</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL to parse"
          style={{ width: '300px', marginRight: '10px' }}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Submit'}
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
      {content && (
        <div style={{ marginTop: '20px' }}>
          <h3>Content:</h3>
          <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
        </div>
      )}
    </div>
  );
};

export default Readability;

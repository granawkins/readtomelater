import { useState, useEffect, useRef } from 'react';
import { Howl } from 'howler';

interface AudioChunk {
  audioPath: string;
  hash: string;
  chunkIndex: number;
  text: string;
}

interface ReadtomeData {
  title: string;
  content: string;
  audioChunks: AudioChunk[];
  totalChunks: number;
  totalLength: number;
}

const Readtome = () => {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<ReadtomeData | null>(null);
  const [loading, setLoading] = useState(false);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const howlRef = useRef<Howl | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      const responseData = await response.json();
      setData({
        title: responseData.title || 'No title found',
        content: responseData.content || 'No content extracted',
        audioChunks: responseData.audioChunks || [],
        totalChunks: responseData.totalChunks || 0,
        totalLength: responseData.totalLength || 0,
      });
    } catch {
      setData({
        title: 'Error',
        content: 'Error extracting content',
        audioChunks: [],
        totalChunks: 0,
        totalLength: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // Load audio chunk
  const loadChunk = (chunkIndex: number) => {
    if (!data || !data.audioChunks[chunkIndex]) return;

    // Clean up existing audio
    if (howlRef.current) {
      howlRef.current.stop();
      howlRef.current.unload();
    }

    const chunk = data.audioChunks[chunkIndex];
    const howl = new Howl({
      src: [chunk.audioPath],
      html5: true, // Use HTML5 audio for better streaming
      rate: playbackRate,
      onload: () => {
        setDuration(howl.duration());
        updateMediaSession(chunk.text, chunkIndex);
      },
      onplay: () => setIsPlaying(true),
      onpause: () => setIsPlaying(false),
      onstop: () => setIsPlaying(false),
      onend: () => {
        // Auto-advance to next chunk
        if (chunkIndex < data.audioChunks.length - 1) {
          setCurrentChunk(chunkIndex + 1);
        } else {
          setIsPlaying(false);
        }
      },
    });

    howlRef.current = howl;
    startProgressTracking();
  };

  // Update Media Session for background playback
  const updateMediaSession = (chunkText: string, chunkIndex: number) => {
    if ('mediaSession' in navigator && data) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: data.title,
        artist: 'Read To Me Later',
        album: `Chunk ${chunkIndex + 1} of ${data.totalChunks}`,
      });

      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () =>
        previousChunk()
      );
      navigator.mediaSession.setActionHandler('nexttrack', () => nextChunk());
    }
  };

  // Progress tracking
  const startProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      if (howlRef.current && isPlaying) {
        setProgress(howlRef.current.seek());
      }
    }, 100);
  };

  // Playback controls
  const play = () => {
    if (howlRef.current) {
      howlRef.current.play();
    }
  };

  const pause = () => {
    if (howlRef.current) {
      howlRef.current.pause();
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const changeSpeed = (newRate: number) => {
    setPlaybackRate(newRate);
    if (howlRef.current) {
      howlRef.current.rate(newRate);
    }
  };

  const seek = (position: number) => {
    if (howlRef.current) {
      howlRef.current.seek(position);
      setProgress(position);
    }
  };

  const nextChunk = () => {
    if (data && currentChunk < data.audioChunks.length - 1) {
      setCurrentChunk(currentChunk + 1);
    }
  };

  const previousChunk = () => {
    if (currentChunk > 0) {
      setCurrentChunk(currentChunk - 1);
    }
  };

  // Load chunk when currentChunk changes
  useEffect(() => {
    if (data && data.audioChunks.length > 0) {
      loadChunk(currentChunk);
    }
  }, [currentChunk, data]);

  // Update playback rate when it changes
  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.rate(playbackRate);
    }
  }, [playbackRate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (howlRef.current) {
        howlRef.current.stop();
        howlRef.current.unload();
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      {data && (
        <>
          <div style={{ marginTop: '20px' }}>
            <h3>Title:</h3>
            <p>
              <strong>{data.title}</strong>
            </p>
          </div>

          {data.audioChunks.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3>Audio Player:</h3>
              <div
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  padding: '20px',
                  maxWidth: '600px',
                  backgroundColor: '#f9f9f9',
                }}
              >
                {/* Chunk Info */}
                <div
                  style={{
                    marginBottom: '10px',
                    fontSize: '14px',
                    color: '#666',
                  }}
                >
                  Chunk {currentChunk + 1} of {data.totalChunks}
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: '15px' }}>
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    value={progress}
                    onChange={(e) => seek(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#666',
                    }}
                  >
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '15px',
                  }}
                >
                  <button
                    onClick={previousChunk}
                    disabled={currentChunk === 0}
                    style={{ padding: '8px 12px' }}
                  >
                    ⏮️ Prev
                  </button>
                  <button
                    onClick={togglePlayPause}
                    style={{ padding: '10px 20px', fontSize: '16px' }}
                  >
                    {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                  </button>
                  <button
                    onClick={nextChunk}
                    disabled={currentChunk >= data.audioChunks.length - 1}
                    style={{ padding: '8px 12px' }}
                  >
                    Next ⏭️
                  </button>
                </div>

                {/* Speed Control */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '14px' }}>Speed:</span>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changeSpeed(rate)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor:
                          playbackRate === rate ? '#007bff' : '#fff',
                        color: playbackRate === rate ? '#fff' : '#000',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                      }}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

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
              {data.content}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Readtome;

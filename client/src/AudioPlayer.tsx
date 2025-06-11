import { useAudioPlayer } from 'react-use-audio-player';
import { useEffect, useState } from 'react';

interface AudioPlayerProps {
  src: string;
  title?: string;
}

const AudioPlayer = ({ src, title }: AudioPlayerProps) => {
  const {
    load,
    play,
    pause,
    seek,
    playing,
    duration,
    position,
    loading,
    error,
  } = useAudioPlayer();
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    if (src) {
      setLoadError('');
      load(src, {
        onload: () => {
          console.log('Audio loaded successfully');
        },
        onloaderror: () => {
          setLoadError('Failed to load audio file');
        },
      });
    }
  }, [src, load]);

  const togglePlayPause = () => {
    if (playing) {
      pause();
    } else {
      play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = parseFloat(e.target.value);
    seek(newPosition);
  };

  const skipForward = () => {
    const newPosition = Math.min(position + 15, duration);
    seek(newPosition);
  };

  const skipBackward = () => {
    const newPosition = Math.max(position - 15, 0);
    seek(newPosition);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration ? (position / duration) * 100 : 0;

  if (error || loadError) {
    return (
      <div
        style={{
          padding: '20px',
          border: '1px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#ffe0e0',
          color: '#d63031',
        }}
      >
        <p>❌ Error loading audio: {loadError || error}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '12px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        maxWidth: '600px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {title && (
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            color: '#2d3436',
          }}
        >
          🎵 {title}
        </h3>
      )}

      {loading && (
        <div
          style={{
            textAlign: 'center',
            padding: '20px',
            color: '#636e72',
          }}
        >
          <p>⏳ Loading audio...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Progress Bar */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px',
              }}
            >
              <span
                style={{ fontSize: '14px', color: '#636e72', minWidth: '40px' }}
              >
                {formatTime(position)}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '6px',
                  backgroundColor: '#ddd',
                  borderRadius: '3px',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercentage}%`,
                    backgroundColor: '#0984e3',
                    borderRadius: '3px',
                    transition: 'width 0.1s ease',
                  }}
                />
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={position}
                  onChange={handleSeek}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    left: 0,
                    width: '100%',
                    height: '20px',
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                />
              </div>
              <span
                style={{ fontSize: '14px', color: '#636e72', minWidth: '40px' }}
              >
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <button
              onClick={skipBackward}
              style={{
                background: 'none',
                border: '2px solid #74b9ff',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: '#0984e3',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#74b9ff';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#0984e3';
              }}
              title="Skip back 15s"
            >
              ⏪
            </button>

            <button
              onClick={togglePlayPause}
              style={{
                background: '#0984e3',
                border: 'none',
                borderRadius: '50%',
                width: '64px',
                height: '64px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                color: 'white',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(9, 132, 227, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#74b9ff';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0984e3';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {playing ? '⏸️' : '▶️'}
            </button>

            <button
              onClick={skipForward}
              style={{
                background: 'none',
                border: '2px solid #74b9ff',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: '#0984e3',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#74b9ff';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#0984e3';
              }}
              title="Skip forward 15s"
            >
              ⏩
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AudioPlayer;

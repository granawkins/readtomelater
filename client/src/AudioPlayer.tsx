import { useAudioPlayer } from 'react-use-audio-player';
import { useEffect, useRef, useState } from 'react';

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
    isPlaying,
    duration,
    getPosition,
    isLoading,
    error,
  } = useAudioPlayer();
  const [loadError, setLoadError] = useState<string>('');
  const getPositionInterval = useRef<NodeJS.Timeout | null>(null);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (src) {
      try {
        load(src, {
          onload: () => {
            console.log('Audio loaded successfully');
            getPositionInterval.current = setInterval(() => {
              setPosition(getPosition());
            }, 100);
          },
        });
      } catch (error) {
        setLoadError(error as string);
      }
    }
    return () => {
      if (getPositionInterval.current) {
        clearInterval(getPositionInterval.current);
      }
    };
  }, [src, load]);

  const togglePlayPause = () => {
    if (isPlaying) {
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
      <p style={{ color: 'red' }}>Error loading audio: {loadError || error}</p>
    );
  }

  return (
    <div
      style={{
        border: '1px solid black',
        maxWidth: '600px',
        padding: '5px',
        textAlign: 'center',
      }}
    >
      {title && <h3>{title}</h3>}

      {isLoading ? (
        <p>Loading audio...</p>
      ) : (
        <>
          {/* Progress Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {formatTime(position)}
            <div
              style={{
                height: '6px',
                width: '100%',
                backgroundColor: 'lightgray',
                position: 'relative',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPercentage}%`,
                  backgroundColor: 'blue',
                }}
              />
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={getPosition()}
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
            {formatTime(duration)}
          </div>

          {/* Controls */}
          <div>
            <button onClick={skipBackward}>-15s</button>

            <button onClick={togglePlayPause}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button onClick={skipForward}>+15s</button>
          </div>
        </>
      )}
    </div>
  );
};

export default AudioPlayer;

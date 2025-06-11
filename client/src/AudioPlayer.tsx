import { useState, useEffect, useRef } from 'react';
import { Howl } from 'howler';

interface AudioPlayerProps {
  audioUrl: string;
}

const AudioPlayer = ({ audioUrl }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const howlRef = useRef<Howl | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Howl when audioUrl changes
  useEffect(() => {
    if (!audioUrl) return;

    setIsLoading(true);

    // Clean up previous Howl instance
    if (howlRef.current) {
      howlRef.current.unload();
    }

    const sound = new Howl({
      src: [audioUrl],
      html5: true,
      onload: () => {
        setDuration(sound.duration());
        setIsLoading(false);
      },
      onplay: () => {
        setIsPlaying(true);
        startProgressTracking();
      },
      onpause: () => {
        setIsPlaying(false);
        stopProgressTracking();
      },
      onend: () => {
        setIsPlaying(false);
        setCurrentTime(0);
        stopProgressTracking();
      },
      onloaderror: () => {
        setIsLoading(false);
        console.error('Error loading audio');
      },
    });

    howlRef.current = sound;

    return () => {
      stopProgressTracking();
      if (howlRef.current) {
        howlRef.current.unload();
      }
    };
  }, [audioUrl]);

  const startProgressTracking = () => {
    progressIntervalRef.current = setInterval(() => {
      if (howlRef.current && howlRef.current.playing()) {
        setCurrentTime(howlRef.current.seek());
      }
    }, 100);
  };

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const togglePlayPause = () => {
    if (!howlRef.current) return;

    if (isPlaying) {
      howlRef.current.pause();
    } else {
      howlRef.current.play();
    }
  };

  const skipForward = () => {
    if (!howlRef.current) return;
    const newTime = Math.min(currentTime + 10, duration);
    howlRef.current.seek(newTime);
    setCurrentTime(newTime);
  };

  const skipBackward = () => {
    if (!howlRef.current) return;
    const newTime = Math.max(currentTime - 10, 0);
    howlRef.current.seek(newTime);
    setCurrentTime(newTime);
  };

  const handleSpeedChange = (newRate: number) => {
    if (!howlRef.current) return;
    setPlaybackRate(newRate);
    howlRef.current.rate(newRate);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!howlRef.current) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    howlRef.current.seek(newTime);
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!audioUrl) {
    return null;
  }

  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '600px',
        backgroundColor: '#f9f9f9',
      }}
    >
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Audio Player</h4>

        {isLoading ? (
          <div>Loading audio...</div>
        ) : (
          <>
            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '10px',
              }}
              onClick={handleProgressClick}
            >
              <div
                style={{
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  height: '100%',
                  backgroundColor: '#007bff',
                  borderRadius: '4px',
                  transition: 'width 0.1s ease',
                }}
              />
            </div>

            {/* Time Display */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                color: '#666',
                marginBottom: '15px',
              }}
            >
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Control Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '15px',
              }}
            >
              <button
                onClick={skipBackward}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                ⏪ -10s
              </button>

              <button
                onClick={togglePlayPause}
                style={{
                  padding: '12px 20px',
                  border: '1px solid #007bff',
                  borderRadius: '4px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>

              <button
                onClick={skipForward}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                ⏩ +10s
              </button>
            </div>

            {/* Speed Control */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <label style={{ fontSize: '14px', color: '#666' }}>Speed:</label>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleSpeedChange(rate)}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor:
                      playbackRate === rate ? '#007bff' : 'white',
                    color: playbackRate === rate ? 'white' : 'black',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;

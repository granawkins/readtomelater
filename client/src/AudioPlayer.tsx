import { useAudioPlayer } from 'react-use-audio-player';
import { useEffect, useRef, useState } from 'react';

interface AudioChunk {
  index: number;
  audioPath: string;
  audioHash: string;
  startIndex: number;
  endIndex: number;
  textLength: number;
}

interface AudioPlayerProps {
  audioChunks: AudioChunk[];
  title?: string;
}

const AudioPlayer = ({ audioChunks, title }: AudioPlayerProps) => {
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
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [chunkDurations, setChunkDurations] = useState<number[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [overallPosition, setOverallPosition] = useState(0);

  // Load the current chunk
  useEffect(() => {
    if (audioChunks.length > 0 && currentChunkIndex < audioChunks.length) {
      const currentChunk = audioChunks[currentChunkIndex];
      try {
        load(currentChunk.audioPath, {
          onload: () => {
            console.log(`Chunk ${currentChunkIndex} loaded successfully`);

            // Update chunk duration when loaded
            const newDurations = [...chunkDurations];
            newDurations[currentChunkIndex] = duration;
            setChunkDurations(newDurations);

            // Calculate total duration when we have all chunk durations
            if (
              newDurations.length === audioChunks.length &&
              newDurations.every((d) => d > 0)
            ) {
              setTotalDuration(newDurations.reduce((sum, d) => sum + d, 0));
            }

            if (getPositionInterval.current) {
              clearInterval(getPositionInterval.current);
            }
            getPositionInterval.current = setInterval(() => {
              const currentPos = getPosition();
              setPosition(currentPos);

              // Calculate overall position
              const previousChunksDuration = chunkDurations
                .slice(0, currentChunkIndex)
                .reduce((sum, d) => sum + d, 0);
              setOverallPosition(previousChunksDuration + currentPos);

              // Check if current chunk is finished
              if (
                currentPos >= duration - 0.1 &&
                currentChunkIndex < audioChunks.length - 1
              ) {
                // Auto-advance to next chunk
                setCurrentChunkIndex(currentChunkIndex + 1);
              }
            }, 100);
          },
          onend: () => {
            // Handle chunk end - advance to next chunk if available
            if (currentChunkIndex < audioChunks.length - 1) {
              setCurrentChunkIndex(currentChunkIndex + 1);
            }
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
  }, [audioChunks, currentChunkIndex, load]);

  // Auto-play when switching chunks if we were playing
  useEffect(() => {
    if (isPlaying && currentChunkIndex > 0) {
      // Small delay to ensure chunk is loaded
      setTimeout(() => {
        play();
      }, 100);
    }
  }, [currentChunkIndex]);

  const togglePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOverallPosition = parseFloat(e.target.value);

    // Find which chunk this position belongs to
    let cumulativeTime = 0;
    let targetChunk = 0;
    let positionInChunk = newOverallPosition;

    for (let i = 0; i < chunkDurations.length; i++) {
      if (cumulativeTime + chunkDurations[i] >= newOverallPosition) {
        targetChunk = i;
        positionInChunk = newOverallPosition - cumulativeTime;
        break;
      }
      cumulativeTime += chunkDurations[i];
    }

    // If we need to switch chunks
    if (targetChunk !== currentChunkIndex) {
      setCurrentChunkIndex(targetChunk);
      // Will seek after chunk loads
      setTimeout(() => {
        seek(positionInChunk);
      }, 200);
    } else {
      // Same chunk, just seek
      seek(positionInChunk);
    }
  };

  const skipForward = () => {
    const newOverallPosition = Math.min(overallPosition + 15, totalDuration);

    // Find which chunk this position belongs to
    let cumulativeTime = 0;
    let targetChunk = 0;
    let positionInChunk = newOverallPosition;

    for (let i = 0; i < chunkDurations.length; i++) {
      if (cumulativeTime + chunkDurations[i] >= newOverallPosition) {
        targetChunk = i;
        positionInChunk = newOverallPosition - cumulativeTime;
        break;
      }
      cumulativeTime += chunkDurations[i];
    }

    if (targetChunk !== currentChunkIndex) {
      setCurrentChunkIndex(targetChunk);
      setTimeout(() => {
        seek(positionInChunk);
      }, 200);
    } else {
      seek(positionInChunk);
    }
  };

  const skipBackward = () => {
    const newOverallPosition = Math.max(overallPosition - 15, 0);

    // Find which chunk this position belongs to
    let cumulativeTime = 0;
    let targetChunk = 0;
    let positionInChunk = newOverallPosition;

    for (let i = 0; i < chunkDurations.length; i++) {
      if (cumulativeTime + chunkDurations[i] >= newOverallPosition) {
        targetChunk = i;
        positionInChunk = newOverallPosition - cumulativeTime;
        break;
      }
      cumulativeTime += chunkDurations[i];
    }

    if (targetChunk !== currentChunkIndex) {
      setCurrentChunkIndex(targetChunk);
      setTimeout(() => {
        seek(positionInChunk);
      }, 200);
    } else {
      seek(positionInChunk);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = totalDuration
    ? (overallPosition / totalDuration) * 100
    : 0;

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
            {formatTime(overallPosition)}
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
                max={totalDuration || 0}
                value={overallPosition}
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
            {formatTime(totalDuration)}
          </div>

          {/* Chunk indicator */}
          {audioChunks.length > 1 && (
            <div
              style={{ fontSize: '0.8em', color: '#666', marginTop: '0.5rem' }}
            >
              Chunk {currentChunkIndex + 1} of {audioChunks.length}
            </div>
          )}

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

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
  const [totalDuration, setTotalDuration] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0); // Progress across all chunks

  const howlRef = useRef<Howl | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunkDurations = useRef<number[]>([]);

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
        const duration = howl.duration();
        chunkDurations.current[chunkIndex] = duration;

        // Calculate total duration when all chunks are loaded
        if (
          chunkDurations.current.filter((d) => d > 0).length ===
          data.audioChunks.length
        ) {
          const total = chunkDurations.current.reduce((sum, d) => sum + d, 0);
          setTotalDuration(total);
        }

        updateMediaSession(data.title, chunkIndex);
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

  // Update Media Session for background playbook
  const updateMediaSession = (title: string, chunkIndex: number) => {
    if ('mediaSession' in navigator && data) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: 'Read To Me Later',
        album: 'Article Audio',
      });

      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('seekbackward', () =>
        seekRelative(-10)
      );
      navigator.mediaSession.setActionHandler('seekforward', () =>
        seekRelative(10)
      );
    }
  };

  // Progress tracking
  const startProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      if (howlRef.current && isPlaying) {
        const currentSeek =
          typeof howlRef.current.seek() === 'number'
            ? howlRef.current.seek()
            : 0;
        setProgress(currentSeek);

        // Calculate total progress across all chunks
        let totalProg = 0;
        for (let i = 0; i < currentChunk; i++) {
          totalProg += chunkDurations.current[i] || 0;
        }
        totalProg += currentSeek;
        setTotalProgress(totalProg);

        console.log(
          `Progress: chunk ${currentChunk}, seek ${currentSeek.toFixed(1)}s, total ${totalProg.toFixed(1)}s`
        );
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
      console.log(`Direct seek called with position: ${position}s`);
      const wasPlaying = howlRef.current.playing();
      console.log(
        `Howl state: playing=${wasPlaying}, duration=${howlRef.current.duration()}, current_seek=${howlRef.current.seek()}`
      );

      // Pause if playing, seek, then resume if needed
      if (wasPlaying) {
        howlRef.current.pause();
        console.log('Paused for direct seeking');
      }

      const result = howlRef.current.seek(position);
      console.log(`Seek result:`, result);
      console.log(`New seek position:`, howlRef.current.seek());

      if (wasPlaying) {
        setTimeout(() => {
          if (howlRef.current) {
            howlRef.current.play();
            console.log('Resumed after direct seeking');
          }
        }, 50);
      }

      setProgress(position);
    } else {
      console.log('No howl instance available for seeking');
    }
  };

  const seekRelative = (seconds: number) => {
    const newTotalPosition = Math.max(
      0,
      Math.min(totalProgress + seconds, totalDuration)
    );
    seekToTotalPosition(newTotalPosition);
  };

  // Seek to position in total timeline (across all chunks)
  const seekToTotalPosition = (totalPosition: number) => {
    if (!data) {
      console.log('No data available for seeking');
      return;
    }

    console.log(`Seeking to total position: ${totalPosition}s`);
    console.log('Chunk durations:', chunkDurations.current);

    let accumulatedTime = 0;
    let targetChunk = 0;
    let positionInChunk = totalPosition;

    // Find which chunk contains this position
    for (let i = 0; i < data.audioChunks.length; i++) {
      const chunkDuration = chunkDurations.current[i] || 0;
      console.log(
        `Chunk ${i}: duration ${chunkDuration}s, accumulated ${accumulatedTime}s`
      );

      if (accumulatedTime + chunkDuration > totalPosition) {
        targetChunk = i;
        positionInChunk = totalPosition - accumulatedTime;
        console.log(
          `Target chunk ${targetChunk}, position in chunk: ${positionInChunk}s`
        );
        break;
      }
      accumulatedTime += chunkDuration;
    }

    // Switch to the target chunk if needed
    if (targetChunk !== currentChunk) {
      console.log(
        `Switching from chunk ${currentChunk} to chunk ${targetChunk}`
      );
      setCurrentChunk(targetChunk);
      // The seek will happen after the chunk loads
      setTimeout(() => {
        if (howlRef.current) {
          console.log(`Seeking to ${positionInChunk}s in new chunk`);
          howlRef.current.seek(positionInChunk);
          setProgress(positionInChunk);
        }
      }, 200);
    } else {
      // Same chunk, just seek
      if (howlRef.current) {
        console.log(`Seeking to ${positionInChunk}s in current chunk`);
        console.log(
          `Howl state before seek: playing=${howlRef.current.playing()}, duration=${howlRef.current.duration()}, loaded=${howlRef.current.state()}`
        );

        // Wait for the audio to be ready before seeking
        if (howlRef.current.state() === 'loaded') {
          const wasPlaying = howlRef.current.playing();
          console.log(`Will pause-seek-resume. Was playing: ${wasPlaying}`);

          // Pause if playing, seek, then resume if needed
          if (wasPlaying) {
            howlRef.current.pause();
            console.log('Paused for seeking');
          }

          const result = howlRef.current.seek(positionInChunk);
          console.log(`Seek result:`, result);
          console.log(`New position after seek:`, howlRef.current.seek());

          if (wasPlaying) {
            setTimeout(() => {
              if (howlRef.current) {
                howlRef.current.play();
                console.log('Resumed after seeking');
              }
            }, 50);
          }

          setProgress(positionInChunk);
        } else {
          console.log('Audio not loaded yet, waiting...');
          // Wait a bit and try again
          setTimeout(() => {
            if (howlRef.current && howlRef.current.state() === 'loaded') {
              console.log('Retrying seek after audio loaded');
              const wasPlaying = howlRef.current.playing();

              if (wasPlaying) {
                howlRef.current.pause();
              }

              const result = howlRef.current.seek(positionInChunk);
              console.log(`Delayed seek result:`, result);

              if (wasPlaying) {
                setTimeout(() => {
                  if (howlRef.current) {
                    howlRef.current.play();
                  }
                }, 50);
              }

              setProgress(positionInChunk);
            }
          }, 500);
        }
      }
    }
  };

  // Preload all chunk durations for seeking
  const preloadChunkDurations = () => {
    if (!data) return;

    console.log(`Preloading ${data.audioChunks.length} chunk durations...`);

    data.audioChunks.forEach((chunk, index) => {
      if (!chunkDurations.current[index]) {
        console.log(`Loading metadata for chunk ${index}:`, chunk.audioPath);
        const tempHowl = new Howl({
          src: [chunk.audioPath],
          html5: true,
          preload: 'metadata',
          onload: () => {
            const duration = tempHowl.duration();
            chunkDurations.current[index] = duration;
            console.log(`Chunk ${index} duration: ${duration}s`);
            tempHowl.unload();

            // Update total duration when all chunks are loaded
            const loadedCount = chunkDurations.current.filter(
              (d) => d > 0
            ).length;
            console.log(
              `Loaded ${loadedCount}/${data.audioChunks.length} chunks`
            );

            if (loadedCount === data.audioChunks.length) {
              const total = chunkDurations.current.reduce(
                (sum, d) => sum + d,
                0
              );
              console.log(`Total duration: ${total}s`);
              setTotalDuration(total);
            }
          },
          onloaderror: (id, error) => {
            console.error(`Failed to load chunk ${index}:`, error);
          },
        });
      }
    });
  };

  // Load chunk when currentChunk changes
  useEffect(() => {
    if (data && data.audioChunks.length > 0) {
      loadChunk(currentChunk);
    }
  }, [currentChunk, data]);

  // Initialize chunk durations when data changes
  useEffect(() => {
    if (data && data.audioChunks.length > 0) {
      chunkDurations.current = new Array(data.audioChunks.length).fill(0);
      setCurrentChunk(0);
      setTotalProgress(0);
      preloadChunkDurations();
    }
  }, [data]);

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
                {/* Progress Bar */}
                <div style={{ marginBottom: '15px' }}>
                  <input
                    type="range"
                    min="0"
                    max={totalDuration}
                    value={totalProgress}
                    onChange={(e) =>
                      seekToTotalPosition(Number(e.target.value))
                    }
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
                    <span>{formatTime(totalProgress)}</span>
                    <span>{formatTime(totalDuration)}</span>
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
                    onClick={() => seekRelative(-15)}
                    style={{ padding: '8px 12px' }}
                  >
                    ⏪ -15s
                  </button>
                  <button
                    onClick={togglePlayPause}
                    style={{ padding: '10px 20px', fontSize: '16px' }}
                  >
                    {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                  </button>
                  <button
                    onClick={() => seekRelative(15)}
                    style={{ padding: '8px 12px' }}
                  >
                    +15s ⏩
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

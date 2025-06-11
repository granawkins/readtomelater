import { useEffect, useRef, useState } from 'react';

interface AudioSegment {
  segmentPath: string;
  segmentNumber: number;
  hash: string;
  fileExists: boolean;
}

interface StreamingAudioPlayerProps {
  segments: AudioSegment[];
  title?: string;
}

const StreamingAudioPlayer = ({
  segments,
  title,
}: StreamingAudioPlayerProps) => {
  const [currentSegment, setCurrentSegment] = useState(0);
  const [loadedSegments, setLoadedSegments] = useState<Set<number>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [segmentDurations, setSegmentDurations] = useState<number[]>([]);
  const [error, setError] = useState<string>('');

  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
  const positionInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio elements
  useEffect(() => {
    audioRefs.current = segments.map(() => new Audio());

    // Load the first segment immediately
    if (segments.length > 0) {
      loadSegment(0);
    }

    return () => {
      audioRefs.current.forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
      }
    };
  }, [segments]);

  const loadSegment = async (segmentIndex: number) => {
    if (loadedSegments.has(segmentIndex) || !segments[segmentIndex]) return;

    const audio = audioRefs.current[segmentIndex];
    const segment = segments[segmentIndex];

    if (!audio) return;

    return new Promise<void>((resolve, reject) => {
      const onLoadedData = () => {
        setLoadedSegments((prev) => new Set([...prev, segmentIndex]));
        setSegmentDurations((prev) => {
          const newDurations = [...prev];
          newDurations[segmentIndex] = audio.duration;
          return newDurations;
        });
        audio.removeEventListener('loadeddata', onLoadedData);
        audio.removeEventListener('error', onError);
        resolve();
      };

      const onError = (e: Event) => {
        console.error(`Failed to load segment ${segmentIndex + 1}:`, e);
        console.error(`Segment path: ${segment.segmentPath}`);
        console.error(
          `Audio element error:`,
          (e.target as HTMLAudioElement)?.error
        );
        setError(`Failed to load segment ${segmentIndex + 1}`);
        audio.removeEventListener('loadeddata', onLoadedData);
        audio.removeEventListener('error', onError);
        reject();
      };

      console.log(
        `Loading segment ${segmentIndex + 1} from: ${segment.segmentPath}`
      );
      audio.addEventListener('loadeddata', onLoadedData);
      audio.addEventListener('error', onError);
      audio.src = segment.segmentPath;
      audio.load();
    });
  };

  // Calculate total duration when segments are loaded
  useEffect(() => {
    const total = segmentDurations.reduce(
      (sum, duration) => sum + (duration || 0),
      0
    );
    setTotalDuration(total);
  }, [segmentDurations]);

  // Position tracking
  useEffect(() => {
    if (isPlaying) {
      positionInterval.current = setInterval(() => {
        updatePosition();
      }, 100);
    } else {
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
      }
    }

    return () => {
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
      }
    };
  }, [isPlaying, currentSegment]);

  const updatePosition = () => {
    const currentAudio = audioRefs.current[currentSegment];
    if (!currentAudio) return;

    let totalPos = 0;

    // Add durations of completed segments
    for (let i = 0; i < currentSegment; i++) {
      totalPos += segmentDurations[i] || 0;
    }

    // Add current position in current segment
    totalPos += currentAudio.currentTime;

    setPosition(totalPos);
  };

  const togglePlayPause = async () => {
    if (isPlaying) {
      // Pause current segment
      const currentAudio = audioRefs.current[currentSegment];
      if (currentAudio) {
        currentAudio.pause();
      }
      setIsPlaying(false);
    } else {
      // Ensure current segment is loaded
      if (!loadedSegments.has(currentSegment)) {
        await loadSegment(currentSegment);
      }

      // Preload next segment if it exists
      if (
        currentSegment + 1 < segments.length &&
        !loadedSegments.has(currentSegment + 1)
      ) {
        loadSegment(currentSegment + 1);
      }

      const currentAudio = audioRefs.current[currentSegment];
      if (currentAudio) {
        currentAudio.onended = () => {
          // Move to next segment
          if (currentSegment + 1 < segments.length) {
            setCurrentSegment(currentSegment + 1);
            // The useEffect will handle playing the next segment
          } else {
            setIsPlaying(false);
          }
        };

        await currentAudio.play();
        setIsPlaying(true);
      }
    }
  };

  // Handle segment changes
  useEffect(() => {
    if (isPlaying) {
      const currentAudio = audioRefs.current[currentSegment];
      if (currentAudio && loadedSegments.has(currentSegment)) {
        currentAudio.play();
      }
    }
  }, [currentSegment, isPlaying, loadedSegments]);

  const seek = (newPosition: number) => {
    let remainingTime = newPosition;
    let targetSegment = 0;

    // Find which segment the position falls in
    for (let i = 0; i < segmentDurations.length; i++) {
      const duration = segmentDurations[i] || 0;
      if (remainingTime <= duration) {
        targetSegment = i;
        break;
      }
      remainingTime -= duration;
      targetSegment = i + 1;
    }

    // Ensure we don't go beyond available segments
    targetSegment = Math.min(targetSegment, segments.length - 1);

    setCurrentSegment(targetSegment);

    const targetAudio = audioRefs.current[targetSegment];
    if (targetAudio && loadedSegments.has(targetSegment)) {
      targetAudio.currentTime = remainingTime;
    }
  };

  const skipForward = () => {
    const newPosition = Math.min(position + 15, totalDuration);
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

  const progressPercentage = totalDuration
    ? (position / totalDuration) * 100
    : 0;
  const segmentsLoaded = loadedSegments.size;
  const totalSegmentsCount = segments.length;

  if (error) {
    return <p style={{ color: 'red' }}>Error: {error}</p>;
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

      <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
        Segments loaded: {segmentsLoaded}/{totalSegmentsCount}
        {segmentsLoaded < totalSegmentsCount && ' (Loading more...)'}
      </div>

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
            max={totalDuration || 0}
            value={position}
            onChange={(e) => seek(parseFloat(e.target.value))}
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

      {/* Controls */}
      <div style={{ marginTop: '10px' }}>
        <button onClick={skipBackward}>-15s</button>
        <button onClick={togglePlayPause} disabled={segmentsLoaded === 0}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={skipForward}>+15s</button>
      </div>

      {/* Segment indicator */}
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        Playing segment {currentSegment + 1} of {totalSegmentsCount}
      </div>
    </div>
  );
};

export default StreamingAudioPlayer;

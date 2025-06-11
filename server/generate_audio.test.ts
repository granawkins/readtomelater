import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { generate_audio } from './generate_audio';
import { existsSync, rmSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock OpenAI
const mockOpenAI = {
  audio: {
    speech: {
      create: mock(() =>
        Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)), // Mock 1KB audio file
        })
      ),
    },
  },
};

// Mock the OpenAI import
mock.module('openai', () => ({
  default: function OpenAI() {
    return mockOpenAI;
  },
}));

// Mock the openai_logger
mock.module('./openai_logger', () => ({
  openaiLogger: {
    logComplete: mock(() => Promise.resolve()),
  },
}));

describe('generate_audio', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = mkdtempSync(join(tmpdir(), 'audio-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate audio segments and return correct hash', async () => {
    const testText = 'Hello, this is a test message for audio generation.';

    const result = await generate_audio(testText, { audioDir: tempDir });

    expect(result.hash).toBeString();
    expect(result.segments).toBeArray();
    expect(result.totalSegments).toBeNumber();
    expect(result.segments.length).toBe(result.totalSegments);
    expect(result.segments.length).toBeGreaterThan(0);

    // Check first segment
    const firstSegment = result.segments[0];
    expect(firstSegment.segmentNumber).toBe(0);
    expect(firstSegment.hash).toBeString();
    expect(firstSegment.segmentPath).toMatch(
      /^\/api\/audio\/segment\/[a-f0-9]{64}\.mp3$/
    );
    expect(firstSegment.fileExists).toBe(false);

    // Verify the actual file exists in the temp directory
    const segmentFilename = firstSegment.segmentPath.split('/').pop();
    expect(existsSync(join(tempDir, segmentFilename!))).toBe(true);
  });

  it('should return existing segments if hash matches', async () => {
    const testText = 'Hello, this is a test message for audio generation.';

    // First call creates the segments
    const result1 = await generate_audio(testText, { audioDir: tempDir });
    expect(result1.segments[0].fileExists).toBe(false);

    // Second call should return existing segments
    const result2 = await generate_audio(testText, { audioDir: tempDir });
    expect(result2.segments[0].fileExists).toBe(true);
    expect(result2.hash).toBe(result1.hash);
    expect(result2.segments.length).toBe(result1.segments.length);
    expect(result2.segments[0].segmentPath).toBe(
      result1.segments[0].segmentPath
    );
  });

  it('should handle different voice options', async () => {
    const testText = 'This is a test with different voice.';

    const result = await generate_audio(testText, {
      voice: 'nova',
      model: 'tts-1-hd',
      audioDir: tempDir,
    });

    expect(result.hash).toBeString();
    expect(result.segments).toBeArray();
    expect(result.segments.length).toBeGreaterThan(0);

    // Verify the actual segment file exists in the temp directory
    const segmentFilename = result.segments[0].segmentPath.split('/').pop();
    expect(existsSync(join(tempDir, segmentFilename!))).toBe(true);
  });

  it('should handle long text by creating multiple segments', async () => {
    // Create a long text that will definitely be split into multiple chunks
    const longText =
      'This is a very long text that should be split into multiple segments. '.repeat(
        100
      ) +
      'This sentence should definitely trigger chunk splitting because it will exceed the 4000 character limit. '.repeat(
        50
      );

    const result = await generate_audio(longText, { audioDir: tempDir });

    expect(result.segments.length).toBeGreaterThan(1);
    expect(result.totalSegments).toBe(result.segments.length);

    // Check that segments are numbered correctly
    result.segments.forEach((segment, index) => {
      expect(segment.segmentNumber).toBe(index);
      expect(segment.segmentPath).toMatch(
        /^\/api\/audio\/segment\/[a-f0-9]{64}\.mp3$/
      );

      // Verify the actual file exists
      const segmentFilename = segment.segmentPath.split('/').pop();
      expect(existsSync(join(tempDir, segmentFilename!))).toBe(true);
    });
  });
});

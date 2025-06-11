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

  it('should generate audio file and return correct hash', async () => {
    const testText = 'Hello, this is a test message for audio generation.';

    const result = await generate_audio(testText, { audioDir: tempDir });

    expect(result.chunks).toHaveLength(1);
    expect(result.totalChunks).toBe(1);
    expect(result.totalLength).toBe(testText.length);

    const chunk = result.chunks[0];
    expect(chunk.hash).toBeString();
    expect(chunk.audioPath).toMatch(
      new RegExp(
        `^${tempDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[a-f0-9]{64}\\.mp3$`
      )
    );
    expect(chunk.fileExists).toBe(false);
    expect(chunk.chunkIndex).toBe(0);
    expect(chunk.text).toBe(testText);
    expect(existsSync(chunk.audioPath)).toBe(true);
  });

  it('should return existing file if hash matches', async () => {
    const testText = 'Hello, this is a test message for audio generation.';

    // First call creates the file
    const result1 = await generate_audio(testText, { audioDir: tempDir });
    expect(result1.chunks[0].fileExists).toBe(false);

    // Second call should return existing file
    const result2 = await generate_audio(testText, { audioDir: tempDir });
    expect(result2.chunks[0].fileExists).toBe(true);
    expect(result2.chunks[0].hash).toBe(result1.chunks[0].hash);
    expect(result2.chunks[0].audioPath).toBe(result1.chunks[0].audioPath);
  });

  it('should handle different voice options', async () => {
    const testText = 'This is a test with different voice.';

    const result = await generate_audio(testText, {
      voice: 'nova',
      model: 'tts-1-hd',
      audioDir: tempDir,
    });

    expect(result.chunks[0].hash).toBeString();
    expect(existsSync(result.chunks[0].audioPath)).toBe(true);
  });

  it('should split long text into multiple chunks', async () => {
    const longText = 'A'.repeat(10000); // 10k characters

    const result = await generate_audio(longText, {
      audioDir: tempDir,
      chunkSize: 4000,
    });

    expect(result.totalChunks).toBeGreaterThan(1);
    expect(result.chunks).toHaveLength(result.totalChunks);
    expect(result.totalLength).toBe(longText.length);

    // Check that all chunks have sequential indices
    result.chunks.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index);
      expect(existsSync(chunk.audioPath)).toBe(true);
    });

    // Check that combined text equals original
    const combinedText = result.chunks.map((c) => c.text).join('');
    expect(combinedText).toBe(longText);
  });
});

import { describe, it, expect, beforeAll, mock } from 'bun:test';
import { generate_audio } from './generate_audio';
import { existsSync, rmSync } from 'fs';

// Mock OpenAI
const mockOpenAI = {
  audio: {
    speech: {
      create: mock(() => Promise.resolve({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) // Mock 1KB audio file
      }))
    }
  }
};

// Mock the OpenAI import
mock.module('openai', () => ({
  default: function OpenAI() {
    return mockOpenAI;
  }
}));

describe('generate_audio', () => {
  beforeAll(() => {
    // Clean up any existing test files
    if (existsSync('./audio')) {
      rmSync('./audio', { recursive: true, force: true });
    }
  });

  it('should generate audio file and return correct hash', async () => {
    const testText = 'Hello, this is a test message for audio generation.';
    
    const result = await generate_audio(testText);
    
    expect(result.hash).toBeString();
    expect(result.audioPath).toMatch(/^\.\/audio\/[a-f0-9]{64}\.mp3$/);
    expect(result.fileExists).toBe(false);
    expect(existsSync(result.audioPath)).toBe(true);
  });

  it('should return existing file if hash matches', async () => {
    const testText = 'Hello, this is a test message for audio generation.';
    
    // First call creates the file
    const result1 = await generate_audio(testText);
    expect(result1.fileExists).toBe(false);
    
    // Second call should return existing file
    const result2 = await generate_audio(testText);
    expect(result2.fileExists).toBe(true);
    expect(result2.hash).toBe(result1.hash);
    expect(result2.audioPath).toBe(result1.audioPath);
  });

  it('should handle different voice options', async () => {
    const testText = 'This is a test with different voice.';
    
    const result = await generate_audio(testText, { voice: 'nova', model: 'tts-1-hd' });
    
    expect(result.hash).toBeString();
    expect(existsSync(result.audioPath)).toBe(true);
  });
});

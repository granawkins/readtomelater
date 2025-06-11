import { createHash } from 'crypto';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import OpenAI from 'openai';

export interface GenerateAudioOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';
  audioDir?: string;
  chunkSize?: number;
}

export interface AudioChunk {
  audioPath: string;
  hash: string;
  fileExists: boolean;
  chunkIndex: number;
  text: string;
}

export interface GenerateAudioResult {
  chunks: AudioChunk[];
  totalChunks: number;
  totalLength: number;
}

function splitTextIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    let endIndex = currentIndex + chunkSize;

    // If we're not at the end of the text, try to break at a sentence or word boundary
    if (endIndex < text.length) {
      // Look for sentence endings within the last 200 characters
      const searchStart = Math.max(currentIndex, endIndex - 200);
      const searchText = text.slice(searchStart, endIndex);
      const sentenceEnd = searchText.lastIndexOf('. ');

      if (sentenceEnd !== -1) {
        endIndex = searchStart + sentenceEnd + 2; // Include the '. '
      } else {
        // Fall back to word boundary
        const wordEnd = text.lastIndexOf(' ', endIndex);
        if (wordEnd > currentIndex) {
          endIndex = wordEnd;
        }
      }
    }

    chunks.push(text.slice(currentIndex, endIndex));
    currentIndex = endIndex;
  }

  return chunks;
}

export async function generate_audio(
  text: string,
  options: GenerateAudioOptions = {}
): Promise<GenerateAudioResult> {
  const {
    voice = 'alloy',
    model = 'gpt-4o-mini-tts',
    audioDir = './audio',
    chunkSize = 4096,
  } = options;

  // Ensure audio directory exists
  if (!existsSync(audioDir)) {
    await mkdir(audioDir, { recursive: true });
  }

  // Split text into chunks
  const textChunks = splitTextIntoChunks(text, chunkSize);
  const chunks: AudioChunk[] = [];

  // Create OpenAI client lazily to allow for testing without API key
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Process each chunk
  for (let i = 0; i < textChunks.length; i++) {
    const chunkText = textChunks[i];

    // Create hash for this specific chunk
    const chunkHash = createHash('sha256')
      .update(`${chunkText}-${voice}-${model}-${i}`)
      .digest('hex');
    const audioPath = `${audioDir}/${chunkHash}.mp3`;

    let fileExists = false;

    // Check if file already exists
    if (existsSync(audioPath)) {
      fileExists = true;
    } else {
      try {
        // Generate audio using OpenAI
        const mp3 = await openai.audio.speech.create({
          model,
          voice,
          input: chunkText,
        });

        // Save the audio file
        const buffer = Buffer.from(await mp3.arrayBuffer());
        await Bun.write(audioPath, buffer);
      } catch (error) {
        throw new Error(
          `Failed to generate audio for chunk ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    chunks.push({
      audioPath,
      hash: chunkHash,
      fileExists,
      chunkIndex: i,
      text: chunkText,
    });
  }

  return {
    chunks,
    totalChunks: textChunks.length,
    totalLength: text.length,
  };
}

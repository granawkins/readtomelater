import { createHash } from 'crypto';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import OpenAI from 'openai';

export interface GenerateAudioOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'tts-1' | 'tts-1-hd';
  audioDir?: string;
}

export interface GenerateAudioResult {
  audioPath: string;
  hash: string;
  fileExists: boolean;
}

export async function generate_audio(
  text: string,
  options: GenerateAudioOptions = {}
): Promise<GenerateAudioResult> {
  const { voice = 'alloy', model = 'tts-1', audioDir = './audio' } = options;

  // Create hash of the text for filename
  const hash = createHash('sha256').update(text).digest('hex');
  const audioPath = `${audioDir}/${hash}.mp3`;

  // Ensure audio directory exists
  if (!existsSync(audioDir)) {
    await mkdir(audioDir, { recursive: true });
  }

  // Check if file already exists
  if (existsSync(audioPath)) {
    return {
      audioPath,
      hash,
      fileExists: true,
    };
  }

  try {
    // Create OpenAI client lazily to allow for testing without API key
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Generate audio using OpenAI
    const mp3 = await openai.audio.speech.create({
      model,
      voice,
      input: text,
    });

    // Save the audio file
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await Bun.write(audioPath, buffer);

    return {
      audioPath,
      hash,
      fileExists: false,
    };
  } catch (error) {
    throw new Error(
      `Failed to generate audio: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

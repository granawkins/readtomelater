import { createHash } from 'crypto';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import OpenAI from 'openai';
import { openaiLogger } from './openai_logger';

export interface GenerateAudioOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';
  audioDir?: string;
  chunkSize?: number;
}

export interface AudioSegment {
  segmentPath: string;
  segmentNumber: number;
  hash: string;
  fileExists: boolean;
}

export interface GenerateAudioResult {
  hash: string;
  segments: AudioSegment[];
  totalSegments: number;
}

function splitTextIntoChunks(
  text: string,
  maxChunkSize: number = 4000
): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+\s+/);

  let currentChunk = '';

  for (const sentence of sentences) {
    const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;

    if (potentialChunk.length <= maxChunkSize) {
      currentChunk = potentialChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + '.');
      }
      currentChunk = sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk + (currentChunk.endsWith('.') ? '' : '.'));
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

export async function generate_audio(
  text: string,
  options: GenerateAudioOptions = {}
): Promise<GenerateAudioResult> {
  const {
    voice = 'alloy',
    model = 'gpt-4o-mini-tts',
    audioDir = './audio',
    chunkSize = 4000,
  } = options;

  // Create hash of the full text for the session
  const hash = createHash('sha256').update(text).digest('hex');

  // Ensure audio directory exists
  if (!existsSync(audioDir)) {
    await mkdir(audioDir, { recursive: true });
  }

  // Split text into chunks
  const textChunks = splitTextIntoChunks(text, chunkSize);
  const segments: AudioSegment[] = [];

  // Create OpenAI client lazily to allow for testing without API key
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // Generate audio for each chunk
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      const segmentHash = createHash('sha256')
        .update(`${hash}-${i}`)
        .digest('hex');
      const segmentPath = `${audioDir}/${segmentHash}.mp3`;

      let fileExists = false;

      // Check if segment already exists
      if (existsSync(segmentPath)) {
        fileExists = true;
        console.log(
          `Segment ${i + 1}/${textChunks.length} already exists, skipping OpenAI request`
        );
      } else {
        const startTime = Date.now();
        let requestSuccess = false;
        let errorMessage: string | undefined;

        try {
          console.log(
            `Generating audio for segment ${i + 1}/${textChunks.length} (${chunk.length} chars)`
          );

          // Generate audio for this chunk
          const mp3 = await openai.audio.speech.create({
            model,
            voice,
            input: chunk,
          });

          // Save the audio segment
          const buffer = Buffer.from(await mp3.arrayBuffer());
          await Bun.write(segmentPath, buffer);

          requestSuccess = true;
          console.log(
            `Segment ${i + 1}/${textChunks.length} generated successfully`
          );
        } catch (segmentError) {
          errorMessage =
            segmentError instanceof Error
              ? segmentError.message
              : 'Unknown error';
          console.error(`Failed to generate segment ${i + 1}:`, errorMessage);
          throw segmentError;
        } finally {
          // Log the request
          const responseTime = Date.now() - startTime;
          await openaiLogger.logComplete(
            `${hash}-${i}`,
            model,
            voice,
            chunk,
            hash,
            requestSuccess,
            responseTime,
            i,
            textChunks.length,
            errorMessage
          );
        }
      }

      segments.push({
        segmentPath: `/api/audio/segment/${segmentHash}.mp3`,
        segmentNumber: i,
        hash: segmentHash,
        fileExists,
      });
    }

    return {
      hash,
      segments,
      totalSegments: textChunks.length,
    };
  } catch (error) {
    throw new Error(
      `Failed to generate audio: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { insertContent, updateContentStatus, updateChunksGenerated } from './database.js';
import fs from 'fs';
import OpenAI from 'openai';
import { createHash } from 'crypto';

export const AUDIO_DIR = './audio';
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function processUrl(sourceUrl) {
    // Get text and add to database
    const content = await getUrlContent(sourceUrl);
    const hash = createHash('sha256').update(sourceUrl).digest('hex');
    const contentUrl = `${AUDIO_DIR}/${hash}.mp3`;
    const item = insertContent(sourceUrl, content.title, content.body, contentUrl);
    console.log(item)

    // Generate in background
    generateAndWriteFile(item.body, item.content_url, item.id);
}

async function getUrlContent(url) {
  // Fetch the HTML document, parse and extract readable content
  const response = await fetch(url);
  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  const reader = new Readability(document);
  const article = reader.parse();
  if (!article) {
    throw new Error('Could not parse article');
  }

  return {
    title: article.title || 'No title found',
    body: article.textContent || 'No content extracted',
  };
}

async function generateAndWriteFile(text, filename, contentId) {
    console.log(`streaming from ${filename} for ${contentId}`)
    // Skip if file already exists
    if (fs.existsSync(filename)) {
        console.log(`File ${filename} already exists`);
        updateContentStatus(contentId, 'completed');
        return;
    }
    
    try {
        // Update status to processing when we start generation
        updateContentStatus(contentId, 'processing');
        
        // Split into chunks, stream directly to file
        const textChunks = splitTextIntoChunks(text);
        const fileWriteStream = fs.createWriteStream(filename);
        
        let chunksGenerated = 0;
        for (const chunk of textChunks) {
            const audioStream = await openai.audio.speech.create({
                model: 'gpt-4o-mini-tts', voice: 'nova', input: chunk, response_format: 'mp3',
            });
            for await (const part of audioStream.body) {
                fileWriteStream.write(part);
            }
            chunksGenerated++;
            updateChunksGenerated(contentId, chunksGenerated);
        }
        fileWriteStream.end();
        updateContentStatus(contentId, 'completed');
    } catch (error) {
        console.error('Error generating audio:', error);
        updateContentStatus(contentId, 'error');
    }
}

function splitTextIntoChunks(text, maxSize = 2500) {
    // Split into sentences, then compile chunks of maxSize
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    const chunks = [];
    let currentChunk = "";  
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxSize) {
        currentChunk += sentence;
      } else {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
}
  
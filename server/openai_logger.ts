import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

interface OpenAIRequest {
  timestamp: string;
  requestId: string;
  model: string;
  voice: string;
  inputLength: number;
  estimatedCost: number;
  segmentNumber?: number;
  totalSegments?: number;
  sessionHash: string;
  success: boolean;
  errorMessage?: string;
  responseTimeMs: number;
}

// OpenAI TTS pricing per 1K characters
const TTS_PRICING = {
  'tts-1': 0.015,
  'tts-1-hd': 0.03,
  'gpt-4o-mini-tts': 0.015, // Assuming similar to tts-1
};

export class OpenAILogger {
  private logDir: string;
  private logFile: string;

  constructor(logDir = './logs') {
    this.logDir = logDir;
    this.logFile = `${logDir}/openai_requests.jsonl`;
  }

  private async ensureLogDir() {
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true });
    }
  }

  private calculateCost(model: string, inputLength: number): number {
    const pricePerK =
      TTS_PRICING[model as keyof typeof TTS_PRICING] || TTS_PRICING['tts-1'];
    return (inputLength / 1000) * pricePerK;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async logRequest(
    _model: string,
    _voice: string,
    _inputText: string,
    _sessionHash: string,
    _segmentNumber?: number,
    _totalSegments?: number
  ): Promise<string> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    // Store start time for response time calculation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__openai_start_times =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__openai_start_times || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__openai_start_times[requestId] = startTime;

    return requestId;
  }

  async logResponse(
    requestId: string,
    success: boolean,
    errorMessage?: string
  ) {
    await this.ensureLogDir();

    const startTime =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__openai_start_times?.[requestId] || Date.now();
    const responseTimeMs = Date.now() - startTime;

    // Clean up the start time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((globalThis as any).__openai_start_times) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).__openai_start_times[requestId];
    }

    // For simplicity, we'll append the completion info
    await appendFile(
      this.logFile,
      JSON.stringify({
        requestId,
        success,
        errorMessage,
        responseTimeMs,
        completedAt: new Date().toISOString(),
      }) + '\n',
      'utf8'
    );
  }

  async logComplete(
    requestId: string,
    model: string,
    voice: string,
    inputText: string,
    sessionHash: string,
    success: boolean,
    responseTimeMs: number,
    segmentNumber?: number,
    totalSegments?: number,
    errorMessage?: string
  ) {
    await this.ensureLogDir();

    const logEntry: OpenAIRequest = {
      timestamp: new Date().toISOString(),
      requestId,
      model,
      voice,
      inputLength: inputText.length,
      estimatedCost: this.calculateCost(model, inputText.length),
      segmentNumber,
      totalSegments,
      sessionHash,
      success,
      errorMessage,
      responseTimeMs,
    };

    await appendFile(this.logFile, JSON.stringify(logEntry) + '\n', 'utf8');
  }

  async getSummaryStats(): Promise<{
    totalRequests: number;
    successfulRequests: number;
    totalCost: number;
    averageResponseTime: number;
    lastRequestTime?: string;
  }> {
    if (!existsSync(this.logFile)) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        totalCost: 0,
        averageResponseTime: 0,
      };
    }

    try {
      const logContent = await Bun.file(this.logFile).text();
      const entries = logContent
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as OpenAIRequest)
        .filter((entry) => entry.success !== undefined); // Only complete entries

      const totalRequests = entries.length;
      const successfulRequests = entries.filter((e) => e.success).length;
      const totalCost = entries.reduce(
        (sum, e) => sum + (e.estimatedCost || 0),
        0
      );
      const averageResponseTime =
        entries.length > 0
          ? entries.reduce((sum, e) => sum + (e.responseTimeMs || 0), 0) /
            entries.length
          : 0;
      const lastRequestTime =
        entries.length > 0 ? entries[entries.length - 1].timestamp : undefined;

      return {
        totalRequests,
        successfulRequests,
        totalCost,
        averageResponseTime,
        lastRequestTime,
      };
    } catch (error) {
      console.error('Error reading log file:', error);
      return {
        totalRequests: 0,
        successfulRequests: 0,
        totalCost: 0,
        averageResponseTime: 0,
      };
    }
  }
}

export const openaiLogger = new OpenAILogger();

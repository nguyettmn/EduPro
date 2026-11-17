// Browser client for POST /api/ai-soan-bai: SSE stream for lesson
// stages (propose/generate/revise), one plain JSON response for the
// plan/exercises stages. Every call carries the signed-in user's JWT;
// the function verifies it against Supabase Auth before calling Gemini.
import type { AiRequestBody } from './apiTypes';
import { getAccessToken } from '../supabase/client';

export class AiApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Call a JSON stage (plan / exercises) and return its `data` payload. */
export async function callAiJson<T>(
  body: AiRequestBody,
  opts: { signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/ai-soan-bai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new AiApiError(
      'network',
      'Không kết nối được tới máy chủ AI. Hãy kiểm tra mạng rồi thử lại.',
    );
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Fall through to the generic error below.
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string };
    throw new AiApiError(d.error ?? 'server_error', d.message ?? `Máy chủ trả lỗi ${res.status}. Hãy thử lại.`);
  }
  const d = (data ?? {}) as { ok?: boolean; data?: T };
  if (!d.ok || d.data === undefined) {
    throw new AiApiError('server_error', 'Máy chủ trả về kết quả không đúng định dạng. Hãy thử lại.');
  }
  return d.data;
}

export type AiStageResult =
  | { stage: 'propose'; text: string; warnings: string[] }
  | {
      stage: 'generate' | 'revise' | 'game-generate' | 'game-revise';
      html: string;
      title: string;
      assumptions: string[];
      warnings: string[];
      byteSize: number;
    };

interface CallOptions {
  signal?: AbortSignal;
  /** Called with total streamed kilobytes received so far. */
  onProgress?: (kbReceived: number) => void;
  /** Called when the server retries after a contract violation. */
  onRetry?: (violations: string[]) => void;
}

export async function callAiSoanBai(
  body: AiRequestBody,
  opts: CallOptions = {},
): Promise<AiStageResult> {
  let res: Response;
  try {
    res = await fetch('/api/ai-soan-bai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new AiApiError(
      'network',
      'Không kết nối được tới máy chủ AI. Hãy kiểm tra mạng rồi thử lại.',
    );
  }

  if (!res.ok) {
    let code = 'server_error';
    let message = `Máy chủ trả lỗi ${res.status}. Hãy thử lại.`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      if (data.error) code = data.error;
      if (data.message) message = data.message;
    } catch {
      // Keep the generic message.
    }
    throw new AiApiError(code, message);
  }

  if (!res.body) {
    throw new AiApiError('network', 'Không đọc được luồng trả về từ máy chủ.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let receivedBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.length;
      opts.onProgress?.(Math.round(receivedBytes / 1024));
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf('\n\n');
      while (sep >= 0) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const event = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
          if (event.type === 'retry') {
            opts.onRetry?.(Array.isArray(event.violations) ? (event.violations as string[]) : []);
          } else if (event.type === 'error') {
            throw new AiApiError(
              typeof event.code === 'string' ? event.code : 'server_error',
              typeof event.message === 'string' ? event.message : 'Tạo bài thất bại.',
            );
          } else if (event.type === 'done') {
            if (body.stage === 'propose') {
              return {
                stage: 'propose',
                text: typeof event.text === 'string' ? event.text : '',
                warnings: Array.isArray(event.warnings) ? (event.warnings as string[]) : [],
              };
            }
            // JSON stages (plan/exercises/game-propose) never use this SSE client.
            if (
              body.stage !== 'generate' &&
              body.stage !== 'revise' &&
              body.stage !== 'game-generate' &&
              body.stage !== 'game-revise'
            ) {
              throw new AiApiError('server_error', 'Máy chủ trả về kết quả không đúng định dạng.');
            }
            return {
              stage: body.stage,
              html: typeof event.html === 'string' ? event.html : '',
              title: typeof event.title === 'string' ? event.title : '',
              assumptions: Array.isArray(event.assumptions) ? (event.assumptions as string[]) : [],
              warnings: Array.isArray(event.warnings) ? (event.warnings as string[]) : [],
              byteSize: typeof event.byteSize === 'number' ? event.byteSize : 0,
            };
          }
        }
        sep = buffer.indexOf('\n\n');
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    if (err instanceof AiApiError) throw err;
    throw new AiApiError('network', 'Luồng trả về bị ngắt giữa chừng. Hãy thử lại.');
  }
  throw new AiApiError(
    'timeout',
    'AI chưa trả xong thì kết nối đã hết thời gian (giới hạn 5 phút của bản test). Hãy thử lại với dàn ý ngắn hơn, hoặc chia bài thành hai phần nhỏ hơn.',
  );
}

// AI Soạn bài backend: one Vercel serverless function that calls Gemini
// with the assembled prompt. The API key lives ONLY here (server-side env
// var GEMINI_API_KEY) — the browser never sees it.
//
// This file is deliberately DEPENDENCY-FREE (Node builtins only). The
// project ships `"type": "module"`, so Vercel bundles this function as
// ESM, and the CJS libraries tried first (@google/genai via
// google-auth-library, mammoth) both crash ESM bundles at import with
// "Dynamic require ... is not supported", which surfaces as a 500
// FUNCTION_INVOCATION_FAILED on every call. So: Gemini is called over its
// REST API with plain fetch, and DOCX text is extracted with a small
// hand-rolled ZIP reader (zlib) + <w:t> run extraction. Do not add CJS
// dependencies back here without re-running the ESM bundle load test.
//
// POST /api/ai-soan-bai  (JSON body, see AiRequestBody)
// Responds with a Server-Sent Events stream:
//   {"type":"chunk","text":"..."}        streamed model output (text)
//   {"type":"retry","violations":[...]}   first output violated the contract; retrying once
//   {"type":"done", ...}                 final result (text for propose, html for generate/revise)
//   {"type":"error","code":"...","message":"..."}  terminal failure
//
// Test-slice limits: total attachments <= 4MB decoded (Vercel body limit
// is 4.5MB); the frontend enforces a smaller cap. Function max duration
// is 300s (Hobby ceiling); a generation that runs past it is cut off by
// Vercel and the client reports a timeout.
import { inflateRawSync } from 'node:zlib';
import {
  buildLessonPrompt,
  buildProposePrompt,
  buildRevisePrompt,
} from '../src/ai/prompt';
import type { AttachmentNote } from '../src/ai/prompt';
import type { AiRequestBody, WireAttachment } from '../src/ai/apiTypes';

export const config = { maxDuration: 300 };

const DEFAULT_MODEL = 'gemini-3.1-pro-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const TARGET_HTML_BYTES = 120 * 1024;
/** Gemini fetch timeout: inside the 300s function cap, with room to
 * report the failure instead of being killed mid-stream. */
const GEMINI_TIMEOUT_MS = 280000;

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Errors whose message is safe and useful to show the teacher as-is
 * (bad files, size limits). Anything else goes through the classifiers. */
class UserError extends Error {}

/** Errors from the Gemini REST API, already classified for the teacher. */
class GeminiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function isDocx(a: WireAttachment): boolean {
  return (
    a.mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    a.name.toLowerCase().endsWith('.docx')
  );
}

function isText(a: WireAttachment): boolean {
  return a.mimeType === 'text/plain' || a.name.toLowerCase().endsWith('.txt');
}

// ---------- DOCX extraction (no dependencies) ----------
// A .docx is a ZIP; the text lives in word/document.xml as <w:t> runs.

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function docxXmlToText(xml: string): string {
  const withBreaks = xml
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<w:tab\s*\/>/gi, '\t')
    .replace(/<w:br\s*\/>/gi, '\n');
  const stripped = decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, ''));
  return stripped
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('\n');
}

/** Extract readable text from a .docx buffer. Throws on malformed input;
 * callers turn that into a warning, never a crash. Exported for local
 * testing — Vercel only uses the default export. */
export function extractDocxText(buffer: Buffer): string {
  // End of Central Directory: signature 0x06054b50, in the last 64KB+22B.
  const scanStart = Math.max(0, buffer.length - 65557);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= scanStart; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file');
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  let p = cdOffset;
  for (let n = 0; n < totalEntries; n++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(p + 10);
    const compSize = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf-8', p + 46, p + 46 + nameLen);
    if (name === 'word/document.xml') {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error('Bad local file header');
      }
      const lhNameLen = buffer.readUInt16LE(localOffset + 26);
      const lhExtraLen = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
      const comp = buffer.subarray(dataStart, dataStart + compSize);
      if (method === 8) {
        return docxXmlToText(inflateRawSync(comp).toString('utf-8'));
      }
      if (method === 0) {
        return docxXmlToText(comp.toString('utf-8'));
      }
      throw new Error(`Unsupported ZIP compression method ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('word/document.xml not found');
}

/** Split attachments into Gemini media parts + prompt notes. Throws a
 * UserError with a teacher-facing message on unsupported files or size
 * limits. */
async function prepareAttachments(
  attachments: WireAttachment[],
): Promise<{ notes: AttachmentNote[]; media: GeminiPart[]; warnings: string[] }> {
  const notes: AttachmentNote[] = [];
  const media: GeminiPart[] = [];
  const warnings: string[] = [];
  let total = 0;
  for (const a of attachments) {
    const buffer = Buffer.from(a.dataBase64, 'base64');
    total += buffer.length;
    if (buffer.length > MAX_FILE_BYTES) {
      throw new UserError(`File "${a.name}" quá lớn (tối đa 3MB mỗi file trong bản test).`);
    }
    if (total > MAX_TOTAL_BYTES) {
      throw new UserError('Tổng dung lượng file đính kèm quá lớn (tối đa 4MB trong bản test).');
    }
    if (IMAGE_MIME.has(a.mimeType)) {
      media.push({ inlineData: { mimeType: a.mimeType, data: a.dataBase64 } });
      notes.push({ kind: 'image', name: a.name });
    } else if (a.mimeType === 'application/pdf') {
      media.push({ inlineData: { mimeType: 'application/pdf', data: a.dataBase64 } });
      notes.push({ kind: 'pdf', name: a.name });
    } else if (isDocx(a)) {
      try {
        notes.push({ kind: 'document', name: a.name, text: extractDocxText(buffer) });
      } catch {
        warnings.push(`Không trích xuất được văn bản từ "${a.name}".`);
        notes.push({ kind: 'document', name: a.name, text: '(không trích xuất được văn bản)' });
      }
    } else if (isText(a)) {
      notes.push({ kind: 'document', name: a.name, text: buffer.toString('utf-8').trim() });
    } else {
      throw new UserError(
        `File "${a.name}" không thuộc loại hỗ trợ. Bản test nhận ảnh, PDF, DOCX và TXT.`,
      );
    }
  }
  return { notes, media, warnings };
}

function buildPromptText(body: AiRequestBody, notes: AttachmentNote[]): string {
  const base = {
    grade: body.grade,
    subject: body.subject,
    roleSentence: body.roleSentence,
    mode: body.mode,
    topic: body.topic,
    outline: body.outline,
    extraRequests: body.extraRequests,
    attachments: notes,
    approvedStructure: body.approvedStructure,
  };
  if (body.stage === 'propose') return buildProposePrompt(base);
  if (body.stage === 'revise') {
    return buildRevisePrompt({
      ...base,
      currentHtml: body.currentHtml ?? '',
      history: body.history ?? [],
      instruction: body.instruction ?? '',
    });
  }
  return buildLessonPrompt(base);
}

// ---------- Gemini REST streaming ----------

interface GeminiRestErrorBody {
  error?: { code?: number; message?: string; status?: string };
}

function classifyGeminiError(httpStatus: number, status: string, message: string): GeminiError {
  const hay = `${status} ${message}`;
  if (
    /API_KEY_INVALID|API key not valid|API key|PERMISSION_DENIED/i.test(hay) ||
    httpStatus === 401 ||
    httpStatus === 403
  ) {
    return new GeminiError(
      'invalid_key',
      'API key của Gemini không hợp lệ hoặc chưa được cấp quyền. Hãy kiểm tra lại key trong Vercel.',
    );
  }
  if (/RESOURCE_EXHAUSTED|quota|rate limit/i.test(hay) || httpStatus === 429) {
    return new GeminiError(
      'rate_limited',
      'Gemini đang giới hạn lượt gọi (hết quota hoặc quá nhiều request). Hãy đợi một lúc rồi thử lại.',
    );
  }
  if (/NOT_FOUND/i.test(status) || httpStatus === 404) {
    return new GeminiError(
      'bad_model',
      'Tên model Gemini không đúng hoặc chưa khả dụng. Hãy kiểm tra GEMINI_MODEL trong Vercel.',
    );
  }
  const detail = message !== '' ? ` Gemini báo: ${message.slice(0, 200)}` : '';
  return new GeminiError(
    'generation_failed',
    `Không tạo được bài học.${detail} Hãy thử lại; nếu vẫn lỗi, hãy rút ngắn dàn ý hoặc tài liệu đính kèm.`,
  );
}

async function geminiErrorFromResponse(res: Response): Promise<GeminiError> {
  let status = '';
  let message = '';
  try {
    const data = (await res.json()) as GeminiRestErrorBody;
    status = data.error?.status ?? '';
    message = data.error?.message ?? '';
  } catch {
    // Keep the HTTP status as the only signal.
  }
  return classifyGeminiError(res.status, status, message);
}

interface GeminiStreamEvent {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  error?: { code?: number; message?: string; status?: string };
}

/** Stream one generation from the Gemini REST API, forwarding text chunks
 * as they arrive. Throws GeminiError on API failures. */
async function callGeminiStream(args: {
  apiKey: string;
  model: string;
  parts: GeminiPart[];
  maxOutputTokens: number;
  onChunk: (text: string) => void;
}): Promise<{ text: string; finishReason: string }> {
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(args.model)}:streamGenerateContent?alt=sse`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': args.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: args.parts }],
        generationConfig: { maxOutputTokens: args.maxOutputTokens },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new GeminiError(
        'timeout',
        'Gemini trả lời quá chậm (quá 280 giây). Hãy thử lại với dàn ý ngắn hơn.',
      );
    }
    throw new GeminiError('network', 'Không kết nối được tới Gemini. Hãy kiểm tra mạng rồi thử lại.');
  }
  if (!res.ok || !res.body) {
    throw await geminiErrorFromResponse(res);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let finishReason = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf('\n\n');
    while (sep >= 0) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of rawEvent.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '') continue;
        const event = JSON.parse(payload) as GeminiStreamEvent;
        if (event.error) {
          throw classifyGeminiError(
            event.error.code ?? 0,
            event.error.status ?? '',
            event.error.message ?? '',
          );
        }
        const candidate = event.candidates?.[0];
        for (const part of candidate?.content?.parts ?? []) {
          if (typeof part.text === 'string' && part.text !== '') {
            full += part.text;
            args.onChunk(part.text);
          }
        }
        if (candidate?.finishReason) finishReason = candidate.finishReason;
      }
      sep = buffer.indexOf('\n\n');
    }
  }
  return { text: full, finishReason };
}

// ---------- Output validation (the automated checks) ----------

/** Pull the HTML document out of the raw model output. Models sometimes
 * wrap it in a markdown fence despite the contract; unwrap leniently. */
function extractHtml(raw: string): { html: string; fenced: boolean } {
  const fence = raw.match(/```html\s*([\s\S]*?)```/i) ?? raw.match(/```\s*([\s\S]*?)```/);
  if (fence) return { html: fence[1].trim(), fenced: true };
  return { html: raw.trim(), fenced: false };
}

const HARD_CHECKS: { rule: string; pattern: RegExp }[] = [
  { rule: 'Không dùng <script src> (JS ngoài)', pattern: /<script[^>]+src\s*=/i },
  { rule: 'Không dùng fetch/XHR/WebSocket', pattern: /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket\s*\(/i },
  { rule: 'Không dùng localStorage/sessionStorage/cookie', pattern: /localStorage|sessionStorage|document\.cookie/i },
  { rule: 'Không dùng eval/Function/document.write', pattern: /\beval\s*\(|new\s+Function\s*\(|document\.write/i },
  { rule: 'Không mở cửa sổ/link ngoài', pattern: /window\.open|target\s*=\s*["']_blank["']/i },
  { rule: 'Không dùng <form> (submit)', pattern: /<form[\s>]/i },
  { rule: 'Không dùng <iframe> lồng nhau', pattern: /<iframe[\s>]/i },
  { rule: 'Không dùng ảnh ngoài', pattern: /<img[^>]+src\s*=\s*["']https?:/i },
];

function hardViolations(html: string): Violation[] {
  const found: Violation[] = [];
  if (!/<html[\s>]/i.test(html) || !/<\/html\s*>/i.test(html)) {
    found.push({ rule: 'Thiếu tài liệu HTML hoàn chỉnh', detail: 'Không tìm thấy cặp thẻ <html>...</html>.' });
  }
  for (const check of HARD_CHECKS) {
    if (check.pattern.test(html)) found.push({ rule: check.rule, detail: 'Phát hiện trong file.' });
  }
  // External <link> tags: only Google Fonts stylesheets are allowed.
  const linkHrefs = [...html.matchAll(/<link[^>]+href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const href of linkHrefs) {
    if (
      /^https?:\/\//i.test(href) &&
      !href.startsWith('https://fonts.googleapis.com/') &&
      !href.startsWith('https://fonts.gstatic.com/')
    ) {
      found.push({ rule: 'Không dùng tài nguyên ngoài (trừ Google Fonts)', detail: href });
    }
  }
  return found;
}

interface Violation {
  rule: string;
  detail: string;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title\s*>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

/** Leading HTML comments (assumptions / verification notes the prompt
 * asks the model to record at the top of the file). */
function extractLeadingComments(html: string): string[] {
  const head = html.slice(0, 3000);
  return [...head.matchAll(/<!--([\s\S]*?)-->/g)]
    .map((m) => m[1].trim())
    .filter((c) => c !== '');
}

// ---------- Streaming ----------

type SseEvent = Record<string, unknown>;

function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Chỉ hỗ trợ POST.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonError(
      503,
      'missing_key',
      'Chưa cấu hình GEMINI_API_KEY. Hãy thêm API key của Gemini vào Environment Variables trong Vercel rồi deploy lại.',
    );
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 4.5 * 1024 * 1024) {
    return jsonError(413, 'too_large', 'Yêu cầu quá lớn (tối đa 4MB file đính kèm trong bản test).');
  }

  let body: AiRequestBody;
  try {
    body = (await req.json()) as AiRequestBody;
  } catch {
    return jsonError(400, 'bad_json', 'Nội dung gửi lên không phải JSON hợp lệ.');
  }

  if (!['propose', 'generate', 'revise'].includes(body.stage)) {
    return jsonError(400, 'bad_stage', 'Thiếu hoặc sai trường stage.');
  }
  if (!Number.isInteger(body.grade) || body.grade < 1 || body.grade > 12) {
    return jsonError(400, 'bad_grade', 'Khối phải từ 1 đến 12.');
  }
  if (!body.subject || !body.roleSentence) {
    return jsonError(400, 'bad_input', 'Thiếu môn học hoặc câu vai trò.');
  }
  if (body.stage === 'revise' && (!body.currentHtml || !body.instruction?.trim())) {
    return jsonError(400, 'bad_input', 'Sửa bài cần có file hiện tại và yêu cầu sửa.');
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SseEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const fail = (code: string, message: string) => {
        send({ type: 'error', code, message });
        controller.close();
      };
      try {
        const { notes, media, warnings } = await prepareAttachments(body.attachments ?? []);
        const promptText = buildPromptText(body, notes);
        const maxOutputTokens = body.stage === 'propose' ? 2048 : 65536;

        // One generation attempt; on hard contract violations, one retry
        // with the violations named so the model can fix them.
        for (let attempt = 0; attempt < 2; attempt++) {
          const textPart =
            attempt === 0
              ? promptText
              : `${promptText}\n\nLƯU Ý SỬA LỖI: bản xuất trước đã vi phạm các quy tắc hợp đồng output. Hãy xuất lại toàn bộ file, sửa đúng các vi phạm đó, giữ nguyên mọi thứ khác.`;
          const { text: raw, finishReason } = await callGeminiStream({
            apiKey,
            model,
            parts: [{ text: textPart }, ...media],
            maxOutputTokens,
            onChunk: (chunkText) => send({ type: 'chunk', text: chunkText }),
          });

          if (body.stage === 'propose') {
            send({ type: 'done', text: raw.trim(), warnings });
            controller.close();
            return;
          }

          const { html, fenced } = extractHtml(raw);
          const violations = hardViolations(html);
          if (violations.length > 0 && attempt === 0) {
            send({ type: 'retry', violations: violations.map((v) => v.rule) });
            continue;
          }
          if (violations.length > 0) {
            fail(
              'validation',
              `Bài AI tạo ra vi phạm hợp đồng output (${violations.map((v) => v.rule).join('; ')}). Hãy thử lại hoặc sửa yêu cầu.`,
            );
            return;
          }

          const resultWarnings = [...warnings];
          if (fenced) {
            resultWarnings.push('AI đã bọc file trong khối markdown; hệ thống đã tự gỡ bỏ.');
          }
          const byteSize = new TextEncoder().encode(html).length;
          if (byteSize > TARGET_HTML_BYTES) {
            resultWarnings.push(
              `File dài ${Math.round(byteSize / 1024)}KB, vượt mục tiêu 120KB. Bài vẫn dùng được, nhưng lần sửa sau nên yêu cầu gọn lại.`,
            );
          }
          if (finishReason === 'MAX_TOKENS') {
            resultWarnings.push('AI đã chạm giới hạn độ dài output; hãy kiểm tra kỹ cuối bài có bị cắt không.');
          }
          send({
            type: 'done',
            html,
            title: extractTitle(html),
            assumptions: extractLeadingComments(html),
            warnings: resultWarnings,
            byteSize,
          });
          controller.close();
          return;
        }
      } catch (err) {
        console.error('ai-soan-bai failed:', err);
        const outcome =
          err instanceof UserError
            ? { code: 'bad_input', message: err.message }
            : err instanceof GeminiError
              ? { code: err.code, message: err.message }
              : {
                  code: 'generation_failed',
                  message:
                    'Không tạo được bài học. Hãy thử lại; nếu vẫn lỗi, hãy rút ngắn dàn ý hoặc tài liệu đính kèm.',
                };
        try {
          fail(outcome.code, outcome.message);
        } catch {
          // Stream already closed (e.g. client disconnected).
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

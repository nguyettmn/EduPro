// AI Soạn bài backend: one Vercel serverless function that calls Gemini
// with the assembled prompt. The API key lives ONLY here (server-side env
// var GEMINI_API_KEY) — the browser never sees it.
//
// POST /api/ai-soan-bai  (JSON body, see AiRequest below)
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
import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import {
  buildLessonPrompt,
  buildProposePrompt,
  buildRevisePrompt,
} from '../src/ai/prompt';
import type { AttachmentNote } from '../src/ai/prompt';
import type { AiRequestBody, WireAttachment } from '../src/ai/apiTypes';

export const config = { maxDuration: 300 };

const DEFAULT_MODEL = 'gemini-3.1-pro-preview';
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const TARGET_HTML_BYTES = 120 * 1024;

interface MediaPart {
  inlineData: { mimeType: string; data: string };
}

type Violation = { rule: string; detail: string };

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Errors whose message is safe and useful to show the teacher as-is
 * (bad files, size limits). Anything else goes through classifyError. */
class UserError extends Error {}

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

async function extractDocxText(buffer: Buffer): Promise<string> {
  const lib = mammoth as unknown as {
    extractRawText?: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    default?: { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> };
  };
  const fn = lib.extractRawText ?? lib.default?.extractRawText;
  if (!fn) throw new Error('DOCX extractor unavailable');
  const result = await fn({ buffer });
  return result.value;
}

/** Split attachments into Gemini media parts + prompt notes. Throws an
 * Error with a user-facing message on unsupported files or size limits. */
async function prepareAttachments(
  attachments: WireAttachment[],
): Promise<{ notes: AttachmentNote[]; media: MediaPart[]; warnings: string[] }> {
  const notes: AttachmentNote[] = [];
  const media: MediaPart[] = [];
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
        const text = await extractDocxText(buffer);
        notes.push({ kind: 'document', name: a.name, text: text.trim() });
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

function classifyError(err: unknown): { code: string; message: string } {
  const text = err instanceof Error ? err.message : String(err);
  if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(text)) {
    return {
      code: 'rate_limited',
      message: 'Gemini đang giới hạn lượt gọi (hết quota hoặc quá nhiều request). Hãy đợi một lúc rồi thử lại.',
    };
  }
  if (/API key|API_KEY|401|403|PERMISSION_DENIED/i.test(text)) {
    return {
      code: 'invalid_key',
      message: 'API key của Gemini không hợp lệ hoặc chưa được cấp quyền. Hãy kiểm tra lại key trong Vercel.',
    };
  }
  if (/model|not found|NOT_FOUND/i.test(text)) {
    return {
      code: 'bad_model',
      message: 'Tên model Gemini không đúng hoặc chưa khả dụng. Hãy kiểm tra GEMINI_MODEL trong Vercel.',
    };
  }
  return {
    code: 'generation_failed',
    message: 'Không tạo được bài học. Hãy thử lại; nếu vẫn lỗi, hãy rút ngắn dàn ý hoặc tài liệu đính kèm.',
  };
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
  const ai = new GoogleGenAI({ apiKey });
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
        const contents = [
          {
            role: 'user' as const,
            parts: [{ text: promptText }, ...media],
          },
        ];
        const maxOutputTokens = body.stage === 'propose' ? 2048 : 65536;

        // One generation attempt; on hard contract violations, one retry
        // with the violations named so the model can fix them.
        for (let attempt = 0; attempt < 2; attempt++) {
          const attemptContents =
            attempt === 0
              ? contents
              : [
                  {
                    role: 'user' as const,
                    parts: [
                      {
                        text: `${promptText}\n\nLƯU Ý SỬA LỖI: bản xuất trước đã vi phạm các quy tắc hợp đồng output. Hãy xuất lại toàn bộ file, sửa đúng các vi phạm đó, giữ nguyên mọi thứ khác.`,
                      },
                      ...media,
                    ],
                  },
                ];
          const response = await ai.models.generateContentStream({
            model,
            contents: attemptContents,
            config: { maxOutputTokens },
          });

          let raw = '';
          let finishReason = '';
          for await (const chunk of response) {
            const text = chunk.text ?? '';
            if (text !== '') {
              raw += text;
              send({ type: 'chunk', text });
            }
            const reason = chunk.candidates?.[0]?.finishReason;
            if (reason) finishReason = String(reason);
          }

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
        const { code, message } =
          err instanceof UserError
            ? { code: 'bad_input', message: err.message }
            : classifyError(err);
        try {
          fail(code, message);
        } catch {
          // Stream already closed (e.g. client disconnected).
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

// Diagnostic endpoint: carries the same "risky" ingredients as
// api/ai-soan-bai.ts (a config export, an import from ../src/ai, and a
// node:zlib import) behind a trivial handler. If this 500s, the crash is
// in one of those ingredients; if it returns 200, the crash is in
// ai-soan-bai's own handler logic. Remove once diagnosed.
import { inflateRawSync } from 'node:zlib';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildLessonPrompt } from '../src/ai/prompt';

export const config = { maxDuration: 300 };

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const promptLen = buildLessonPrompt({
    grade: 5,
    subject: 'Toán',
    roleSentence: 'x',
    mode: 'auto',
    topic: '',
    outline: '',
    extraRequests: '',
    attachments: [],
  }).length;
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      ok: true,
      promptLen,
      zlibOk: typeof inflateRawSync === 'function',
      method: req.method ?? null,
    }),
  );
}

// Diagnostic: config export + import from ../src/ai, no zlib, no type
// imports. Remove once diagnosed.
import { buildLessonPrompt } from '../src/ai/prompt';

export const config = { maxDuration: 300 };

interface NodeReq {
  method?: string;
}

interface NodeRes {
  writeHead: (status: number, headers: Record<string, string>) => void;
  end: (chunk?: string) => void;
}

export default function handler(req: NodeReq, res: NodeRes): void {
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
  res.end(JSON.stringify({ ok: true, promptLen, method: req.method ?? null }));
}

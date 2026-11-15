// Diagnostic: ./_lib/prompt import ONLY — no config, no zlib, no type
// imports. Remove once diagnosed.
import { buildLessonPrompt } from './_lib/prompt';

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

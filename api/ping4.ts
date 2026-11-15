// Diagnostic: node:zlib import only — no config, no ../src imports, no
// type imports. Remove once diagnosed.
import { inflateRawSync } from 'node:zlib';

interface NodeReq {
  method?: string;
}

interface NodeRes {
  writeHead: (status: number, headers: Record<string, string>) => void;
  end: (chunk?: string) => void;
}

export default function handler(req: NodeReq, res: NodeRes): void {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      ok: true,
      zlibOk: typeof inflateRawSync === 'function',
      method: req.method ?? null,
    }),
  );
}

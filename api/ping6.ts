// Diagnostic: config export ONLY — no imports at all. Remove once
// diagnosed.
export const config = { maxDuration: 300 };

interface NodeReq {
  method?: string;
}

interface NodeRes {
  writeHead: (status: number, headers: Record<string, string>) => void;
  end: (chunk?: string) => void;
}

export default function handler(req: NodeReq, res: NodeRes): void {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, method: req.method ?? null }));
}

// Minimal health endpoint: proves that Vercel functions deploy and run
// on this project, independent of the AI function. No imports, no config.
//
// Uses the classic Node (req, res) signature with plain ServerResponse
// primitives on purpose: the Web Request/Response signature hung without
// responding on this project (observed 2026-11-15: GET /api/ping timed
// out with 0 bytes), so functions here use Node style.
interface NodeReq {
  method?: string;
}

interface NodeRes {
  writeHead: (status: number, headers: Record<string, string>) => void;
  end: (chunk?: string) => void;
}

export default function handler(req: NodeReq, res: NodeRes): void {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true }));
}

// Invite by email: the server-side half of "add by email" (teachers add
// students to a class; principals add teachers to their school). The
// browser cannot do this alone: creating an auth user and sending the
// invite email needs the service-role key, which must never reach the
// browser.
//
// POST /api/invite  { email, name?, role: 'student'|'teacher', classId? }
//   Authorization: Bearer <the caller's Supabase JWT>
// Responds { ok: true, status: 'invited' | 'added', userId }.
//
// Behaviour: the caller's JWT is verified and their permission to invite
// into the target class/school is checked against the same rules the app
// uses (class owner, school principal, or team lead). If the email
// already belongs to an account, that account is simply placed in the
// class (the placement trigger activates a pending student). Otherwise
// Supabase sends an invite email and the new account is created with
// invited=true, so it starts active; the auth trigger files the profile
// (role/school/team) from the invite metadata.
//
// SELF-CONTAINED FILE — the same rule as api/ai-soan-bai.ts: zero imports
// from other project files (local imports crash invocations on this
// project), Node (req, res) handler, global fetch only.

interface NodeReq extends AsyncIterable<Buffer> {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface NodeRes {
  writeHead: (status: number, headers: Record<string, string>) => void;
  write: (chunk: string) => boolean;
  end: (chunk?: string) => void;
}

function sendJson(res: NodeRes, status: number, code: string, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: code, message }));
}

function sendOk(res: NodeRes, payload: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req: NodeReq): Promise<string> {
  const preParsed = req.body;
  if (typeof preParsed === 'string' && preParsed !== '') return preParsed;
  if (preParsed !== undefined && preParsed !== null && typeof preParsed === 'object') {
    return JSON.stringify(preParsed);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

interface SupabaseEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

function readEnv(): SupabaseEnv | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !anonKey || !serviceKey) return null;
  return { url, anonKey, serviceKey };
}

/** Verify the caller's JWT with Supabase Auth; returns the user id. */
async function verifyCaller(env: SupabaseEnv, req: NodeReq): Promise<string | null> {
  const header = req.headers.authorization;
  const token =
    typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const res = await fetch(`${env.url}/auth/v1/user`, {
      headers: { apikey: env.anonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: unknown };
    return typeof data.id === 'string' ? data.id : null;
  } catch {
    return null;
  }
}

function serviceHeaders(env: SupabaseEnv): Record<string, string> {
  return {
    apikey: env.serviceKey,
    Authorization: `Bearer ${env.serviceKey}`,
    'Content-Type': 'application/json',
  };
}

type JsonRow = Record<string, unknown>;

async function restGet(
  env: SupabaseEnv,
  path: string,
): Promise<JsonRow[] | null> {
  try {
    const res = await fetch(`${env.url}/rest/v1/${path}`, {
      headers: serviceHeaders(env),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as JsonRow[]) : null;
  } catch {
    return null;
  }
}

async function restPost(
  env: SupabaseEnv,
  path: string,
  body: unknown,
): Promise<boolean> {
  try {
    const res = await fetch(`${env.url}/rest/v1/${path}`, {
      method: 'POST',
      headers: { ...serviceHeaders(env), Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: NodeReq, res: NodeRes): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, 'method_not_allowed', 'Chỉ hỗ trợ POST.');
    return;
  }

  const env = readEnv();
  if (!env) {
    sendJson(
      res,
      503,
      'missing_config',
      'Chưa cấu hình Supabase phía máy chủ. Hãy thêm các biến môi trường vào Vercel rồi deploy lại.',
    );
    return;
  }

  const callerId = await verifyCaller(env, req);
  if (!callerId) {
    sendJson(res, 401, 'unauthorized', 'Bạn cần đăng nhập để mời thêm người.');
    return;
  }

  let body: { email?: unknown; name?: unknown; role?: unknown; classId?: unknown };
  try {
    body = JSON.parse(await readRequestBody(req)) as typeof body;
  } catch {
    sendJson(res, 400, 'bad_json', 'Nội dung gửi lên không phải JSON hợp lệ.');
    return;
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const name =
    typeof body.name === 'string' && body.name.trim() !== ''
      ? body.name.trim()
      : email.split('@')[0] ?? '';
  const role = body.role === 'teacher' ? 'teacher' : body.role === 'student' ? 'student' : '';
  const classId = typeof body.classId === 'string' && body.classId !== '' ? body.classId : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || role === '') {
    sendJson(res, 400, 'bad_input', 'Email hoặc vai trò chưa đúng.');
    return;
  }

  const callerRows = await restGet(env, `profiles?select=id,role,school_id,team_id&id=eq.${callerId}`);
  const caller = callerRows?.[0];
  if (!caller) {
    sendJson(res, 403, 'forbidden', 'Không tìm thấy hồ sơ của bạn.');
    return;
  }

  // ---- Permission check + invite metadata (mirrors the app model) ----
  let schoolId: string | null = null;
  let teamId: string | null = null;
  if (classId) {
    const classRows = await restGet(
      env,
      `classes?select=id,school_id,team_id,teacher_id&id=eq.${encodeURIComponent(classId)}`,
    );
    const cls = classRows?.[0];
    if (!cls) {
      sendJson(res, 404, 'not_found', 'Không tìm thấy lớp học này.');
      return;
    }
    const isOwner = cls.teacher_id === callerId;
    const isPrincipal =
      caller.role === 'principal' &&
      typeof cls.school_id === 'string' &&
      cls.school_id === caller.school_id;
    const isLead =
      caller.role === 'lead' &&
      typeof cls.team_id === 'string' &&
      cls.team_id === caller.team_id;
    if (!isOwner && !isPrincipal && !isLead) {
      sendJson(res, 403, 'forbidden', 'Bạn không có quyền thêm người vào lớp này.');
      return;
    }
    schoolId = typeof cls.school_id === 'string' ? cls.school_id : null;
    teamId = typeof cls.team_id === 'string' ? cls.team_id : null;
  } else {
    // School-level invite: the principal adding a teacher to their school.
    if (caller.role !== 'principal' || role !== 'teacher' || typeof caller.school_id !== 'string') {
      sendJson(res, 403, 'forbidden', 'Chỉ hiệu trưởng mới mời được giáo viên vào trường.');
      return;
    }
    schoolId = caller.school_id;
  }

  // ---- Find-or-invite ----
  const existing = await restGet(
    env,
    `profiles?select=id&email=eq.${encodeURIComponent(email)}`,
  );
  let userId: string | null =
    existing && existing.length > 0 && typeof existing[0].id === 'string'
      ? (existing[0].id as string)
      : null;
  let status: 'invited' | 'added' = 'added';

  if (!userId) {
    const metadata: Record<string, unknown> = { name, role, invited: 'true' };
    if (schoolId) metadata.school_id = schoolId;
    if (teamId) metadata.team_id = teamId;
    let inviteRes: Response | null = null;
    try {
      inviteRes = await fetch(`${env.url}/auth/v1/invite`, {
        method: 'POST',
        headers: serviceHeaders(env),
        body: JSON.stringify({ email, data: metadata }),
      });
    } catch {
      inviteRes = null;
    }
    if (!inviteRes || !inviteRes.ok) {
      sendJson(
        res,
        502,
        'invite_failed',
        'Không gửi được email mời. Hãy kiểm tra lại email rồi thử lại.',
      );
      return;
    }
    const invited = (await inviteRes.json()) as { id?: unknown };
    if (typeof invited.id !== 'string') {
      sendJson(res, 502, 'invite_failed', 'Không tạo được tài khoản mời. Hãy thử lại.');
      return;
    }
    userId = invited.id;
    status = 'invited';
    // The auth trigger creates the profile row; wait briefly for it so
    // the membership insert below does not hit the foreign key early.
    for (let attempt = 0; attempt < 4; attempt++) {
      const rows = await restGet(env, `profiles?select=id&id=eq.${userId}`);
      if (rows && rows.length > 0) break;
      await sleep(300);
    }
  }

  // ---- Place in the class (the placement trigger activates a pending
  // student automatically). ----
  if (classId && userId) {
    const memberRows = await restGet(
      env,
      `class_memberships?select=class_id&class_id=eq.${encodeURIComponent(classId)}&profile_id=eq.${userId}`,
    );
    if (memberRows && memberRows.length === 0) {
      const ok = await restPost(env, 'class_memberships', {
        class_id: classId,
        profile_id: userId,
        kind: role,
      });
      if (!ok) {
        sendJson(
          res,
          502,
          'placement_failed',
          'Tài khoản đã tạo nhưng chưa xếp được vào lớp. Hãy thử thêm lại.',
        );
        return;
      }
    }
  }

  sendOk(res, { ok: true, status, userId });
}

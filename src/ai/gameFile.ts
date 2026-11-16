// Game file portability: games are single-file HTML, transported either
// as a raw .html file or as a JSON record wrapping the HTML — the same
// two shapes as the user's old Gemini game files:
//   { id, title, mechanic, theme, htmlCode, createdAt }  (library record)
//   { lessonId, htmlCode }                               (lesson-linked)
//
// Imported HTML is untrusted: it is only ever rendered in the sandboxed
// iframe (no allow-same-origin). Unlike lesson imports, game imports
// ALLOWLIST the old games' CDNs (Tailwind + Google Fonts) with a
// needs-internet flag, so the user's 6 existing files play as-is.
// External <script src> from any other host is rejected outright.

export interface ImportedGameDraft {
  title: string;
  mechanic: string;
  theme: string;
  htmlCode: string;
  /** True when the file loads anything external: needs internet to play. */
  needsInternet: boolean;
  /** True when the file had no usable metadata: title/mechanic guessed. */
  sourceMissing: boolean;
}

export interface GameImportResult {
  game: ImportedGameDraft | null;
  errors: string[];
  warnings: string[];
}

const CDN_ALLOWLIST = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function titleFromHtml(html: string): string | null {
  const m = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  const title = m?.[1]?.trim();
  return title !== '' ? (title ?? null) : null;
}

/** Check external resources in game HTML. External scripts outside the
 * CDN allowlist are rejected; any other external reference just flags
 * needs-internet (e.g. a hotlinked sound file in an old game). */
function checkExternalResources(html: string): { needsInternet: boolean; errors: string[] } {
  const errors: string[] = [];
  let needsInternet = false;
  const scriptSrcs = [...html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const src of scriptSrcs) {
    const host = hostOf(src);
    if (host === null) continue;
    if (CDN_ALLOWLIST.includes(host)) {
      needsInternet = true;
    } else {
      errors.push(`File chứa script tải từ ${host}, không nhập được vì lý do an toàn.`);
    }
  }
  const otherRefs = [...html.matchAll(/<(?:link|img|audio|video|source)[^>]+(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(
    (m) => m[1],
  );
  for (const ref of otherRefs) {
    if (/^https?:\/\//i.test(ref)) needsInternet = true;
  }
  return { needsInternet, errors };
}

function draftFromRecord(obj: unknown, filename: string): GameImportResult {
  if (typeof obj !== 'object' || obj === null) {
    return { game: null, errors: [`${filename}: không đúng định dạng file game.`], warnings: [] };
  }
  const o = obj as Record<string, unknown>;
  if (typeof o.htmlCode !== 'string' || o.htmlCode.trim() === '' || !/<html/i.test(o.htmlCode)) {
    return { game: null, errors: [`${filename}: không có nội dung game HTML hợp lệ.`], warnings: [] };
  }
  const { needsInternet, errors } = checkExternalResources(o.htmlCode);
  if (errors.length > 0) return { game: null, errors, warnings: [] };
  const title =
    (typeof o.title === 'string' && o.title.trim() !== ''
      ? o.title.trim()
      : titleFromHtml(o.htmlCode)) ?? filename.replace(/\.(json)$/i, '');
  const warnings: string[] = [];
  if (needsInternet) {
    warnings.push('Game này tải tài nguyên từ mạng (CDN) — cần có mạng mới chơi đầy đủ.');
  }
  return {
    game: {
      title,
      mechanic: typeof o.mechanic === 'string' && o.mechanic.trim() !== '' ? o.mechanic.trim() : 'Imported',
      theme: typeof o.theme === 'string' && o.theme.trim() !== '' ? o.theme.trim() : 'Custom',
      htmlCode: o.htmlCode,
      needsInternet,
      sourceMissing: typeof o.title !== 'string' || o.title.trim() === '',
    },
    errors: [],
    warnings,
  };
}

/** Parse one uploaded file (.html or .json) into a game draft. */
export function parseGameFile(text: string, filename: string): GameImportResult {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { game: null, errors: [`${filename}: file JSON không hợp lệ.`], warnings: [] };
    }
    return draftFromRecord(parsed, filename);
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    if (!/<html/i.test(text)) {
      return { game: null, errors: [`${filename}: không phải file HTML hợp lệ.`], warnings: [] };
    }
    const { needsInternet, errors } = checkExternalResources(text);
    if (errors.length > 0) return { game: null, errors, warnings: [] };
    const warnings: string[] = [];
    if (needsInternet) {
      warnings.push('Game này tải tài nguyên từ mạng (CDN) — cần có mạng mới chơi đầy đủ.');
    }
    return {
      game: {
        title: titleFromHtml(text) ?? filename.replace(/\.(html|htm)$/i, ''),
        mechanic: 'Imported',
        theme: 'Custom',
        htmlCode: text,
        needsInternet,
        sourceMissing: true,
      },
      errors: [],
      warnings,
    };
  }
  return { game: null, errors: [`${filename}: chỉ nhận file .html hoặc .json.`], warnings: [] };
}

/** Serialize a game as the library-record JSON shape (the old files' shape). */
export function buildGameExport(game: {
  id: string;
  title: string;
  mechanic: string;
  theme: string;
  htmlCode: string;
  createdAt: string;
}): string {
  return JSON.stringify(
    {
      id: game.id,
      title: game.title,
      mechanic: game.mechanic,
      theme: game.theme,
      htmlCode: game.htmlCode,
      createdAt: Date.parse(game.createdAt) || Date.now(),
    },
    null,
    2,
  );
}

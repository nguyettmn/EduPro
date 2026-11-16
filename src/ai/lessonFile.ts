// Lesson file portability (user decision 2026-11-16): a lesson can be
// downloaded as ONE file and re-uploaded later to keep working on it.
//
// - HTML lessons download as a single .html file with the editable JSON
//   source embedded in a <script type="application/json"> block. Any
//   browser opens it as the lesson; EduPro re-import reads the embedded
//   source and restores the lesson's metadata and generation inputs.
//   A file without a usable embedded source still imports (view-only
//   metadata: title from <title>, no grade/subject/topic).
// - Section lessons (and whole subjects) download as JSON:
//   { format: 'edupro-subject', version: 1, grade, subject, lessons: [...] }.
//
// Imported HTML is untrusted: it is only ever rendered in the sandboxed
// iframe (no allow-same-origin), and files with external <script src>
// are rejected outright.
import type { Lesson } from '../types';

export const LESSON_SOURCE_ID = 'edupro-lesson-source';
export const LESSON_FORMAT = 'edupro-lesson';
export const SUBJECT_FORMAT = 'edupro-subject';

export interface LessonSourceJson {
  format: 'edupro-lesson';
  version: 1;
  title: string;
  grade?: number;
  subject?: string;
  topic?: string;
  outline?: string;
  roleSentence?: string;
  extraRequests?: string;
  exportedAt: string;
}

export interface ImportedLessonDraft {
  title: string;
  html?: string;
  sections?: Lesson['sections'];
  questionIds?: string[];
  topicIds?: string[];
  color?: string;
  grade?: number;
  subject?: string;
  topic?: string;
  outline?: string;
  roleSentence?: string;
  extraRequests?: string;
  /** True when the file had no usable embedded source: metadata guessed. */
  sourceMissing: boolean;
}

export interface ImportResult {
  lessons: ImportedLessonDraft[];
  errors: string[];
}

function safeJson(value: unknown): string {
  // Escape "<" so a "</script>" inside teacher text cannot break out of
  // the embedding script block.
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Build the embedded source JSON for a lesson from its stored fields. */
export function sourceJsonFor(lesson: Lesson): LessonSourceJson {
  return {
    format: LESSON_FORMAT,
    version: 1,
    title: lesson.title,
    ...(lesson.grade !== undefined ? { grade: lesson.grade } : {}),
    ...(lesson.subject ? { subject: lesson.subject } : {}),
    ...(lesson.topic ? { topic: lesson.topic } : {}),
    ...(lesson.outline ? { outline: lesson.outline } : {}),
    ...(lesson.roleSentence ? { roleSentence: lesson.roleSentence } : {}),
    ...(lesson.extraRequests ? { extraRequests: lesson.extraRequests } : {}),
    exportedAt: new Date().toISOString(),
  };
}

/** Embed the source JSON into an HTML lesson file, before </body>. */
export function embedSourceJson(html: string, source: LessonSourceJson): string {
  const script = `<script type="application/json" id="${LESSON_SOURCE_ID}">${safeJson(source)}</script>`;
  const idx = html.lastIndexOf('</body>');
  if (idx >= 0) return `${html.slice(0, idx)}${script}\n${html.slice(idx)}`;
  return `${html}\n${script}\n`;
}

/** Pull the embedded source JSON out of an HTML file (if any) and return
 * the HTML with the embedding block removed. */
export function extractSourceJson(html: string): {
  source: LessonSourceJson | null;
  cleanHtml: string;
} {
  const re = new RegExp(
    `<script[^>]*id="${LESSON_SOURCE_ID}"[^>]*>([\\s\\S]*?)<\\/script>`,
    'i',
  );
  const m = re.exec(html);
  if (!m) return { source: null, cleanHtml: html };
  let source: LessonSourceJson | null = null;
  try {
    const parsed = JSON.parse(m[1]) as Partial<LessonSourceJson>;
    if (parsed && parsed.format === LESSON_FORMAT && typeof parsed.title === 'string') {
      source = parsed as LessonSourceJson;
    }
  } catch {
    // Corrupt source: fall through to a source-less import.
  }
  return { source, cleanHtml: html.replace(m[0], '') };
}

function titleFromHtml(html: string): string | null {
  const m = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  const title = m?.[1]?.trim();
  return title !== '' ? (title ?? null) : null;
}

function draftFromLessonObject(obj: unknown): ImportedLessonDraft | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.title !== 'string' || o.title.trim() === '') return null;
  const hasSections = Array.isArray(o.sections);
  const hasHtml = typeof o.html === 'string' && o.html.trim() !== '';
  if (!hasSections && !hasHtml) return null;
  const draft: ImportedLessonDraft = { title: o.title.trim(), sourceMissing: false };
  if (hasHtml) draft.html = o.html as string;
  if (hasSections) draft.sections = o.sections as Lesson['sections'];
  if (Array.isArray(o.questionIds)) draft.questionIds = o.questionIds.filter((x): x is string => typeof x === 'string');
  if (Array.isArray(o.topicIds)) draft.topicIds = o.topicIds.filter((x): x is string => typeof x === 'string');
  if (typeof o.color === 'string') draft.color = o.color;
  if (typeof o.grade === 'number' && Number.isInteger(o.grade)) draft.grade = o.grade;
  if (typeof o.subject === 'string') draft.subject = o.subject;
  if (typeof o.topic === 'string') draft.topic = o.topic;
  if (typeof o.outline === 'string') draft.outline = o.outline;
  if (typeof o.roleSentence === 'string') draft.roleSentence = o.roleSentence;
  if (typeof o.extraRequests === 'string') draft.extraRequests = o.extraRequests;
  return draft;
}

/** Parse one uploaded file (.html or .json) into lesson drafts. */
export function parseLessonFile(text: string, filename: string): ImportResult {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { lessons: [], errors: [`${filename}: file JSON không hợp lệ.`] };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { lessons: [], errors: [`${filename}: không đúng định dạng file bài học.`] };
    }
    const o = parsed as Record<string, unknown>;
    if (o.format !== SUBJECT_FORMAT || !Array.isArray(o.lessons)) {
      return { lessons: [], errors: [`${filename}: không phải file JSON Môn của EduPro.`] };
    }
    const lessons: ImportedLessonDraft[] = [];
    const errors: string[] = [];
    o.lessons.forEach((item, i) => {
      const draft = draftFromLessonObject(item);
      if (draft) lessons.push(draft);
      else errors.push(`${filename}: bài thứ ${i + 1} thiếu tiêu đề hoặc nội dung, đã bỏ qua.`);
    });
    return { lessons, errors };
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    if (/<script[^>]+src\s*=/i.test(text)) {
      return {
        lessons: [],
        errors: [`${filename}: file chứa script tải từ bên ngoài, không nhập được vì lý do an toàn.`],
      };
    }
    const { source, cleanHtml } = extractSourceJson(text);
    if (!/<html/i.test(cleanHtml)) {
      return { lessons: [], errors: [`${filename}: không phải file HTML hợp lệ.`] };
    }
    const title = source?.title ?? titleFromHtml(cleanHtml) ?? filename.replace(/\.(html|htm)$/i, '');
    return {
      lessons: [
        {
          title,
          html: cleanHtml,
          grade: source?.grade,
          subject: source?.subject,
          topic: source?.topic,
          outline: source?.outline,
          roleSentence: source?.roleSentence,
          extraRequests: source?.extraRequests,
          sourceMissing: source === null,
        },
      ],
      errors: [],
    };
  }
  return { lessons: [], errors: [`${filename}: chỉ nhận file .html hoặc .json.`] };
}

/** Serialize lessons as one subject JSON file. */
export function buildSubjectExport(
  lessons: Lesson[],
  grade: number | null,
  subject: string | null,
): string {
  return JSON.stringify(
    {
      format: SUBJECT_FORMAT,
      version: 1,
      grade,
      subject,
      exportedAt: new Date().toISOString(),
      lessons: lessons.map((l) => ({
        title: l.title,
        topicIds: l.topicIds,
        color: l.color,
        sections: l.sections,
        questionIds: l.questionIds,
        ...(l.html ? { html: l.html } : {}),
        ...(l.grade !== undefined ? { grade: l.grade } : {}),
        ...(l.subject ? { subject: l.subject } : {}),
        ...(l.topic ? { topic: l.topic } : {}),
        ...(l.outline ? { outline: l.outline } : {}),
        ...(l.roleSentence ? { roleSentence: l.roleSentence } : {}),
        ...(l.extraRequests ? { extraRequests: l.extraRequests } : {}),
      })),
    },
    null,
    2,
  );
}

export function downloadTextFile(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function safeFilename(title: string, ext: string): string {
  const base = title.trim() !== '' ? title.trim() : 'bai-hoc';
  return `${base.replace(/[\\/:*?"<>|]/g, '_')}.${ext}`;
}

/** Extract readable text from lesson HTML for exercise generation:
 * drop scripts/styles, keep visible text, collapse whitespace, cap length. */
export function lessonTextFromHtml(html: string, maxChars = 12000): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
  const text = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

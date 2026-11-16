// Studio: one lesson workspace. Compose on COPIES (never edit someone
// else's original), and assign any lesson to a class or to individual
// students, from the lesson. Kho bài chuẩn and Trong phạm vi quản lý
// are standalone sidebar views (KhoBaiChuanView, ManagedView).
import { useEffect, useRef, useState } from 'react';
import type { Account, Lesson, LessonSection } from '../types';
import { GRADES, SUBJECTS_BY_GRADE } from '../ai/subjects';
import {
  buildSubjectExport,
  downloadTextFile,
  embedSourceJson,
  parseLessonFile,
  safeFilename,
  sourceJsonFor,
} from '../ai/lessonFile';
import { visibleClasses, visibleStudents } from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import type { Route } from '../route';
import { MathExpr } from './Fraction';
import { HtmlLessonPlayer } from './HtmlLessonPlayer';
import { AiStudio } from './AiStudio';
import { BatchPlanner, type BatchItem } from './BatchPlanner';
import { LessonExerciseSection } from './ExerciseStudio';
import { EmptyState, SectionBand } from './ui';

const BLANK_SECTION = (id: string): LessonSection => ({
  id,
  title: 'Phần mới',
  example: [[{ k: 't', s: 'Ví dụ mẫu sẽ được thêm ở bản thiết kế lại.' }]],
  steps: ['Bước 1: viết hướng dẫn ở đây.'],
});

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const plusDays = (n: number): string =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export function AssignSheet({
  account,
  lesson,
  go,
  onBack,
}: {
  account: Account;
  lesson: Lesson;
  go: (route: Route) => void;
  onBack: () => void;
}) {
  const { state, dispatch } = useStore();
  const classes = visibleClasses(account, state.classes);
  const [scope, setScope] = useState<'class' | 'students'>('class');
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState(`Luyện tập: ${lesson.title}`);
  const [dueDate, setDueDate] = useState(plusDays(7));
  const [attempts, setAttempts] = useState(2);
  const [done, setDone] = useState<{ className: string; count: number } | null>(null);

  const classStudents = visibleStudents(account, state.accounts).filter((s) =>
    s.classIds.includes(classId),
  );
  const className = state.classes.find((c) => c.id === classId)?.name ?? '';

  if (done) {
    return (
      <div>
        <p className="notice">
          Đã giao cho {done.className} ({done.count} học sinh).
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => go({ view: 'classes', classId })}
          >
            Xem tiến độ lớp
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Xong
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="btn btn-ghost" onClick={onBack}>
        ← Quay lại soạn bài
      </button>
      <div className="form-card">
        <h3 className="subhead">Giao bài: {lesson.title}</h3>
        <div className="field">
          <span>Giao cho</span>
          <label className="check-row">
            <input
              type="radio"
              name="assign-scope"
              checked={scope === 'class'}
              onChange={() => setScope('class')}
            />
            <span>Cả lớp</span>
          </label>
          <label className="check-row">
            <input
              type="radio"
              name="assign-scope"
              checked={scope === 'students'}
              onChange={() => setScope('students')}
            />
            <span>Học sinh riêng</span>
          </label>
        </div>
        <label className="field">
          <span>Lớp</span>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSelectedIds([]);
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {scope === 'students' ? (
          <div className="field">
            <span>Chọn học sinh</span>
            {classStudents.length === 0 ? (
              <p className="guide-text">Lớp này chưa có học sinh nào.</p>
            ) : (
              <div className="check-list">
                {classStudents.map((s) => (
                  <label key={s.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                        )
                      }
                    />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedIds.length === 0 ? (
              <p className="guide-text">Chọn ít nhất một học sinh.</p>
            ) : null}
          </div>
        ) : null}
        <label className="field">
          <span>Tiêu đề</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Hạn nộp</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Số lần làm tối đa</span>
            <input
              type="number"
              min={1}
              max={5}
              value={attempts}
              onChange={(e) => setAttempts(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={classId === '' || (scope === 'students' && selectedIds.length === 0)}
          onClick={() => {
            dispatch({
              type: 'CREATE_ASSIGNMENT',
              assignment: {
                id: `ASG-${Date.now()}`,
                lessonId: lesson.id,
                title: title.trim() !== '' ? title.trim() : `Luyện tập: ${lesson.title}`,
                classId,
                ...(scope === 'students' ? { studentIds: selectedIds } : {}),
                createdBy: account.id,
                dueDate,
                attemptsAllowed: attempts,
                status: 'active',
                createdAt: todayIso(),
              },
            });
            setDone({
              className,
              count: scope === 'students' ? selectedIds.length : classStudents.length,
            });
          }}
        >
          Giao bài
        </button>
      </div>
    </div>
  );
}

// ---------- "Bài của tôi" filing: Khối → Môn → Topic ----------
// A lesson files under its own grade/subject/topic fields when set. Pack
// copies inherit the Pack's grade/subject and their first Pack topic.
// Anything without that information files under "Chưa xếp …" so the
// teacher can file it from the editor pane.

interface Filing {
  grade: number | null;
  subject: string | null;
  topic: string | null;
  gradeKey: string;
  gradeLabel: string;
  gradeSort: number;
  subjectKey: string;
  subjectLabel: string;
  topicKey: string;
  topicLabel: string;
}

function filingOf(lesson: Lesson): Filing {
  const pack = REFERENCE.PACK;
  const fromPack = lesson.sourceId !== undefined && pack.lessonIds.includes(lesson.sourceId);
  const packTopic = lesson.topicIds
    .map((id) => pack.topics.find((t) => t.id === id))
    .find((t) => t !== undefined);
  const grade = lesson.grade ?? (fromPack || packTopic ? pack.grade : null);
  const subject = lesson.subject ?? (fromPack || packTopic ? pack.subject : null);
  const topic = lesson.topic ?? packTopic?.title ?? null;
  return {
    grade,
    subject,
    topic,
    gradeKey: grade !== null ? `g${grade}` : 'gx',
    gradeLabel: grade !== null ? `Khối ${grade}` : 'Chưa xếp khối',
    gradeSort: grade ?? 99,
    subjectKey: subject ?? 'sx',
    subjectLabel: subject ?? 'Chưa xếp môn',
    topicKey: topic ?? 'tx',
    topicLabel: topic ?? 'Chưa xếp Topic',
  };
}

interface TopicGroup {
  key: string;
  label: string;
  lessons: Lesson[];
}
interface SubjectGroup {
  key: string;
  label: string;
  topics: TopicGroup[];
}
interface GradeGroup {
  key: string;
  label: string;
  sort: number;
  subjects: SubjectGroup[];
}

function groupMine(lessons: Lesson[]): GradeGroup[] {
  const byGrade = new Map<string, GradeGroup>();
  for (const l of lessons) {
    const f = filingOf(l);
    let g = byGrade.get(f.gradeKey);
    if (!g) {
      g = { key: f.gradeKey, label: f.gradeLabel, sort: f.gradeSort, subjects: [] };
      byGrade.set(f.gradeKey, g);
    }
    let s = g.subjects.find((x) => x.key === f.subjectKey);
    if (!s) {
      s = { key: f.subjectKey, label: f.subjectLabel, topics: [] };
      g.subjects.push(s);
    }
    let t = s.topics.find((x) => x.key === f.topicKey);
    if (!t) {
      t = { key: f.topicKey, label: f.topicLabel, lessons: [] };
      s.topics.push(t);
    }
    t.lessons.push(l);
  }
  const grades = [...byGrade.values()].sort(
    (a, b) => a.sort - b.sort || a.label.localeCompare(b.label, 'vi'),
  );
  for (const g of grades) {
    g.subjects.sort((a, b) =>
      a.key === 'sx' ? 1 : b.key === 'sx' ? -1 : a.label.localeCompare(b.label, 'vi'),
    );
    for (const s of g.subjects) {
      s.topics.sort((a, b) =>
        a.key === 'tx' ? 1 : b.key === 'tx' ? -1 : a.label.localeCompare(b.label, 'vi'),
      );
      for (const t of s.topics) {
        t.lessons.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
      }
    }
  }
  return grades;
}

/** The lesson with its effective filing applied, so the editor fields
 * show the same Khối/Môn/Topic the list groups the lesson under
 * (Pack copies inherit the Pack's filing until explicitly changed). */
function withEffectiveFiling(lesson: Lesson): Lesson {
  const f = filingOf(lesson);
  return {
    ...lesson,
    grade: f.grade ?? undefined,
    subject: f.subject ?? undefined,
    topic: f.topic ?? undefined,
  };
}

/** Grade/subject/Topic filing fields for the lesson editor. Changing them
 * re-files the lesson in the Khối → Môn → Topic list once saved. */
function FilingFields({
  draft,
  onChange,
  topics,
}: {
  draft: Lesson;
  onChange: (patch: Partial<Lesson>) => void;
  topics: string[];
}) {
  const subjectOptions = draft.grade ? (SUBJECTS_BY_GRADE[draft.grade] ?? []) : [];
  return (
    <div className="form-card">
      <h3 className="subhead">Xếp bài vào khối · môn · Topic</h3>
      <div className="field-row">
        <label className="field">
          <span>Khối</span>
          <select
            value={draft.grade ?? ''}
            onChange={(e) =>
              onChange({ grade: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          >
            <option value="">Chưa xếp</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Khối {g}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Môn</span>
          <input
            value={draft.subject ?? ''}
            list="filing-subjects"
            placeholder="Ví dụ: Toán"
            onChange={(e) => onChange({ subject: e.target.value === '' ? undefined : e.target.value })}
          />
          <datalist id="filing-subjects">
            {subjectOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Topic</span>
          <input
            value={draft.topic ?? ''}
            list="filing-topics"
            placeholder="Ví dụ: Phân số"
            onChange={(e) => onChange({ topic: e.target.value === '' ? undefined : e.target.value })}
          />
          <datalist id="filing-topics">
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
      </div>
      <p className="guide-text">Bài sẽ xếp theo khối → môn → Topic trong danh sách bên trái.</p>
    </div>
  );
}

function GroupHead({
  label,
  count,
  depth,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  depth: 1 | 2 | 3;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`group-head group-head-${depth}`}
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      <span aria-hidden>{collapsed ? '▸' : '▾'}</span> {label}{' '}
      <span className="muted">({count})</span>
    </button>
  );
}

export function StudioShell({
  account,
  route,
  go,
}: {
  account: Account;
  route: Route;
  go: (route: Route) => void;
}) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<'mine' | 'ai' | 'plan'>('mine');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [saved, setSaved] = useState(false);
  const [proposeTarget, setProposeTarget] = useState<'team' | 'school'>('team');
  const [assignLessonId, setAssignLessonId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [aiPrefill, setAiPrefill] = useState<{ topic: string; grade: number; subject: string } | null>(null);
  const [aiPrefillNonce, setAiPrefillNonce] = useState(0);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const myCopies = state.lessons.filter((l) => l.ownerId === account.id);
  const gradeGroups = groupMine(myCopies);
  const filedGrades = Array.from(
    new Set(
      myCopies.map((l) => filingOf(l).grade).filter((g): g is number => g !== null),
    ),
  ).sort((a, b) => a - b);
  const [exportGrade, setExportGrade] = useState<number | null>(null);
  const [exportSubject, setExportSubject] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const activeExportGrade = exportGrade ?? filedGrades[0] ?? null;
  const exportSubjectOptions = Array.from(
    new Set(
      myCopies
        .filter((l) => filingOf(l).grade === activeExportGrade)
        .map((l) => filingOf(l).subject)
        .filter((s): s is string => s !== null),
    ),
  ).sort((a, b) => a.localeCompare(b, 'vi'));
  const activeExportSubject =
    exportSubject !== null && exportSubjectOptions.includes(exportSubject)
      ? exportSubject
      : (exportSubjectOptions[0] ?? null);

  const exportSubjectJson = () => {
    if (activeExportGrade === null || activeExportSubject === null) return;
    const matches = myCopies.filter((l) => {
      const f = filingOf(l);
      return f.grade === activeExportGrade && f.subject === activeExportSubject;
    });
    if (matches.length === 0) {
      setNotice('Không có bài nào thuộc khối · môn này.');
      return;
    }
    downloadTextFile(
      `mon-khoi${activeExportGrade}-${activeExportSubject}.json`,
      buildSubjectExport(matches, activeExportGrade, activeExportSubject),
      'application/json',
    );
    setNotice(
      `Đã xuất ${matches.length} bài (Khối ${activeExportGrade} · ${activeExportSubject}) ra file JSON.`,
    );
  };

  const importFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const errors: string[] = [];
    let imported = 0;
    let missingSource = 0;
    for (const file of Array.from(files)) {
      const text = await file.text();
      const result = parseLessonFile(text, file.name);
      errors.push(...result.errors);
      for (const draft of result.lessons) {
        dispatch({
          type: 'CREATE_LESSON_COPY',
          lesson: {
            id: `IMP-${Date.now()}-${imported}`,
            title: draft.title,
            topicIds: draft.topicIds ?? [],
            color: draft.color ?? '#2563eb',
            sections: draft.sections ?? [],
            questionIds: draft.questionIds ?? [],
            ownerId: account.id,
            ...(draft.html ? { html: draft.html } : {}),
            ...(draft.grade !== undefined ? { grade: draft.grade } : {}),
            ...(draft.subject ? { subject: draft.subject } : {}),
            ...(draft.topic ? { topic: draft.topic } : {}),
            ...(draft.outline ? { outline: draft.outline } : {}),
            ...(draft.roleSentence ? { roleSentence: draft.roleSentence } : {}),
            ...(draft.extraRequests ? { extraRequests: draft.extraRequests } : {}),
          },
        });
        imported += 1;
        if (draft.sourceMissing) missingSource += 1;
      }
    }
    setImportErrors(errors);
    setNotice(
      `Đã nhập ${imported} bài.` +
        (missingSource > 0
          ? ` ${missingSource} file không có JSON nguồn nên chỉ nhập được nội dung, chưa xếp khối/môn/Topic — bạn xếp lại trong khung soạn bài.`
          : ''),
    );
  };
  const myTopics = Array.from(
    new Set(
      myCopies
        .map((l) => filingOf(l).topicLabel)
        .filter((t) => t !== 'Chưa xếp Topic')
        .concat(REFERENCE.PACK.topics.map((t) => t.title)),
    ),
  ).sort((a, b) => a.localeCompare(b, 'vi'));
  const assignLesson = assignLessonId
    ? state.lessons.find((l) => l.id === assignLessonId)
    : undefined;

  useEffect(() => {
    const lesson = myCopies.find((l) => l.id === selectedId);
    setDraft(lesson ? JSON.parse(JSON.stringify(lesson)) as Lesson : null);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Deep link from the lesson detail page after copying: open the new copy.
  const routeLessonId = route.lessonId;
  useEffect(() => {
    if (routeLessonId && myCopies.some((l) => l.id === routeLessonId)) {
      setTab('mine');
      setSelectedId(routeLessonId);
      setNotice('Đã copy bài về không gian của bạn. Bản sao đang mở để sửa.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLessonId]);

  const pickTab = (next: 'mine' | 'ai' | 'plan') => {
    setTab(next);
    setAssignLessonId(null);
    setNotice(null);
  };

  const updateSection = (sectionId: string, patch: Partial<LessonSection>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      sections: draft.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    });
    setSaved(false);
  };

  const moveSection = (sectionId: string, dir: -1 | 1) => {
    if (!draft) return;
    const sections = [...draft.sections];
    const idx = sections.findIndex((s) => s.id === sectionId);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= sections.length) return;
    [sections[idx], sections[next]] = [sections[next], sections[idx]];
    setDraft({ ...draft, sections });
    setSaved(false);
  };

  const removeSection = (sectionId: string) => {
    if (!draft) return;
    setDraft({ ...draft, sections: draft.sections.filter((s) => s.id !== sectionId) });
    setSaved(false);
  };

  const addSection = () => {
    if (!draft) return;
    setDraft({ ...draft, sections: [...draft.sections, BLANK_SECTION(`S-${Date.now()}`)] });
    setSaved(false);
  };

  const createBlank = () => {
    const lesson: Lesson = {
      id: `LC-${Date.now()}`,
      title: 'Bài mới chưa đặt tên',
      topicIds: ['A'],
      color: '#2563eb',
      sections: [BLANK_SECTION(`S-${Date.now()}`)],
      questionIds: [],
      ownerId: account.id,
    };
    dispatch({ type: 'CREATE_LESSON_COPY', lesson });
    setSelectedId(lesson.id);
    setNotice('Đã tạo bài mới.');
  };

  const save = () => {
    if (!draft) return;
    dispatch({ type: 'UPDATE_LESSON_COPY', lesson: draft });
    setSaved(true);
    setNotice('Đã lưu bài học.');
  };

  const patchDraft = (patch: Partial<Lesson>) => {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    setSaved(false);
  };

  const propose = () => {
    if (!draft) return;
    dispatch({
      type: 'PROPOSE',
      proposal: {
        id: `PR-${Date.now()}`,
        kind: 'lesson',
        title: draft.title,
        topicId: draft.topicIds[0] ?? 'A',
        createdBy: account.id,
        createdByName: account.name,
        anonymous: false,
        targetRepo: proposeTarget,
        schoolId: account.schoolId ?? 'S1',
        teamId: account.teamId,
        stage: proposeTarget,
        status: 'pending',
        lessonCopyId: draft.id,
        createdAt: new Date().toISOString().slice(0, 10),
      },
    });
    setNotice(`Đã gửi đề xuất lên ${proposeTarget === 'team' ? 'Kho Tổ' : 'Kho Trường'}.`);
  };

  return (
    <div>
      <SectionBand
        title="Soạn bài"
        guide="Bạn làm việc trên BẢN SAO của mình. Bản gốc của người khác không bao giờ bị sửa trực tiếp. Soạn xong thì giao ngay từ bài học đó."
      />
      {notice ? <p className="notice">{notice}</p> : null}
      <div className="tabs" role="tablist">
        <button type="button" className={tab === 'mine' ? 'tab tab-active' : 'tab'} onClick={() => pickTab('mine')}>
          Bài của tôi ({myCopies.length})
        </button>
        <button type="button" className={tab === 'ai' ? 'tab tab-active' : 'tab'} onClick={() => pickTab('ai')}>
          Soạn bài mới (AI)
        </button>
        <button type="button" className={tab === 'plan' ? 'tab tab-active' : 'tab'} onClick={() => pickTab('plan')}>
          Lên chương trình
        </button>
      </div>

      {tab === 'mine' ? (
        <>
          <div className="form-card">
            <h3 className="subhead">Xuất / Nhập file bài học</h3>
            <p className="guide-text">
              File HTML tải về mở được trong mọi trình duyệt và có kèm JSON nguồn bên trong — tải lên
              lại để tiếp tục làm việc. File JSON Môn chứa toàn bộ bài của một khối · môn.
            </p>
            <div className="field-row">
              <label className="field">
                <span>Khối</span>
                <select
                  value={activeExportGrade ?? ''}
                  onChange={(e) => {
                    setExportGrade(Number(e.target.value));
                    setExportSubject(null);
                  }}
                >
                  {filedGrades.map((g) => (
                    <option key={g} value={g}>
                      Khối {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Môn</span>
                <select
                  value={activeExportSubject ?? ''}
                  onChange={(e) => setExportSubject(e.target.value)}
                >
                  {exportSubjectOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={activeExportGrade === null || activeExportSubject === null}
                  onClick={exportSubjectJson}
                >
                  Xuất JSON Môn
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => importInputRef.current?.click()}
                >
                  Nhập file bài học (.html / .json)
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".html,.htm,.json"
                  multiple
                  hidden
                  onChange={(e) => {
                    void importFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
            {importErrors.length > 0 ? (
              <div className="warn-box">
                {importErrors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="studio-layout">
          <div className="studio-list">
            <button type="button" className="btn btn-primary" onClick={createBlank}>
              + Bài mới
            </button>
            {myCopies.length === 0 ? (
              <EmptyState text="Bạn chưa có bản sao nào. Copy một bài từ tab Kho bài chuẩn hoặc Kho chung." />
            ) : null}
            {gradeGroups.map((g) => {
              const gKey = g.key;
              const gCount = g.subjects.reduce(
                (n, s) => n + s.topics.reduce((m, t) => m + t.lessons.length, 0),
                0,
              );
              return (
                <div key={gKey}>
                  <GroupHead
                    label={g.label}
                    count={gCount}
                    depth={1}
                    collapsed={collapsed.has(gKey)}
                    onToggle={() => toggleGroup(gKey)}
                  />
                  {collapsed.has(gKey) ? null : (
                    <>
                      {g.subjects.map((s) => {
                        const sKey = `${gKey}/${s.key}`;
                        const sCount = s.topics.reduce((m, t) => m + t.lessons.length, 0);
                        return (
                          <div key={sKey}>
                            <GroupHead
                              label={s.label}
                              count={sCount}
                              depth={2}
                              collapsed={collapsed.has(sKey)}
                              onToggle={() => toggleGroup(sKey)}
                            />
                            {collapsed.has(sKey) ? null : (
                              <>
                                {s.topics.map((t) => {
                                  const tKey = `${sKey}/${t.key}`;
                                  return (
                                    <div key={tKey}>
                                      <GroupHead
                                        label={t.label}
                                        count={t.lessons.length}
                                        depth={3}
                                        collapsed={collapsed.has(tKey)}
                                        onToggle={() => toggleGroup(tKey)}
                                      />
                                      {collapsed.has(tKey) ? null : (
                                        <div className="group-lessons">
                                          {t.lessons.map((l) => (
                                            <div
                                              key={l.id}
                                              className={
                                                l.id === selectedId
                                                  ? 'studio-card studio-card-active'
                                                  : 'studio-card'
                                              }
                                            >
                                              <button
                                                type="button"
                                                className="studio-card-main"
                                                onClick={() => {
                                                  setSelectedId(l.id);
                                                  setAssignLessonId(null);
                                                  setNotice(null);
                                                }}
                                              >
                                                <strong>{l.title}</strong>
                                                <span className="muted">
                                                  {l.html
                                                    ? `Bài HTML${l.grade ? ` · Khối ${l.grade}` : ''}${l.subject ? ` · ${l.subject}` : ''}`
                                                    : `${l.sections.length} phần`}
                                                </span>
                                              </button>
                                              <button
                                                type="button"
                                                className="btn btn-small btn-secondary"
                                                onClick={() => setAssignLessonId(l.id)}
                                              >
                                                Giao bài
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="studio-editor">
            {assignLesson ? (
              <AssignSheet
                key={assignLesson.id}
                account={account}
                lesson={assignLesson}
                go={go}
                onBack={() => setAssignLessonId(null)}
              />
            ) : !draft ? (
              <EmptyState text="Chọn một bài bên trái để sửa, hoặc tạo bài mới." />
            ) : draft.html ? (
              <>
                <FilingFields draft={withEffectiveFiling(draft)} onChange={patchDraft} topics={myTopics} />
                <p className="guide-text">
                  Bài HTML do AI soạn — xem trước bên dưới. Muốn sửa nội dung, hãy soạn lại bằng AI;
                  bản khung này chưa sửa trực tiếp file HTML.
                </p>
                <HtmlLessonPlayer html={draft.html} title={draft.title} />
                <div className="row-actions">
                  <button type="button" className="btn btn-secondary" onClick={save}>
                    Lưu thông tin xếp bài
                  </button>
                  {saved ? <span className="feedback-ok">Đã lưu.</span> : null}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (!draft.html) return;
                      downloadTextFile(
                        safeFilename(draft.title, 'html'),
                        embedSourceJson(draft.html, sourceJsonFor(draft)),
                        'text/html;charset=utf-8',
                      );
                    }}
                  >
                    Tải file HTML
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setAssignLessonId(draft.id)}>
                    Giao bài
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      dispatch({ type: 'DELETE_LESSON_COPY', lessonId: draft.id });
                      setSelectedId(null);
                      setDraft(null);
                      setNotice('Đã xóa bản sao.');
                    }}
                  >
                    Xóa bản sao này
                  </button>
                </div>
                <LessonExerciseSection account={account} lesson={draft} />
              </>
            ) : (
              <>
                <label className="field">
                  <span>Tiêu đề bài học</span>
                  <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </label>
                <FilingFields draft={withEffectiveFiling(draft)} onChange={patchDraft} topics={myTopics} />
                {draft.sections.map((section, i) => (
                  <div key={section.id} className="section-editor">
                    <div className="section-editor-head">
                      <span className="muted">Phần {i + 1}</span>
                      <span className="row-actions">
                        <button type="button" className="btn btn-small" onClick={() => moveSection(section.id, -1)}>
                          Lên
                        </button>
                        <button type="button" className="btn btn-small" onClick={() => moveSection(section.id, 1)}>
                          Xuống
                        </button>
                        <button type="button" className="btn btn-small btn-danger" onClick={() => removeSection(section.id)}>
                          Xóa
                        </button>
                      </span>
                    </div>
                    <label className="field">
                      <span>Tiêu đề phần</span>
                      <input
                        value={section.title}
                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                      />
                    </label>
                    <div className="field">
                      <span>Ví dụ mẫu (giữ nguyên ở bản khung này)</span>
                      <div className="example-box example-box-readonly">
                        {section.example.map((line, li) => (
                          <div key={li} className="example-line">
                            <MathExpr line={line} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <label className="field">
                      <span>Các bước (mỗi dòng một bước)</span>
                      <textarea
                        rows={section.steps.length + 1}
                        value={section.steps.join('\n')}
                        onChange={(e) =>
                          updateSection(section.id, {
                            steps: e.target.value.split('\n').filter((s) => s.trim() !== ''),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Ghi chú lỗi hay gặp (không bắt buộc)</span>
                      <input
                        value={section.tip ?? ''}
                        onChange={(e) => updateSection(section.id, { tip: e.target.value })}
                      />
                    </label>
                  </div>
                ))}
                <div className="row-actions">
                  <button type="button" className="btn btn-secondary" onClick={addSection}>
                    + Thêm phần
                  </button>
                  <button type="button" className="btn btn-primary" onClick={save}>
                    Lưu
                  </button>
                  {saved ? <span className="feedback-ok">Đã lưu.</span> : null}
                </div>
                <div className="form-card">
                  <h3 className="subhead">Gửi lên Kho chung</h3>
                  <label className="field">
                    <span>Gửi lên</span>
                    <select value={proposeTarget} onChange={(e) => setProposeTarget(e.target.value as 'team' | 'school')}>
                      <option value="team">Kho Tổ (Tổ trưởng duyệt)</option>
                      <option value="school">Kho Trường (Hiệu trưởng duyệt)</option>
                    </select>
                  </label>
                  <button type="button" className="btn btn-primary" onClick={propose}>
                    Gửi đề xuất
                  </button>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      downloadTextFile(
                        safeFilename(draft.title, 'json'),
                        buildSubjectExport([draft], draft.grade ?? null, draft.subject ?? null),
                        'application/json',
                      )
                    }
                  >
                    Tải file JSON
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setAssignLessonId(draft.id)}>
                    Giao bài
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      dispatch({ type: 'DELETE_LESSON_COPY', lessonId: draft.id });
                      setSelectedId(null);
                      setDraft(null);
                      setNotice('Đã xóa bản sao.');
                    }}
                  >
                    Xóa bản sao này
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        </>
      ) : null}

      {tab === 'ai' ? (
        <AiStudio
          key={aiPrefill ? `ai-prefill-${aiPrefillNonce}` : 'ai'}
          account={account}
          initialTopic={aiPrefill?.topic}
          initialGrade={aiPrefill?.grade}
          initialSubject={aiPrefill?.subject}
          onSaved={(lessonId) => {
            if (aiPrefill) {
              setBatchItems((prev) =>
                prev.map((i) =>
                  i.title === aiPrefill.topic && i.status !== 'done'
                    ? { ...i, status: 'done' as const }
                    : i,
                ),
              );
              setAiPrefill(null);
            }
            setTab('mine');
            setSelectedId(lessonId);
            setNotice('Đã lưu bài AI soạn vào Bài của tôi. Bạn có thể giao bài ngay từ đây.');
          }}
          onOpenSettings={() => go({ view: 'settings' })}
        />
      ) : null}

      {tab === 'plan' ? (
        <BatchPlanner
          account={account}
          items={batchItems}
          onItemsChange={setBatchItems}
          onCompose={(prefill) => {
            setAiPrefill(prefill);
            setAiPrefillNonce((n) => n + 1);
            setTab('ai');
          }}
          onOpenSettings={() => go({ view: 'settings' })}
        />
      ) : null}

    </div>
  );
}

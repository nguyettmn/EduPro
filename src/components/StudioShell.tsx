// Studio: one lesson workspace. Compose on COPIES (never edit someone
// else's original), browse the Pack, and assign any lesson — copy or
// pack original — to a class or to individual students, from the lesson.
import { useEffect, useState } from 'react';
import type { Account, Lesson, LessonSection } from '../types';
import { QUESTIONS } from '../data/questions';
import { managedAccounts, visibleClasses, visibleStudents } from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import type { Route } from '../route';
import { MathExpr } from './Fraction';
import { LessonPlayer } from './LessonPlayer';
import { HtmlLessonPlayer } from './HtmlLessonPlayer';
import { AiStudio } from './AiStudio';
import { EmptyState, SectionBand, TopicTag } from './ui';

const BLANK_SECTION = (id: string): LessonSection => ({
  id,
  title: 'Phần mới',
  example: [[{ k: 't', s: 'Ví dụ mẫu sẽ được thêm ở bản thiết kế lại.' }]],
  steps: ['Bước 1: viết hướng dẫn ở đây.'],
});

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const plusDays = (n: number): string =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function AssignSheet({
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
  const [tab, setTab] = useState<'mine' | 'ai' | 'pack' | 'managed'>('mine');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [saved, setSaved] = useState(false);
  const [proposeTarget, setProposeTarget] = useState<'team' | 'school'>('team');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [assignLessonId, setAssignLessonId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const myCopies = state.lessons.filter((l) => l.ownerId === account.id);
  const managed = managedAccounts(account, state.accounts);
  const managedCopies = state.lessons.filter(
    (l) => l.ownerId && managed.some((a) => a.id === l.ownerId),
  );
  const pack = REFERENCE.PACK;
  const packLessons = pack.lessonIds
    .map((id) => state.lessons.find((l) => l.id === id))
    .filter((l): l is Lesson => Boolean(l))
    .filter((l) => !topicFilter || l.topicIds.includes(topicFilter));
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

  const pickTab = (next: 'mine' | 'ai' | 'pack' | 'managed') => {
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

  const copyToMine = (source: Lesson) => {
    const copy = {
      ...JSON.parse(JSON.stringify(source)) as Lesson,
      id: `LC-${Date.now()}`,
      title: `${source.title} (bản của ${account.name})`,
      ownerId: account.id,
      sourceId: source.id,
    };
    dispatch({ type: 'COPY_TO_MY_SPACE', lesson: copy });
    setTab('mine');
    setSelectedId(copy.id);
    setNotice('Đã copy bài về không gian của bạn.');
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
        <button type="button" className={tab === 'pack' ? 'tab tab-active' : 'tab'} onClick={() => pickTab('pack')}>
          Pack
        </button>
        <button type="button" className={tab === 'managed' ? 'tab tab-active' : 'tab'} onClick={() => pickTab('managed')}>
          Trong phạm vi quản lý ({managedCopies.length})
        </button>
      </div>

      {tab === 'mine' ? (
        <div className="studio-layout">
          <div className="studio-list">
            <button type="button" className="btn btn-primary" onClick={createBlank}>
              + Bài mới
            </button>
            {myCopies.length === 0 ? <EmptyState text="Bạn chưa có bản sao nào. Copy một bài từ tab Pack hoặc Kho chung." /> : null}
            {myCopies.map((l) => (
              <div
                key={l.id}
                className={l.id === selectedId ? 'studio-card studio-card-active' : 'studio-card'}
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
                <p className="guide-text">
                  Bài HTML do AI soạn — xem trước bên dưới. Muốn sửa nội dung, hãy soạn lại bằng AI;
                  bản khung này chưa sửa trực tiếp file HTML.
                </p>
                <HtmlLessonPlayer html={draft.html} title={draft.title} />
                <div className="row-actions">
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
            ) : (
              <>
                <label className="field">
                  <span>Tiêu đề bài học</span>
                  <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </label>
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
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'ai' ? (
        <AiStudio
          account={account}
          onSaved={(lessonId) => {
            setTab('mine');
            setSelectedId(lessonId);
            setNotice('Đã lưu bài AI soạn vào Bài của tôi. Bạn có thể giao bài ngay từ đây.');
          }}
          onOpenSettings={() => go({ view: 'settings' })}
        />
      ) : null}

      {tab === 'pack' ? (
        assignLesson ? (
          <AssignSheet
            key={assignLesson.id}
            account={account}
            lesson={assignLesson}
            go={go}
            onBack={() => setAssignLessonId(null)}
          />
        ) : (
          <div>
            <div className="pack-card" style={{ borderTopColor: pack.color }}>
              <div className="pack-title">{pack.title}</div>
              <div className="muted">
                Khối {pack.grade} · Môn {pack.subject} · {pack.lessonIds.length} bài học · {QUESTIONS.length} câu hỏi
              </div>
              <div className="tag-row">
                {pack.topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={topicFilter === t.id ? 'topic-filter topic-filter-active' : 'topic-filter'}
                    style={{ borderColor: t.color, color: t.color }}
                    onClick={() => setTopicFilter(topicFilter === t.id ? null : t.id)}
                  >
                    {t.code} · {t.title}
                  </button>
                ))}
              </div>
            </div>
            <div className="lesson-grid">
              {packLessons.map((l) => {
                const topics = pack.topics.filter((t) => l.topicIds.includes(t.id));
                return (
                  <div key={l.id} className="lesson-card" style={{ borderTopColor: l.color }}>
                    <span className="lesson-card-title">{l.title}</span>
                    <span className="tag-row">
                      {topics.map((t) => (
                        <TopicTag key={t.id} topic={t} />
                      ))}
                    </span>
                    <span className="muted">
                      {l.sections.length} phần · {l.questionIds.length} câu hỏi
                    </span>
                    <span className="row-actions">
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => go({ view: 'lesson', lessonId: l.id, tab: 'content' })}
                      >
                        Xem
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        onClick={() => copyToMine(l)}
                      >
                        Copy về của tôi
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-primary"
                        onClick={() => setAssignLessonId(l.id)}
                      >
                        Giao bài
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            {packLessons.length === 0 ? <EmptyState text="Không có bài học nào thuộc chủ đề này." /> : null}
          </div>
        )
      ) : null}

      {tab === 'managed' ? (
        <div>
          <p className="guide-text">
            Đây là bản sao của những người bạn quản lý. Bạn chỉ xem và copy về không gian của mình, không sửa trực
            tiếp bản của họ.
          </p>
          {managedCopies.length === 0 ? (
            <EmptyState text="Không có bản sao nào trong phạm vi quản lý của bạn." />
          ) : (
            managedCopies.map((l) => {
              const owner = state.accounts.find((a) => a.id === l.ownerId);
              const open = previewId === l.id;
              return (
                <div key={l.id} className="repo-item">
                  <button type="button" className="repo-item-head" onClick={() => setPreviewId(open ? null : l.id)}>
                    <span>
                      <strong>{l.title}</strong>
                    </span>
                    <span className="muted">Của {owner?.name ?? 'Không rõ'}</span>
                  </button>
                  {open ? (
                    <div className="repo-item-body">
                      {l.html ? (
                        <HtmlLessonPlayer html={l.html} title={l.title} />
                      ) : (
                        <LessonPlayer lesson={l} />
                      )}
                      <button type="button" className="btn btn-secondary" onClick={() => copyToMine(l)}>
                        Copy về không gian của tôi
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

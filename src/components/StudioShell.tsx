// Studio: a functional-but-simple lesson composer working on COPIES.
// Full redesign of lesson authoring comes later; this frame version keeps
// section list, select, edit title/text, add/remove/reorder, and propose.
import { useEffect, useState } from 'react';
import type { Account, Lesson, LessonSection } from '../types';
import { managedAccounts } from '../permissions';
import { useStore } from '../state/store';
import { MathExpr } from './Fraction';
import { LessonPlayer } from './LessonPlayer';
import { EmptyState, SectionBand } from './ui';

const BLANK_SECTION = (id: string): LessonSection => ({
  id,
  title: 'Phần mới',
  example: [[{ k: 't', s: 'Ví dụ mẫu sẽ được thêm ở bản thiết kế lại.' }]],
  steps: ['Bước 1: viết hướng dẫn ở đây.'],
});

export function StudioShell({ account }: { account: Account }) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<'mine' | 'managed'>('mine');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [saved, setSaved] = useState(false);
  const [proposeTarget, setProposeTarget] = useState<'team' | 'school'>('team');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const myCopies = state.lessons.filter((l) => l.ownerId === account.id);
  const managed = managedAccounts(account, state.accounts);
  const managedCopies = state.lessons.filter(
    (l) => l.ownerId && managed.some((a) => a.id === l.ownerId),
  );

  useEffect(() => {
    const lesson = myCopies.find((l) => l.id === selectedId);
    setDraft(lesson ? JSON.parse(JSON.stringify(lesson)) as Lesson : null);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

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
  };

  const save = () => {
    if (!draft) return;
    dispatch({ type: 'UPDATE_LESSON_COPY', lesson: draft });
    setSaved(true);
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
  };

  return (
    <div>
      <SectionBand
        title="Soạn bài"
        guide="Bạn làm việc trên BẢN SAO của mình. Bản gốc của người khác không bao giờ bị sửa trực tiếp. Bản thiết kế lại đầy đủ sẽ đến sau."
      />
      <div className="tabs" role="tablist">
        <button type="button" className={tab === 'mine' ? 'tab tab-active' : 'tab'} onClick={() => setTab('mine')}>
          Của tôi ({myCopies.length})
        </button>
        <button type="button" className={tab === 'managed' ? 'tab tab-active' : 'tab'} onClick={() => setTab('managed')}>
          Trong phạm vi quản lý ({managedCopies.length})
        </button>
      </div>

      {tab === 'mine' ? (
        <div className="studio-layout">
          <div className="studio-list">
            <button type="button" className="btn btn-primary" onClick={createBlank}>
              + Bài mới
            </button>
            {myCopies.length === 0 ? <EmptyState text="Bạn chưa có bản sao nào. Copy một bài từ Thư viện hoặc Kho chung." /> : null}
            {myCopies.map((l) => (
              <button
                key={l.id}
                type="button"
                className={l.id === selectedId ? 'studio-item studio-item-active' : 'studio-item'}
                onClick={() => setSelectedId(l.id)}
              >
                <strong>{l.title}</strong>
                <span className="muted">{l.sections.length} phần</span>
              </button>
            ))}
          </div>
          <div className="studio-editor">
            {!draft ? (
              <EmptyState text="Chọn một bài bên trái để sửa, hoặc tạo bài mới." />
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
                  }}
                >
                  Xóa bản sao này
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
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
                      <LessonPlayer lesson={l} />
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
      )}
    </div>
  );
}

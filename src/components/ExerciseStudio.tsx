// Practice exercises generated from a lesson's HTML: AI reads the
// lesson text (never the code), proposes structured questions, and the
// teacher reviews and edits every question before saving. Saved sets
// travel with the lesson: students who open the assigned lesson can do
// them for self-practice (see ExerciseRunner). No grading in the test
// slice.
import { useState } from 'react';
import type { Account, ExerciseQuestion, ExerciseSet, Lesson } from '../types';
import { roleSentenceFor } from '../ai/subjects';
import { AiApiError, callAiJson } from '../ai/client';
import { lessonTextFromHtml } from '../ai/lessonFile';
import { useStore } from '../state/store';
import { ExerciseRunner } from './ExerciseRunner';

type DraftQuestion = ExerciseQuestion;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function blankChoice(): DraftQuestion {
  return { id: newId('EQ'), kind: 'choice', prompt: '', choices: ['', '', ''], answerIndex: 0 };
}

function blankShort(): DraftQuestion {
  return { id: newId('EQ'), kind: 'short', prompt: '', expected: '' };
}

/** Drop invalid questions; returns the kept ones. */
function cleanQuestions(questions: DraftQuestion[]): DraftQuestion[] {
  const out: DraftQuestion[] = [];
  for (const q of questions) {
    const prompt = q.prompt.trim();
    if (prompt === '') continue;
    if (q.kind === 'choice') {
      const choices = (q.choices ?? []).map((c) => c.trim()).filter((c) => c !== '');
      const answerIndex = q.answerIndex ?? 0;
      if (choices.length < 2 || answerIndex < 0 || answerIndex >= choices.length) continue;
      out.push({
        ...q,
        prompt,
        choices,
        answerIndex,
        hint: q.hint?.trim() !== '' ? q.hint?.trim() : undefined,
      });
    } else {
      const expected = (q.expected ?? '').trim();
      if (expected === '') continue;
      out.push({
        ...q,
        prompt,
        expected,
        hint: q.hint?.trim() !== '' ? q.hint?.trim() : undefined,
      });
    }
  }
  return out;
}

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: DraftQuestion;
  index: number;
  onChange: (q: DraftQuestion) => void;
  onRemove: () => void;
}) {
  return (
    <div className="form-card">
      <div className="section-editor-head">
        <span className="muted">
          Câu {index + 1} · {question.kind === 'choice' ? 'Trắc nghiệm' : 'Trả lời ngắn'}
        </span>
        <button type="button" className="btn btn-small btn-danger" onClick={onRemove}>
          Xóa câu này
        </button>
      </div>
      <label className="field">
        <span>Câu hỏi</span>
        <textarea
          rows={2}
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
        />
      </label>
      {question.kind === 'choice' ? (
        <div className="field">
          <span>Các lựa chọn (tick vào đáp án đúng)</span>
          {(question.choices ?? []).map((choice, ci) => (
            <div key={ci} className="inline-add">
              <label className="check-row">
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  checked={question.answerIndex === ci}
                  onChange={() => onChange({ ...question, answerIndex: ci })}
                />
              </label>
              <label className="field">
                <input
                  value={choice}
                  onChange={(e) => {
                    const choices = [...(question.choices ?? [])];
                    choices[ci] = e.target.value;
                    onChange({ ...question, choices });
                  }}
                  placeholder={`Lựa chọn ${ci + 1}`}
                />
              </label>
            </div>
          ))}
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-small btn-secondary"
              disabled={(question.choices ?? []).length >= 4}
              onClick={() => onChange({ ...question, choices: [...(question.choices ?? []), ''] })}
            >
              + Thêm lựa chọn
            </button>
          </div>
        </div>
      ) : (
        <label className="field">
          <span>Đáp án đúng (học sinh gõ đúng đáp án này mới được tính đúng)</span>
          <input
            value={question.expected ?? ''}
            onChange={(e) => onChange({ ...question, expected: e.target.value })}
          />
        </label>
      )}
      <label className="field">
        <span>Gợi ý khi làm sai (không bắt buộc)</span>
        <input
          value={question.hint ?? ''}
          onChange={(e) => onChange({ ...question, hint: e.target.value })}
        />
      </label>
    </div>
  );
}

export function LessonExerciseSection({ account, lesson }: { account: Account; lesson: Lesson }) {
  const { state, dispatch } = useStore();
  const sets = state.exerciseSets.filter((s) => s.lessonId === lesson.id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [count, setCount] = useState(8);
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const editingSet = editingId ? (sets.find((s) => s.id === editingId) ?? null) : null;
  const showEditor = creating || editingSet !== null;
  const showSetupSteps = error?.code === 'missing_key' || error?.code === 'invalid_key';

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setDrafts([]);
    setDraftTitle(`Bài tập: ${lesson.title}`);
    setError(null);
    setNotice(null);
  };

  const startEdit = (set: ExerciseSet) => {
    setCreating(false);
    setEditingId(set.id);
    setDrafts(JSON.parse(JSON.stringify(set.questions)) as DraftQuestion[]);
    setDraftTitle(set.title);
    setError(null);
    setNotice(null);
  };

  const generate = async () => {
    if (!lesson.html) return;
    setWorking(true);
    setError(null);
    try {
      const data = await callAiJson<{ questions: DraftQuestion[] }>({
        stage: 'exercises',
        grade: lesson.grade ?? 5,
        subject: lesson.subject ?? 'Toán',
        roleSentence:
          lesson.roleSentence ?? roleSentenceFor(lesson.grade ?? 5, lesson.subject ?? 'Toán'),
        mode: 'topic',
        topic: lesson.topic ?? lesson.title,
        outline: '',
        extraRequests: '',
        attachments: [],
        lessonText: lessonTextFromHtml(lesson.html),
        exerciseCount: count,
      });
      setDrafts(
        data.questions.map((q) => ({
          ...q,
          id: newId('EQ'),
        })),
      );
      setNotice('AI đã gợi ý các câu hỏi. Hãy đọc kỹ, sửa lại rồi mới lưu.');
    } catch (err) {
      if (err instanceof AiApiError) setError({ code: err.code, message: err.message });
      else setError({ code: 'unknown', message: 'Không tạo được bài tập. Hãy thử lại.' });
    } finally {
      setWorking(false);
    }
  };

  const save = () => {
    const cleaned = cleanQuestions(drafts);
    if (cleaned.length === 0) {
      setError({ code: 'empty', message: 'Chưa có câu hỏi hợp lệ nào để lưu. Hãy sửa lại các câu hỏi.' });
      return;
    }
    const title = draftTitle.trim() !== '' ? draftTitle.trim() : `Bài tập: ${lesson.title}`;
    if (editingSet) {
      dispatch({ type: 'UPDATE_EXERCISE_SET', set: { ...editingSet, title, questions: cleaned } });
    } else {
      dispatch({
        type: 'CREATE_EXERCISE_SET',
        set: {
          id: newId('EX'),
          lessonId: lesson.id,
          title,
          createdBy: account.id,
          questions: cleaned,
          createdAt: new Date().toISOString().slice(0, 10),
        },
      });
    }
    setCreating(false);
    setEditingId(null);
    setDrafts([]);
    setError(null);
    setNotice(`Đã lưu ${cleaned.length} câu hỏi. Học sinh mở bài này sẽ làm được bài tập.`);
  };

  return (
    <div>
      <h3 className="subhead">Bài tập từ bài học này</h3>
      {notice ? <p className="notice">{notice}</p> : null}
      {sets.length === 0 && !showEditor ? (
        <p className="guide-text">
          Chưa có bài tập nào. AI sẽ đọc nội dung bài học và ra câu hỏi bám sát bài — bạn duyệt từng
          câu trước khi lưu.
        </p>
      ) : null}
      {sets.map((set) => (
        <div key={set.id} className="repo-item">
          <div className="repo-item-head">
            <span>
              <strong>{set.title}</strong>{' '}
              <span className="muted">({set.questions.length} câu)</span>
            </span>
            <span className="row-actions">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setPreviewId(previewId === set.id ? null : set.id)}
              >
                {previewId === set.id ? 'Đóng' : 'Làm thử'}
              </button>
              <button type="button" className="btn btn-small btn-secondary" onClick={() => startEdit(set)}>
                Sửa
              </button>
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() => dispatch({ type: 'DELETE_EXERCISE_SET', setId: set.id })}
              >
                Xóa
              </button>
            </span>
          </div>
          {previewId === set.id ? (
            <div className="repo-item-body">
              <ExerciseRunner key={set.id} set={set} />
            </div>
          ) : null}
        </div>
      ))}

      {!showEditor ? (
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={startCreate}>
            + Tạo bài tập từ bài này
          </button>
        </div>
      ) : (
        <div className="form-card">
          <h3 className="subhead">{editingSet ? 'Sửa bài tập' : 'Tạo bài tập mới'}</h3>
          <label className="field">
            <span>Tiêu đề bộ bài tập</span>
            <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Số câu AI tạo</span>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                <option value={5}>5 câu</option>
                <option value={8}>8 câu</option>
                <option value={10}>10 câu</option>
              </select>
            </label>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={working}
                onClick={() => void generate()}
              >
                {working ? 'AI đang ra câu hỏi…' : 'AI tạo câu hỏi từ bài học'}
              </button>
            </div>
          </div>
          {error ? (
            <div className="warn-box">
              <strong>Không tạo được.</strong> {error.message}
              {showSetupSteps ? (
                <ol className="ai-setup-steps">
                  <li>
                    Vào{' '}
                    <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">
                      Google AI Studio
                    </a>{' '}
                    để tạo API key Gemini (miễn phí).
                  </li>
                  <li>Mở project EduPro trong Vercel → Settings → Environment Variables.</li>
                  <li>
                    Thêm biến <code>GEMINI_API_KEY</code> rồi Redeploy.
                  </li>
                </ol>
              ) : null}
            </div>
          ) : null}
          {drafts.map((q, i) => (
            <QuestionEditor
              key={q.id}
              question={q}
              index={i}
              onChange={(next) => setDrafts((prev) => prev.map((d) => (d.id === q.id ? next : d)))}
              onRemove={() => setDrafts((prev) => prev.filter((d) => d.id !== q.id))}
            />
          ))}
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDrafts((prev) => [...prev, blankChoice()])}
            >
              + Thêm câu trắc nghiệm
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDrafts((prev) => [...prev, blankShort()])}
            >
              + Thêm câu trả lời ngắn
            </button>
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={save}>
              Lưu bài tập ({cleanQuestions(drafts).length} câu hợp lệ)
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
                setDrafts([]);
                setError(null);
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

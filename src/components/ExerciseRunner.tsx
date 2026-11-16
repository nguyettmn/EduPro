// Self-practice runner for exercise sets generated from a lesson.
// Instant feedback per question; no submission, no grading in the test
// slice (like HTML lessons themselves).
import { useState } from 'react';
import type { ExerciseQuestion, ExerciseSet } from '../types';
import { useStore } from '../state/store';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isCorrect(q: ExerciseQuestion, answer: string | number | undefined): boolean {
  if (q.kind === 'choice') return answer === q.answerIndex;
  if (typeof answer !== 'string') return false;
  return normalize(answer) === normalize(q.expected ?? '');
}

export function ExerciseRunner({ set }: { set: ExerciseSet }) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const correctCount = set.questions.filter((q) => checked[q.id] && isCorrect(q, answers[q.id])).length;
  const allChecked = set.questions.length > 0 && set.questions.every((q) => checked[q.id]);

  const reset = () => {
    setAnswers({});
    setChecked({});
  };

  if (set.questions.length === 0) {
    return <p className="guide-text">Bộ bài tập này chưa có câu hỏi nào.</p>;
  }

  return (
    <div>
      {set.questions.map((q, i) => {
        const done = Boolean(checked[q.id]);
        const ok = done && isCorrect(q, answers[q.id]);
        return (
          <div key={q.id} className="form-card">
            <p>
              <strong>Câu {i + 1}.</strong> {q.prompt}
            </p>
            {q.kind === 'choice' ? (
              <div className="check-list">
                {(q.choices ?? []).map((choice, ci) => (
                  <label key={ci} className="check-row">
                    <input
                      type="radio"
                      name={`ex-${set.id}-${q.id}`}
                      checked={answers[q.id] === ci}
                      disabled={done}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: ci }))}
                    />
                    <span>{choice}</span>
                  </label>
                ))}
              </div>
            ) : (
              <label className="field">
                <span>Đáp án của bạn</span>
                <input
                  value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                  disabled={done}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Gõ đáp án…"
                />
              </label>
            )}
            {!done ? (
              <button
                type="button"
                className="btn btn-small btn-primary"
                disabled={answers[q.id] === undefined || answers[q.id] === ''}
                onClick={() => setChecked((prev) => ({ ...prev, [q.id]: true }))}
              >
                Kiểm tra
              </button>
            ) : ok ? (
              <p className="feedback-ok">Đúng rồi!</p>
            ) : (
              <p className="feedback-bad">
                Chưa đúng.
                {q.kind === 'choice'
                  ? ` Đáp án đúng: ${q.choices?.[q.answerIndex ?? 0] ?? ''}.`
                  : ` Đáp án đúng: ${q.expected ?? ''}.`}
                {q.hint ? ` Gợi ý: ${q.hint}` : ''}
              </p>
            )}
          </div>
        );
      })}
      {allChecked ? (
        <div className="row-actions">
          <p>
            <strong>
              Bạn làm đúng {correctCount} trên {set.questions.length} câu.
            </strong>
          </p>
          <button type="button" className="btn btn-secondary" onClick={reset}>
            Làm lại
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** All exercise sets attached to a lesson, each with its runner.
 * Rendered under the HTML player wherever a lesson is viewed. */
export function LessonExerciseSets({ lessonId }: { lessonId: string }) {
  const { state } = useStore();
  const sets = state.exerciseSets.filter((s) => s.lessonId === lessonId);
  if (sets.length === 0) return null;
  return (
    <div>
      <h3 className="subhead">Bài tập</h3>
      {sets.map((set) => (
        <div key={set.id} className="repo-item">
          <div className="repo-item-head">
            <span>
              <strong>{set.title}</strong> <span className="muted">({set.questions.length} câu)</span>
            </span>
          </div>
          <div className="repo-item-body">
            <ExerciseRunner key={set.id} set={set} />
          </div>
        </div>
      ))}
    </div>
  );
}

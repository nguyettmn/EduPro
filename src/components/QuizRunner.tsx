// Quiz runner: practice mode (one question at a time, immediate feedback
// with the full worked solution) and assignment mode (answer all, submit,
// auto-scored). Wrong answers in practice go to the Review Bank via callback.
import { useMemo, useState } from 'react';
import type { Question, StudentAnswer } from '../types';
import { checkAnswer, scoreAnswers } from '../answers';
import { MathExpr } from './Fraction';
import { AnswerInput } from './AnswerInput';

export function SolutionBlock({ question }: { question: Question }) {
  return (
    <div className="solution-block">
      <div className="solution-label">Lời giải chi tiết</div>
      {question.solution.map((line, i) => (
        <div key={i} className="solution-line">
          <MathExpr line={line} />
        </div>
      ))}
      {question.solutionNote ? <p className="solution-note">{question.solutionNote}</p> : null}
    </div>
  );
}

function QuestionPrompt({ question, index, total }: { question: Question; index: number; total: number }) {
  return (
    <div className="question-head">
      <span className="question-num">
        Câu {index + 1} trong {total}
      </span>
      <div className="question-label">{question.label}</div>
      {question.expr.length > 0 ? (
        <div className="question-expr">
          <MathExpr line={question.expr} large />
        </div>
      ) : null}
    </div>
  );
}

export function QuizRunner({
  questions,
  mode,
  accentColor,
  title,
  onWrongAnswer,
  onCorrectAnswer,
  onSubmitAssignment,
  onExit,
}: {
  questions: Question[];
  mode: 'practice' | 'assignment';
  accentColor: string;
  title: string;
  onWrongAnswer?: (questionId: string) => void;
  onCorrectAnswer?: (questionId: string) => void;
  onSubmitAssignment?: (answers: Record<string, StudentAnswer>, score: number, total: number) => void;
  onExit?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [current, setCurrent] = useState<StudentAnswer>({ type: 'empty' });
  const [checked, setChecked] = useState<boolean | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [submitted, setSubmitted] = useState(false);

  const question = questions[index];
  const total = questions.length;

  const assignmentScore = useMemo(
    () => (submitted ? scoreAnswers(questions, answers) : null),
    [submitted, questions, answers],
  );

  if (questions.length === 0) {
    return <div className="empty-state">Chưa có câu hỏi nào.</div>;
  }

  if (mode === 'assignment') {
    if (submitted && assignmentScore) {
      return (
        <div className="quiz-shell" style={{ borderTopColor: accentColor }}>
          <h3>{title}</h3>
          <div className="quiz-score">
            Điểm: {assignmentScore.score} trên {assignmentScore.total} câu đúng
          </div>
          <p className="guide-text">Bài đã nộp. Giáo viên sẽ xem và nhận xét.</p>
          {questions.map((q, i) => {
            const ok = checkAnswer(q, answers[q.id] ?? { type: 'empty' });
            return (
              <div key={q.id} className="review-item">
                <QuestionPrompt question={q} index={i} total={total} />
                <div className={ok ? 'feedback-ok' : 'feedback-bad'}>
                  {ok ? '✓ Đúng' : '✗ Chưa đúng'}
                </div>
                <SolutionBlock question={q} />
              </div>
            );
          })}
          {onExit ? (
            <button type="button" className="btn btn-secondary" onClick={onExit}>
              Quay lại
            </button>
          ) : null}
        </div>
      );
    }
    return (
      <div className="quiz-shell" style={{ borderTopColor: accentColor }}>
        <h3>{title}</h3>
        <p className="guide-text">Trả lời tất cả các câu rồi bấm Nộp bài. Bài được chấm tự động.</p>
        {questions.map((q, i) => (
          <div key={q.id} className="review-item">
            <QuestionPrompt question={q} index={i} total={total} />
            <AnswerInput
              key={q.id}
              question={q}
              disabled={false}
              onAnswer={(a) => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            const { score, total: t } = scoreAnswers(questions, answers);
            setSubmitted(true);
            onSubmitAssignment?.(answers, score, t);
          }}
        >
          Nộp bài
        </button>
      </div>
    );
  }

  // Practice mode.
  if (finished) {
    const correct = results.filter(Boolean).length;
    return (
      <div className="quiz-shell" style={{ borderTopColor: accentColor }}>
        <h3>{title}</h3>
        <div className="quiz-score">
          Kết quả: {correct} trên {total} câu đúng
        </div>
        <p className="guide-text">Câu làm sai đã vào Ngân hàng ôn tập trong Tutor Space.</p>
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIndex(0);
              setResults([]);
              setFinished(false);
              setChecked(null);
              setCurrent({ type: 'empty' });
            }}
          >
            Làm lại
          </button>
          {onExit ? (
            <button type="button" className="btn btn-secondary" onClick={onExit}>
              Quay lại
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const handleCheck = () => {
    const ok = checkAnswer(question, current);
    setChecked(ok);
    setResults((prev) => [...prev, ok]);
    if (ok) onCorrectAnswer?.(question.id);
    else onWrongAnswer?.(question.id);
  };

  const handleNext = () => {
    if (index + 1 >= total) {
      setFinished(true);
    } else {
      setIndex(index + 1);
      setChecked(null);
      setCurrent({ type: 'empty' });
    }
  };

  return (
    <div className="quiz-shell" style={{ borderTopColor: accentColor }}>
      <h3>{title}</h3>
      <QuestionPrompt question={question} index={index} total={total} />
      <AnswerInput
        key={question.id}
        question={question}
        disabled={checked !== null}
        onAnswer={setCurrent}
      />
      {checked === null ? (
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={handleCheck}>
            Kiểm tra
          </button>
        </div>
      ) : (
        <>
          <div className={checked ? 'feedback-ok' : 'feedback-bad'}>
            {checked ? '✓ Đúng rồi!' : '✗ Chưa đúng, xem lời giải nhé.'}
          </div>
          <SolutionBlock question={question} />
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={handleNext}>
              {index + 1 >= total ? 'Xem kết quả' : 'Câu tiếp theo'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

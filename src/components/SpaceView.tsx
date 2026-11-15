// Space: the student's own class space. Lists the work assigned to this
// student (whole-class or individual), lets them do it, and lets them
// rename their own Space. The rename is personal: it changes only the
// label this student sees.
import { useState } from 'react';
import type { Account, StudentAnswer } from '../types';
import { QUESTIONS } from '../data/questions';
import { assignmentVisibleToStudent, spaceNameFor } from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import type { Route } from '../route';
import { QuizRunner } from './QuizRunner';
import { dueLabel, EmptyState, SectionBand, formatDate } from './ui';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export function SpaceView({
  account,
  route,
  go,
}: {
  account: Account;
  route: Route;
  go: (route: Route) => void;
}) {
  const { state, dispatch } = useStore();
  const spaceName = spaceNameFor(account, REFERENCE.CLASSES, state.spaceNames);
  const assignments = state.assignments.filter((a) => assignmentVisibleToStudent(a, account));
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(spaceName);
  const [renameHint, setRenameHint] = useState<string | null>(null);

  const selected = route.assignmentId
    ? assignments.find((a) => a.id === route.assignmentId)
    : undefined;

  if (route.assignmentId && !selected) {
    return <EmptyState text="Không tìm thấy bài giao này trong phạm vi của bạn." />;
  }

  if (selected) {
    const lesson = state.lessons.find((l) => l.id === selected.lessonId);
    const questions = QUESTIONS.filter((q) => lesson?.questionIds.includes(q.id));
    const mySubmission = state.submissions.find(
      (s) => s.assignmentId === selected.id && s.studentId === account.id,
    );
    if (mySubmission) {
      return (
        <div>
          <button type="button" className="btn btn-ghost" onClick={() => go({ view: 'assignments' })}>
            ← Quay lại danh sách
          </button>
          <SectionBand title={selected.title} guide={`Hạn ${formatDate(selected.dueDate)}.`} />
          <div className="quiz-score">
            Bạn đã nộp: {mySubmission.score} trên {mySubmission.total} câu đúng
          </div>
          {mySubmission.comment ? (
            <p className="comment-box">Nhận xét của giáo viên: {mySubmission.comment}</p>
          ) : (
            <p className="guide-text">Giáo viên chưa nhận xét bài này.</p>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => go({ view: 'lesson', lessonId: selected.lessonId, tab: 'content' })}
          >
            Xem lại bài học
          </button>
        </div>
      );
    }
    return (
      <div>
        <button type="button" className="btn btn-ghost" onClick={() => go({ view: 'assignments' })}>
          ← Quay lại danh sách
        </button>
        <SectionBand
          title={selected.title}
          guide={`Hạn ${formatDate(selected.dueDate)} (${dueLabel(selected.dueDate)}). Bài được chấm tự động khi nộp.`}
        />
        <QuizRunner
          questions={questions}
          mode="assignment"
          accentColor={lesson?.color ?? '#2563eb'}
          title="Bài làm của bạn"
          onSubmitAssignment={(answers: Record<string, StudentAnswer>, score: number, total: number) => {
            dispatch({
              type: 'SUBMIT_WORK',
              submission: {
                id: `SUB-${Date.now()}`,
                assignmentId: selected.id,
                studentId: account.id,
                answers,
                score,
                total,
                submittedAt: todayIso(),
                reviewed: false,
              },
            });
          }}
          onExit={() => go({ view: 'assignments' })}
        />
      </div>
    );
  }

  return (
    <div>
      <SectionBand
        title={spaceName}
        guide="Các bài được giao cho em. Bấm vào để làm bài."
      />
      {renaming ? (
        <div className="form-card">
          <label className="field">
            <span>Tên Space của em</span>
            <input
              value={draftName}
              maxLength={60}
              onChange={(e) => {
                setDraftName(e.target.value);
                setRenameHint(null);
              }}
              placeholder="Ví dụ: Góc học Toán của em"
            />
          </label>
          {renameHint ? <p className="guide-text">{renameHint}</p> : null}
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const name = draftName.trim();
                if (name === '') {
                  setRenameHint('Tên Space không được để trống. Tên cũ vẫn được giữ.');
                  return;
                }
                dispatch({ type: 'RENAME_SPACE', studentId: account.id, name });
                setRenaming(false);
                setRenameHint(null);
              }}
            >
              Lưu
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setRenaming(false);
                setDraftName(spaceName);
                setRenameHint(null);
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      ) : (
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDraftName(spaceName);
              setRenaming(true);
            }}
          >
            Đổi tên Space
          </button>
        </div>
      )}

      <h3 className="subhead">Bài được giao</h3>
      {assignments.length === 0 ? (
        <EmptyState text="Chưa có bài giao nào." />
      ) : (
        <div className="todo-list">
          {assignments.map((a) => {
            const mine = state.submissions.find(
              (s) => s.assignmentId === a.id && s.studentId === account.id,
            );
            return (
              <button
                key={a.id}
                type="button"
                className="todo-row"
                onClick={() => go({ view: 'assignments', assignmentId: a.id })}
              >
                <span>
                  <strong>{a.title}</strong> · {REFERENCE.CLASSES.find((c) => c.id === a.classId)?.name} · Hạn{' '}
                  {formatDate(a.dueDate)} ({dueLabel(a.dueDate)})
                </span>
                <span className={mine ? 'status-done' : 'status-todo'}>
                  {mine ? `Đã nộp: ${mine.score} trên ${mine.total}` : 'Chưa làm'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

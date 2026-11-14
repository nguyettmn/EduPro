// Assignments: teachers create them, students do them (auto-scored),
// teachers review with comments. Scoped to visible classes via permissions.
import { useState } from 'react';
import type { Account, Assignment, StudentAnswer } from '../types';
import { QUESTIONS } from '../data/questions';
import { canDo, visibleClasses } from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import type { Route } from '../route';
import { QuizRunner } from './QuizRunner';
import { dueLabel, EmptyState, SectionBand, formatDate } from './ui';

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const plusDays = (n: number): string =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function lessonTitle(lessons: { id: string; title: string }[], id: string): string {
  return lessons.find((l) => l.id === id)?.title ?? id;
}

export function AssignmentsView({
  account,
  route,
  go,
}: {
  account: Account;
  route: Route;
  go: (route: Route) => void;
}) {
  const { state, dispatch } = useStore();
  const classes = visibleClasses(account, REFERENCE.CLASSES);
  const assignments = state.assignments.filter((a) => classes.some((c) => c.id === a.classId));
  const isAssigner = canDo(account, 'assign');
  const isStudent = canDo(account, 'useTutor');

  const [lessonId, setLessonId] = useState('L1');
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(plusDays(7));
  const [attempts, setAttempts] = useState(2);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const selected = route.assignmentId
    ? assignments.find((a) => a.id === route.assignmentId)
    : undefined;

  if (route.assignmentId && !selected) {
    return <EmptyState text="Không tìm thấy bài giao này trong phạm vi của bạn." />;
  }

  if (selected) {
    const lesson = state.lessons.find((l) => l.id === selected.lessonId);
    const questions = QUESTIONS.filter((q) => lesson?.questionIds.includes(q.id));
    const submissions = state.submissions.filter((s) => s.assignmentId === selected.id);
    const mySubmission =
      isStudent
        ? submissions.find((s) => s.studentId === account.id)
        : undefined;
    const canGradeHere =
      canDo(account, 'grade') && account.classIds.includes(selected.classId);

    // Student doing (or reviewing) the assignment.
    if (isStudent) {
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

    // Assigner inspecting submissions.
    return (
      <div>
        <button type="button" className="btn btn-ghost" onClick={() => go({ view: 'assignments' })}>
          ← Quay lại danh sách
        </button>
        <SectionBand
          title={selected.title}
          guide={`${REFERENCE.CLASSES.find((c) => c.id === selected.classId)?.name ?? ''} · Hạn ${formatDate(selected.dueDate)} · ${lessonTitle(state.lessons, selected.lessonId)}`}
        />
        {submissions.length === 0 ? (
          <EmptyState text="Chưa có học sinh nào nộp bài." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Điểm</th>
                  <th>Ngày nộp</th>
                  <th>Nhận xét</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const student = state.accounts.find((a) => a.id === s.studentId);
                  return (
                    <tr key={s.id}>
                      <td>{student?.name ?? s.studentId}</td>
                      <td>
                        {s.score} trên {s.total}
                      </td>
                      <td>{formatDate(s.submittedAt)}</td>
                      <td>
                        {canGradeHere ? (
                          <span className="comment-editor">
                            <input
                              aria-label={`Nhận xét cho ${student?.name ?? ''}`}
                              placeholder="Viết nhận xét"
                              value={commentDrafts[s.id] ?? s.comment ?? ''}
                              onChange={(e) =>
                                setCommentDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-small"
                              onClick={() =>
                                dispatch({
                                  type: 'ADD_COMMENT',
                                  submissionId: s.id,
                                  comment: commentDrafts[s.id] ?? '',
                                })
                              }
                            >
                              Lưu
                            </button>
                          </span>
                        ) : (
                          s.comment ?? '—'
                        )}
                      </td>
                      <td>
                        {s.reviewed ? (
                          'Đã chấm'
                        ) : canGradeHere ? (
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => dispatch({ type: 'MARK_REVIEWED', submissionId: s.id })}
                          >
                            Đánh dấu đã chấm
                          </button>
                        ) : (
                          'Chờ chấm'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const packLessons = state.lessons.filter((l) => !l.ownerId);

  return (
    <div>
      <SectionBand
        title="Giao bài"
        guide={
          isAssigner
            ? 'Tạo bài giao cho lớp, rồi xem bài học sinh đã nộp.'
            : 'Các bài được giao cho lớp của bạn. Bấm vào để làm bài.'
        }
      />
      {isAssigner ? (
        <div className="form-card">
          <h3 className="subhead">Giao bài mới</h3>
          <label className="field">
            <span>Bài học</span>
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              {packLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Lớp</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Tiêu đề</span>
            <input
              value={title}
              placeholder={lessonTitle(packLessons, lessonId)}
              onChange={(e) => setTitle(e.target.value)}
            />
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
            disabled={classId === ''}
            onClick={() => {
              const lesson = packLessons.find((l) => l.id === lessonId);
              dispatch({
                type: 'CREATE_ASSIGNMENT',
                assignment: {
                  id: `ASG-${Date.now()}`,
                  lessonId,
                  title: title.trim() !== '' ? title.trim() : `Luyện tập: ${lesson?.title ?? ''}`,
                  classId,
                  createdBy: account.id,
                  dueDate,
                  attemptsAllowed: attempts,
                  status: 'active',
                  createdAt: todayIso(),
                } as Assignment,
              });
              setTitle('');
            }}
          >
            Giao bài
          </button>
        </div>
      ) : null}

      <h3 className="subhead">Danh sách bài giao</h3>
      {assignments.length === 0 ? (
        <EmptyState text="Chưa có bài giao nào." />
      ) : (
        <div className="todo-list">
          {assignments.map((a) => {
            const subs = state.submissions.filter((s) => s.assignmentId === a.id);
            const mine = subs.find((s) => s.studentId === account.id);
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
                <span className="muted">
                  {isStudent
                    ? mine
                      ? `Đã nộp: ${mine.score} trên ${mine.total}`
                      : 'Chưa làm'
                    : `${subs.length} bài đã nộp`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

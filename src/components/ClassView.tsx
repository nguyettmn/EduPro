// Lớp học: the teacher's home for one class. Pick a class, then see its
// roster and progress, its assignments, and grade submissions with the
// student's actual answers shown. Scoped through the permission table.
import { useEffect, useState } from 'react';
import type { Account, Answer, Assignment, Question, StudentAnswer } from '../types';
import { GRADES } from '../ai/subjects';
import { QUESTIONS } from '../data/questions';
import { checkAnswer } from '../answers';
import {
  canDo,
  canViewTutorSummary,
  visibleClasses,
  visibleStudents,
} from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import type { Route } from '../route';
import { Fraction, MathExpr, MixedNumber } from './Fraction';
import { SolutionBlock } from './QuizRunner';
import { AddStudentForm } from './ManageViews';
import { dueLabel, EmptyState, SectionBand, formatDate } from './ui';

function topicTitle(topicId: string): string {
  const t = REFERENCE.PACK.topics.find((x) => x.id === topicId);
  return t ? `${t.code} · ${t.title}` : topicId;
}

/** Students an assignment expects: the listed students, or the whole class. */
function expectedStudents(assignment: Assignment, accounts: Account[]): Account[] {
  if (assignment.studentIds && assignment.studentIds.length > 0) {
    return assignment.studentIds
      .map((id) => accounts.find((a) => a.id === id))
      .filter((a): a is Account => Boolean(a));
  }
  return accounts.filter(
    (a) => a.role === 'student' && a.classIds.includes(assignment.classId),
  );
}

/** Renders one answer value (student's or correct) with stacked fractions. */
function AnswerValue({ value, question }: { value: StudentAnswer | Answer; question: Question }) {
  switch (value.type) {
    case 'empty':
      return <span className="muted">Chưa trả lời</span>;
    case 'fraction':
      return <Fraction n={value.n} d={value.d} />;
    case 'mixed':
      return <MixedNumber w={value.w} n={value.n} d={value.d} />;
    case 'whole':
      return <span className="math-text">{value.v}</span>;
    case 'decimal':
      return <span className="math-text">{'display' in value ? value.display : String(value.v)}</span>;
    case 'choice': {
      const line = question.choices?.[value.index];
      return line ? <MathExpr line={line} /> : <span className="muted">Không rõ lựa chọn</span>;
    }
  }
}

function GradingDetail({
  account,
  assignment,
  initialStudentId,
  onBack,
}: {
  account: Account;
  assignment: Assignment;
  /** Deep link: open this student's submission first (from "Hôm nay"). */
  initialStudentId?: string;
  onBack: () => void;
}) {
  const { state, dispatch } = useStore();
  const lesson = state.lessons.find((l) => l.id === assignment.lessonId);
  const questions = QUESTIONS.filter((q) => lesson?.questionIds.includes(q.id));
  const submissions = state.submissions.filter((s) => s.assignmentId === assignment.id);
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    if (initialStudentId) {
      const named = submissions.find((s) => s.studentId === initialStudentId);
      if (named) return named.id;
    }
    return submissions[0]?.id ?? null;
  });
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const canGradeHere = canDo(account, 'grade') && account.classIds.includes(assignment.classId);

  const expanded = submissions.find((s) => s.id === expandedId);
  const expandedIndex = expanded ? submissions.findIndex((s) => s.id === expanded.id) : -1;

  return (
    <div>
      <button type="button" className="btn btn-ghost" onClick={onBack}>
        ← Quay lại danh sách
      </button>
      <SectionBand
        title={assignment.title}
        guide={`${state.classes.find((c) => c.id === assignment.classId)?.name ?? ''} · Hạn ${formatDate(assignment.dueDate)} (${dueLabel(assignment.dueDate)}) · ${lesson?.title ?? ''}`}
      />
      {notice ? <p className="notice">{notice}</p> : null}
      {submissions.length === 0 ? (
        <EmptyState text="Chưa có học sinh nào nộp bài." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Điểm</th>
                  <th>Ngày nộp</th>
                  <th>Trạng thái</th>
                  <th />
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
                      <td>{s.reviewed ? 'Đã chấm' : 'Chờ chấm'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => setExpandedId(s.id)}
                        >
                          Xem bài làm
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {expanded ? (
            <div className="form-card">
              <h3 className="subhead">
                Bài làm của {state.accounts.find((a) => a.id === expanded.studentId)?.name ?? ''} —{' '}
                {expanded.score} trên {expanded.total} câu đúng
              </h3>
              {questions.map((q, i) => {
                const given = expanded.answers[q.id] ?? { type: 'empty' as const };
                const ok = checkAnswer(q, given);
                return (
                  <div key={q.id} className="review-item">
                    <div className="question-head">
                      <span className="question-num">Câu {i + 1}</span>
                      <div className="question-label">{q.label}</div>
                      {q.expr.length > 0 ? (
                        <div className="question-expr">
                          <MathExpr line={q.expr} large />
                        </div>
                      ) : null}
                    </div>
                    <div className="answer-pair">
                      <span>
                        <strong>Bài làm của em: </strong>
                        <AnswerValue value={given} question={q} />
                      </span>
                      <span>
                        <strong>Đáp án đúng: </strong>
                        <AnswerValue value={q.answer} question={q} />
                      </span>
                      <span className={ok ? 'feedback-ok' : 'feedback-bad'}>
                        {ok ? '✓ Đúng' : '✗ Chưa đúng'}
                      </span>
                    </div>
                    {!ok ? <SolutionBlock question={q} /> : null}
                  </div>
                );
              })}
              {canGradeHere ? (
                <>
                  <label className="field">
                    <span>Nhận xét cho học sinh</span>
                    <input
                      value={commentDrafts[expanded.id] ?? expanded.comment ?? ''}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({ ...prev, [expanded.id]: e.target.value }))
                      }
                      placeholder="Viết nhận xét"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const comment = commentDrafts[expanded.id] ?? expanded.comment ?? '';
                      dispatch({ type: 'ADD_COMMENT', submissionId: expanded.id, comment });
                      dispatch({ type: 'MARK_REVIEWED', submissionId: expanded.id });
                      setNotice('Đã lưu nhận xét và đánh dấu đã chấm.');
                    }}
                  >
                    Lưu nhận xét &amp; đánh dấu đã chấm
                  </button>
                </>
              ) : expanded.comment ? (
                <p className="comment-box">Nhận xét của giáo viên: {expanded.comment}</p>
              ) : (
                <p className="guide-text">Giáo viên chưa nhận xét bài này.</p>
              )}
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={expandedIndex <= 0}
                  onClick={() => setExpandedId(submissions[expandedIndex - 1].id)}
                >
                  ← Bài trước
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={expandedIndex < 0 || expandedIndex >= submissions.length - 1}
                  onClick={() => setExpandedId(submissions[expandedIndex + 1].id)}
                >
                  Bài tiếp theo →
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Teachers create their own classes here (user decision 2026-11-15).
 * The new class belongs to the teacher's school + team, and the teacher
 * is its teacher. Students are added to it by email, in the roster tab. */
function CreateClassForm({
  account,
  defaultGrade,
  go,
}: {
  account: Account;
  defaultGrade: number;
  go: (route: Route) => void;
}) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(defaultGrade);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // When the teacher switches classes with the form closed, default the
  // new class's grade to the class they are looking at.
  useEffect(() => {
    if (!open) setGrade(defaultGrade);
  }, [defaultGrade, open]);

  if (!canDo(account, 'createClass') || !account.schoolId || !account.teamId) return null;

  if (!open) {
    return (
      <div>
        {notice ? <p className="notice">{notice}</p> : null}
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          + Tạo lớp mới
        </button>
      </div>
    );
  }

  return (
    <div className="form-card">
      <h3 className="subhead">Tạo lớp mới</h3>
      <div className="field-row">
        <label className="field">
          <span>Tên lớp</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Lớp 5C" />
        </label>
        <label className="field">
          <span>Khối</span>
          <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Khối {g}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className="feedback-bad">{error}</p> : null}
      <div className="row-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={name.trim() === ''}
          onClick={() => {
            const cleanName = name.trim();
            const duplicate = state.classes.some(
              (c) => c.schoolId === account.schoolId && c.name.toLowerCase() === cleanName.toLowerCase(),
            );
            if (duplicate) {
              setError('Trường này đã có một lớp tên như vậy rồi.');
              return;
            }
            const id = `C-${Date.now()}`;
            dispatch({
              type: 'CREATE_CLASS',
              classGroup: {
                id,
                schoolId: account.schoolId ?? '',
                teamId: account.teamId ?? '',
                name: cleanName,
                grade,
                teacherId: account.id,
              },
            });
            setNotice(`Đã tạo ${cleanName}. Thêm học sinh bằng email trong tab Học sinh nhé.`);
            setName('');
            setError(null);
            setOpen(false);
            go({ view: 'classes', classId: id });
          }}
        >
          Tạo lớp
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Hủy
        </button>
      </div>
    </div>
  );
}

export function ClassView({
  account,
  route,
  go,
}: {
  account: Account;
  route: Route;
  go: (route: Route) => void;
}) {
  const { state } = useStore();
  const classes = visibleClasses(account, state.classes);
  const [tab, setTab] = useState<'roster' | 'assignments'>(route.assignmentId ? 'assignments' : 'roster');
  const [gradingId, setGradingId] = useState<string | null>(route.assignmentId ?? null);

  useEffect(() => {
    setGradingId(route.assignmentId ?? null);
    if (route.assignmentId) setTab('assignments');
  }, [route.assignmentId]);

  const routeAssignment = route.assignmentId
    ? state.assignments.find((a) => a.id === route.assignmentId)
    : undefined;
  const activeClassId =
    route.classId && classes.some((c) => c.id === route.classId)
      ? route.classId
      : routeAssignment && classes.some((c) => c.id === routeAssignment.classId)
        ? routeAssignment.classId
        : (classes[0]?.id ?? '');
  const activeClass = state.classes.find((c) => c.id === activeClassId);

  if (classes.length === 0 || !activeClass) {
    return <EmptyState text="Bạn chưa có lớp nào trong phạm vi của mình." />;
  }
  if (route.assignmentId && (!routeAssignment || !classes.some((c) => c.id === routeAssignment.classId))) {
    return <EmptyState text="Không tìm thấy bài giao này trong phạm vi của bạn." />;
  }

  const students = visibleStudents(account, state.accounts).filter((s) =>
    s.classIds.includes(activeClassId),
  );
  const classAssignments = state.assignments.filter((a) => a.classId === activeClassId);
  const grading = gradingId ? classAssignments.find((a) => a.id === gradingId) : undefined;

  const studentStats = (studentId: string) => {
    const subs = state.submissions.filter((s) => s.studentId === studentId);
    const avg =
      subs.length > 0
        ? Math.round((subs.reduce((sum, s) => sum + s.score / Math.max(s.total, 1), 0) / subs.length) * 100)
        : null;
    return { submitted: subs.length, avg };
  };

  const weakTopicsLabel = (student: Account): string => {
    if (!canViewTutorSummary(account, student, state.accounts)) return '—';
    const t = state.tutor[student.id];
    if (!t || t.weakTopics.length === 0) return 'Không có chủ đề yếu';
    return t.weakTopics.map(topicTitle).join(', ');
  };

  if (tab === 'assignments' && grading) {
    return (
      <GradingDetail
        key={`${grading.id}:${route.studentId ?? ''}`}
        account={account}
        assignment={grading}
        initialStudentId={route.studentId}
        onBack={() => setGradingId(null)}
      />
    );
  }

  return (
    <div>
      <SectionBand
        title={activeClass.name}
        guide="Danh sách học sinh, bài giao và chấm bài của lớp này."
      />
      <label className="field field-inline">
        <span>Chọn lớp</span>
        <select value={activeClassId} onChange={(e) => go({ view: 'classes', classId: e.target.value })}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <CreateClassForm account={account} defaultGrade={activeClass.grade} go={go} />
      <div className="tabs" role="tablist">
        <button
          type="button"
          className={tab === 'roster' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('roster')}
        >
          Học sinh ({students.length})
        </button>
        <button
          type="button"
          className={tab === 'assignments' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('assignments')}
        >
          Bài giao ({classAssignments.length})
        </button>
      </div>

      {tab === 'roster' ? (
        <>
          {students.length === 0 ? (
            <EmptyState text="Lớp này chưa có học sinh nào." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Bài đã nộp</th>
                    <th>Điểm trung bình</th>
                    <th>Chủ đề yếu (tóm tắt)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => {
                    const stats = studentStats(st.id);
                    return (
                      <tr key={st.id}>
                        <td>{st.name}</td>
                        <td>{stats.submitted}</td>
                        <td>{stats.avg === null ? '—' : `${stats.avg}%`}</td>
                        <td>{weakTopicsLabel(st)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() =>
                              go({ view: 'tutor', studentId: st.id, from: 'classes', classId: activeClassId })
                            }
                          >
                            Xem tóm tắt
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <AddStudentForm account={account} fixedClassId={activeClassId} />
        </>
      ) : (
        <>
          {classAssignments.length === 0 ? (
            <EmptyState text="Lớp này chưa có bài giao nào. Soạn bài xong thì giao ngay từ bài học đó." />
          ) : (
            <div className="todo-list">
              {classAssignments.map((a) => {
                const subs = state.submissions.filter((s) => s.assignmentId === a.id);
                const pending = expectedStudents(a, state.accounts).filter(
                  (st) => !subs.some((s) => s.studentId === st.id),
                );
                return (
                  <button
                    key={a.id}
                    type="button"
                    className="todo-row"
                    onClick={() => setGradingId(a.id)}
                  >
                    <span>
                      <strong>{a.title}</strong> · Hạn {formatDate(a.dueDate)} ({dueLabel(a.dueDate)})
                      {a.studentIds && a.studentIds.length > 0 ? ' · Giao riêng' : null}
                    </span>
                    <span className="muted">
                      {subs.length} bài đã nộp
                      {pending.length > 0 ? ` · Chưa nộp: ${pending.map((s) => s.name).join(', ')}` : ' · Tất cả đã nộp'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

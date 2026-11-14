// Role dashboards. Every number comes from live demo state, and every list
// is scoped through the permission table (never hardcoded by role).
import type { Account } from '../types';
import { ROLE_META } from '../types';
import {
  canDecideProposal,
  canViewTutorSummary,
  managedAccounts,
  visibleClasses,
  visibleStudents,
  visibleTeachers,
} from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import type { Route } from '../route';
import { RoleBadge } from './RoleBadge';
import { dueLabel, EmptyState, SectionBand, StatCard, formatDate } from './ui';

function className(classId: string): string {
  return REFERENCE.CLASSES.find((c) => c.id === classId)?.name ?? classId;
}

function accountName(accounts: Account[], id: string): string {
  return accounts.find((a) => a.id === id)?.name ?? 'Không rõ';
}

function topicTitle(topicId: string): string {
  const t = REFERENCE.PACK.topics.find((x) => x.id === topicId);
  return t ? `${t.code} · ${t.title}` : topicId;
}

export function Dashboard({ account, go }: { account: Account; go: (route: Route) => void }) {
  const { state } = useStore();
  const meta = ROLE_META[account.role];
  const students = visibleStudents(account, state.accounts);
  const teachers = visibleTeachers(account, state.accounts);
  const classes = visibleClasses(account, REFERENCE.CLASSES);
  const myAssignments = state.assignments.filter((a) => classes.some((c) => c.id === a.classId));
  const pendingForMe = state.proposals.filter(
    (p) => p.status === 'pending' && canDecideProposal(account, p, state.accounts),
  );

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

  return (
    <div>
      <SectionBand
        title={`Xin chào, ${account.name}`}
        guide={
          account.role === 'student'
            ? 'Việc cần làm hôm nay ở bên dưới. Bấm vào bài để làm.'
            : 'Tổng quan trong phạm vi bạn quản lý. Mọi con số đều từ dữ liệu demo.'
        }
        color={meta.color}
      />

      {account.role === 'admin' ? (
        <>
          <div className="stat-grid">
            <StatCard label="Trường" value={String(REFERENCE.SCHOOLS.length)} color={meta.color} />
            <StatCard label="Tài khoản" value={String(state.accounts.length)} color={meta.color} />
            <StatCard label="Bài đang giao" value={String(state.assignments.filter((a) => a.status === 'active').length)} color={meta.color} />
            <StatCard label="Đề xuất chờ duyệt" value={String(state.proposals.filter((p) => p.status === 'pending').length)} color={meta.color} />
          </div>
          <h3 className="subhead">Các trường</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Trường</th>
                  <th>Giáo viên</th>
                  <th>Học sinh</th>
                  <th>Bài đang giao</th>
                </tr>
              </thead>
              <tbody>
                {REFERENCE.SCHOOLS.map((s) => {
                  const schoolAccounts = state.accounts.filter((a) => a.schoolId === s.id);
                  const schoolClasses = REFERENCE.CLASSES.filter((c) => c.schoolId === s.id);
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{schoolAccounts.filter((a) => a.role === 'teacher').length}</td>
                      <td>{schoolAccounts.filter((a) => a.role === 'student').length}</td>
                      <td>
                        {state.assignments.filter((a) => schoolClasses.some((c) => c.id === a.classId)).length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="guide-text">
            Lọc theo trường trong trang Quản lý để xem tài khoản từng trường. Tutor Space của học sinh không bao giờ
            hiện nội dung, kể cả với Admin.
          </p>
        </>
      ) : null}

      {account.role === 'principal' ? (
        <>
          <div className="stat-grid">
            <StatCard label="Giáo viên" value={String(teachers.length)} color={meta.color} />
            <StatCard label="Học sinh" value={String(students.length)} color={meta.color} />
            <StatCard label="Bài đang giao" value={String(myAssignments.filter((a) => a.status === 'active').length)} color={meta.color} />
            <StatCard label="Chờ bạn duyệt" value={String(pendingForMe.length)} color={meta.color} />
          </div>
          <h3 className="subhead">Tiến độ giáo viên</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Giáo viên</th>
                  <th>Lớp</th>
                  <th>Bài đã giao</th>
                  <th>Bài chờ chấm</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => {
                  const assigned = state.assignments.filter((a) => a.createdBy === t.id);
                  const waiting = state.submissions.filter(
                    (s) =>
                      assigned.some((a) => a.id === s.assignmentId) && !s.reviewed,
                  ).length;
                  return (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.classIds.map(className).join(', ')}</td>
                      <td>{assigned.length}</td>
                      <td>{waiting}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <StudentProgressTable
            students={students}
            studentStats={studentStats}
            weakTopicsLabel={weakTopicsLabel}
            go={go}
          />
        </>
      ) : null}

      {account.role === 'lead' ? (
        <>
          <div className="stat-grid">
            <StatCard label="Giáo viên trong tổ" value={String(teachers.length)} color={meta.color} />
            <StatCard label="Học sinh trong tổ" value={String(students.length)} color={meta.color} />
            <StatCard label="Chờ bạn duyệt (Kho Tổ)" value={String(pendingForMe.length)} color={meta.color} />
          </div>
          <h3 className="subhead">Giáo viên trong tổ</h3>
          {teachers.length === 0 ? (
            <EmptyState text="Chưa có giáo viên nào trong tổ." />
          ) : (
            <div className="person-list">
              {teachers.map((t) => (
                <div key={t.id} className="person-row">
                  <RoleBadge account={t} />
                  <span className="muted">{t.classIds.map(className).join(', ')}</span>
                </div>
              ))}
            </div>
          )}
          <p className="guide-text">
            Bạn chỉ thấy giáo viên và học sinh thuộc tổ mình quản lý. Giáo viên tổ khác không xuất hiện ở đây.
          </p>
          {pendingForMe.length > 0 ? (
            <button type="button" className="btn btn-primary" onClick={() => go({ view: 'repo' })}>
              Xem đề xuất chờ duyệt
            </button>
          ) : null}
        </>
      ) : null}

      {account.role === 'teacher' ? (
        <>
          <div className="stat-grid">
            <StatCard label="Học sinh" value={String(students.length)} color={meta.color} />
            <StatCard
              label="Bài chờ chấm"
              value={String(
                state.submissions.filter(
                  (s) =>
                    myAssignments.some((a) => a.id === s.assignmentId) && !s.reviewed,
                ).length,
              )}
              color={meta.color}
            />
            <StatCard label="Đề xuất chờ bạn duyệt" value={String(pendingForMe.length)} color={meta.color} />
          </div>
          <h3 className="subhead">Việc cần làm</h3>
          <div className="todo-list">
            {state.submissions
              .filter((s) => myAssignments.some((a) => a.id === s.assignmentId) && !s.reviewed)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="todo-row"
                  onClick={() => go({ view: 'assignments', assignmentId: s.assignmentId })}
                >
                  Chấm bài của {accountName(state.accounts, s.studentId)} — {s.score} trên {s.total} câu đúng
                </button>
              ))}
            {pendingForMe.map((p) => (
              <button key={p.id} type="button" className="todo-row" onClick={() => go({ view: 'repo' })}>
                Duyệt đề xuất: {p.title} (của {p.anonymous ? 'Ẩn danh' : p.createdByName})
              </button>
            ))}
            {students
              .filter(
                (st) =>
                  !state.submissions.some(
                    (s) => s.studentId === st.id && myAssignments.some((a) => a.id === s.assignmentId),
                  ),
              )
              .map((st) => (
                <div key={st.id} className="todo-row todo-muted">
                  {st.name} chưa nộp bài nào
                </div>
              ))}
          </div>
          <StudentProgressTable
            students={students}
            studentStats={studentStats}
            weakTopicsLabel={weakTopicsLabel}
            go={go}
          />
        </>
      ) : null}

      {account.role === 'student' ? (
        <>
          <div className="stat-grid">
            <StatCard
              label="Buổi luyện trong Tutor Space"
              value={String(state.tutor[account.id]?.sessions ?? 0)}
              color={meta.color}
            />
            <StatCard
              label="Câu cần ôn lại"
              value={String(state.tutor[account.id]?.reviewQuestionIds.length ?? 0)}
              color={meta.color}
            />
          </div>
          <h3 className="subhead">Việc cần làm hôm nay</h3>
          {myAssignments.length === 0 ? (
            <EmptyState text="Hôm nay không có bài nào được giao." />
          ) : (
            <div className="todo-list">
              {myAssignments.map((a) => {
                const sub = state.submissions.find(
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
                      <strong>{a.title}</strong> · {className(a.classId)} · Hạn {formatDate(a.dueDate)} (
                      {dueLabel(a.dueDate)})
                    </span>
                    <span className={sub ? 'status-done' : 'status-todo'}>
                      {sub ? `Đã nộp: ${sub.score} trên ${sub.total}` : 'Chưa làm'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={() => go({ view: 'tutor' })}>
              Vào Tutor Space của tôi
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => go({ view: 'library' })}>
              Vào Thư viện
            </button>
          </div>
          <p className="guide-text">
            Chủ đề em còn yếu: {weakTopicsLabel(account)}. Tutor Space là của riêng em, thầy cô chỉ thấy tóm tắt
            chung, không đọc được nội dung bên trong.
          </p>
        </>
      ) : null}

      {account.role !== 'student' && managedAccounts(account, state.accounts).length > 0 ? (
        <p className="guide-text">
          Bạn quản lý {managedAccounts(account, state.accounts).length} tài khoản. Bạn thấy hết nội dung, bài giao và
          kết quả của họ, trừ nội dung bên trong Tutor Space của học sinh.
        </p>
      ) : null}
    </div>
  );
}

function StudentProgressTable({
  students,
  studentStats,
  weakTopicsLabel,
  go,
}: {
  students: Account[];
  studentStats: (studentId: string) => { submitted: number; avg: number | null };
  weakTopicsLabel: (student: Account) => string;
  go: (route: Route) => void;
}) {
  return (
    <>
      <h3 className="subhead">Tiến độ học sinh</h3>
      {students.length === 0 ? (
        <EmptyState text="Chưa có học sinh nào trong phạm vi của bạn." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Học sinh</th>
                <th>Lớp</th>
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
                    <td>{st.classIds.map(className).join(', ')}</td>
                    <td>{stats.submitted}</td>
                    <td>{stats.avg === null ? '—' : `${stats.avg}%`}</td>
                    <td>{weakTopicsLabel(st)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => go({ view: 'tutor', studentId: st.id })}
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
    </>
  );
}

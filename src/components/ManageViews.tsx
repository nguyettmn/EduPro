// Manage: account and progress lists scoped by the permission table,
// pending-account approval for the principal, promotion to Team Lead,
// and the invite-by-email flow for adding students to a class.
// Students are added by email (see AddStudentForm): teachers never
// create student accounts directly (user decision 2026-11-15).
import { useState } from 'react';
import type { Account } from '../types';
import { ROLE_META } from '../types';
import { canDo, visibleClasses, visibleStudents, visibleTeachers } from '../permissions';
import { useStore } from '../state/store';
import { getAccessToken, supabase } from '../supabase/client';
import { RoleBadge } from './RoleBadge';
import { TeachingProfileForm } from './TeachingProfile';
import { EmptyState, SectionBand } from './ui';

export function AddStudentForm({
  account,
  fixedClassId,
}: {
  account: Account;
  /** When set, the class select is hidden and the student joins this class. */
  fixedClassId?: string;
}) {
  const { state, auth } = useStore();
  const classes = visibleClasses(account, state.classes);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canDo(account, 'addStudent') || classes.length === 0) return null;
  const effectiveClassId = fixedClassId ?? classId;

  const submit = async () => {
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Email chưa đúng định dạng. Ví dụ: lan@example.com');
      return;
    }
    const alreadyInClass = state.accounts.some(
      (a) =>
        a.email?.toLowerCase() === cleanEmail.toLowerCase() &&
        a.classIds.includes(effectiveClassId),
    );
    if (alreadyInClass) {
      setError('Email này đã có trong lớp rồi.');
      return;
    }
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: cleanEmail,
          name: name.trim() || undefined,
          role: 'student',
          classId: effectiveClassId,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; status?: string; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'Không thêm được học sinh. Hãy thử lại.');
        return;
      }
      const displayName = name.trim() || cleanEmail.split('@')[0];
      setAdded(
        data.status === 'invited'
          ? `${displayName} (${cleanEmail}) — đã gửi email mời. Em sẽ đặt mật khẩu qua link trong email rồi đăng nhập vào lớp.`
          : `${displayName} (${cleanEmail}) — đã có tài khoản nên được thêm vào lớp ngay.`,
      );
      setEmail('');
      setName('');
      auth.refresh();
    } catch {
      setError('Không kết nối được tới máy chủ. Hãy kiểm tra mạng rồi thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-card">
      <h3 className="subhead">Thêm học sinh bằng email</h3>
      <p className="guide-text">
        Nhập email của học sinh để thêm em vào lớp. Nếu em chưa có tài khoản, EduPro sẽ gửi email mời em đặt mật
        khẩu; nếu em đã có tài khoản thì em vào lớp ngay.
      </p>
      <div className="field-row">
        <label className="field">
          <span>Email học sinh</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ví dụ: lan@example.com"
            inputMode="email"
          />
        </label>
        <label className="field">
          <span>Tên học sinh (không bắt buộc)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Để trống thì lấy phần trước @"
          />
        </label>
        {fixedClassId ? null : (
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
        )}
      </div>
      {error ? <p className="feedback-bad">{error}</p> : null}
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || email.trim() === '' || effectiveClassId === ''}
        onClick={() => void submit()}
      >
        {busy ? 'Đang thêm…' : 'Thêm vào lớp'}
      </button>
      {added ? <p className="feedback-ok">{added}</p> : null}
    </div>
  );
}

function ApprovalSection({ account }: { account: Account }) {
  const { state, auth } = useStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = state.accounts.filter(
    (a) => a.status === 'pending' && a.schoolId === account.schoolId,
  );
  if (!canDo(account, 'manageSchool')) return null;

  const approve = async (target: Account) => {
    if (!supabase) return;
    setBusyId(target.id);
    setError(null);
    const { error: err } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', target.id);
    setBusyId(null);
    if (err) {
      setError('Không duyệt được tài khoản này. Hãy thử lại.');
      return;
    }
    auth.refresh();
  };

  return (
    <div>
      <h3 className="subhead">Chờ duyệt</h3>
      <p className="guide-text">
        Tài khoản đăng ký vào trường của bạn và đang chờ duyệt. Người chờ duyệt vẫn dùng được phần riêng tư của
        mình; duyệt xong họ mới thấy nội dung của trường. Học sinh được xếp vào lớp sẽ tự động kích hoạt, không
        cần duyệt ở đây.
      </p>
      {pending.length === 0 ? (
        <EmptyState text="Không có tài khoản nào đang chờ duyệt." />
      ) : (
        <div className="person-list">
          {pending.map((a) => (
            <div key={a.id} className="person-row">
              <RoleBadge account={a} />
              <span className="muted">{a.email ?? ''}</span>
              <button
                type="button"
                className="btn btn-small btn-primary"
                disabled={busyId === a.id}
                onClick={() => void approve(a)}
              >
                Duyệt
              </button>
            </div>
          ))}
        </div>
      )}
      {error ? <p className="feedback-bad">{error}</p> : null}
    </div>
  );
}

function PromoteControl({ account, teacher }: { account: Account; teacher: Account }) {
  const { state, auth } = useStore();
  const [teamId, setTeamId] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const schoolTeams = state.teams.filter((t) => t.schoolId === account.schoolId);
  if (!canDo(account, 'manageSchool') || teacher.role !== 'teacher') return null;

  const promote = async () => {
    if (!supabase || teamId === '') return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from('profiles')
      .update({ role: 'lead', team_id: teamId })
      .eq('id', teacher.id);
    setBusy(false);
    if (err) {
      setError('Không đặt làm Tổ trưởng được. Hãy thử lại.');
      return;
    }
    setOpen(false);
    auth.refresh();
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-small btn-secondary" onClick={() => setOpen(true)}>
        Đặt làm Tổ trưởng
      </button>
    );
  }
  return (
    <span className="row-actions">
      <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
        <option value="">— Chọn tổ —</option>
        {schoolTeams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-small btn-primary"
        disabled={busy || teamId === ''}
        onClick={() => void promote()}
      >
        Xác nhận
      </button>
      <button type="button" className="btn btn-small btn-ghost" onClick={() => setOpen(false)}>
        Hủy
      </button>
      {error ? <span className="feedback-bad">{error}</span> : null}
    </span>
  );
}

export function ManageViews({ account }: { account: Account }) {
  const { state } = useStore();
  const students = visibleStudents(account, state.accounts);
  const teachers = visibleTeachers(account, state.accounts);

  return (
    <div>
      <SectionBand
        title="Quản lý"
        guide="Tài khoản trong phạm vi bạn quản lý."
      />
      <ApprovalSection account={account} />
      <h3 className="subhead">Giáo viên</h3>
      {teachers.length === 0 ? (
        <EmptyState text="Chưa có giáo viên nào trong phạm vi của bạn." />
      ) : (
        <div className="person-list">
          {teachers.map((t) => (
            <div key={t.id} className="person-row">
              <RoleBadge account={t} />
              <span className="muted">
                {t.classIds.map((id) => state.classes.find((c) => c.id === id)?.name ?? id).join(', ')}
                {t.status === 'pending' ? ' · Chờ duyệt' : ''}
              </span>
              <PromoteControl account={account} teacher={t} />
            </div>
          ))}
        </div>
      )}
      <h3 className="subhead">Học sinh</h3>
      {students.length === 0 ? (
        <EmptyState text="Chưa có học sinh nào trong phạm vi của bạn." />
      ) : (
        <div className="person-list">
          {students.map((s) => (
            <div key={s.id} className="person-row">
              <RoleBadge account={s} />
              <span className="muted">
                {s.classIds.map((id) => state.classes.find((c) => c.id === id)?.name ?? id).join(', ')}
                {' · '}
                {state.tutor[s.id]?.sessions ?? 0} buổi luyện
                {s.status === 'pending' ? ' · Chờ xếp lớp' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      <AddStudentForm account={account} />
    </div>
  );
}

export function SettingsView({ account }: { account: Account }) {
  const { state, auth } = useStore();
  const schoolName = account.schoolId
    ? (state.schools.find((s) => s.id === account.schoolId)?.name ?? '')
    : 'Không thuộc trường nào';
  return (
    <div>
      <SectionBand title="Hồ sơ & giới thiệu" guide="Hồ sơ giảng dạy của bạn và thông tin tài khoản." />
      <TeachingProfileForm account={account} />
      <div className="form-card">
        <h3 className="subhead">Tài khoản của bạn</h3>
        <p>
          Bạn đang vào với vai trò <strong>{ROLE_META[account.role].label}</strong> — {account.name}
          {account.email ? ` (${account.email})` : ''}.
        </p>
        <p>
          Trường: {schoolName}
          {account.status === 'pending' ? ' · Tài khoản đang chờ duyệt.' : ''}
        </p>
        <p className="guide-text">
          Dữ liệu của bạn được lưu trên Supabase và đồng bộ giữa các lần đăng nhập.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={auth.refreshing}
          onClick={auth.refresh}
        >
          {auth.refreshing ? 'Đang tải…' : 'Tải lại dữ liệu'}
        </button>
      </div>
      <div className="form-card">
        <h3 className="subhead">Màu vai trò</h3>
        <div className="tag-row">
          {(Object.keys(ROLE_META) as Account['role'][]).map((role) => (
            <span
              key={role}
              className="role-dot"
              style={{ backgroundColor: ROLE_META[role].tint, color: ROLE_META[role].color }}
            >
              {ROLE_META[role].label}
            </span>
          ))}
        </div>
        <h3 className="subhead">Nguyên tắc phân quyền</h3>
        <p>
          Ai quản lý ai thì thấy hết của người đó, trừ nội dung bên trong Tutor Space của học sinh. Muốn sửa nội dung
          của người khác thì sửa trên bản sao của mình.
        </p>
      </div>
    </div>
  );
}

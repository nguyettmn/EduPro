// Manage: account and progress lists scoped by the permission table.
// Students are added by email (see AddStudentForm): teachers never
// create student accounts directly (user decision 2026-11-15).
import { useState } from 'react';
import type { Account } from '../types';
import { ROLE_META } from '../types';
import { canDo, visibleClasses, visibleStudents, visibleTeachers } from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import { RoleBadge } from './RoleBadge';
import { TeachingProfileForm } from './TeachingProfile';
import { EmptyState, SectionBand } from './ui';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? 'H';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

export function AddStudentForm({
  account,
  fixedClassId,
}: {
  account: Account;
  /** When set, the class select is hidden and the student joins this class. */
  fixedClassId?: string;
}) {
  const { state, dispatch } = useStore();
  const classes = visibleClasses(account, state.classes);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  if (!canDo(account, 'addStudent') || classes.length === 0) return null;
  const effectiveClassId = fixedClassId ?? classId;
  const cls = state.classes.find((c) => c.id === effectiveClassId);

  const submit = () => {
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Email chưa đúng định dạng. Ví dụ: lan@example.com');
      return;
    }
    const duplicate = state.accounts.some(
      (a) => a.email?.toLowerCase() === cleanEmail.toLowerCase() && a.schoolId === (cls?.schoolId ?? account.schoolId),
    );
    if (duplicate) {
      setError('Email này đã có trong trường rồi.');
      return;
    }
    const displayName = name.trim() || cleanEmail.split('@')[0];
    const id = `u-${Date.now()}`;
    dispatch({
      type: 'CREATE_STUDENT',
      account: {
        id,
        name: displayName,
        role: 'student',
        schoolId: cls?.schoolId ?? account.schoolId,
        teamId: null,
        classIds: [effectiveClassId],
        demoLogin: true,
        initials: initialsOf(displayName),
        email: cleanEmail,
      },
      tutor: {
        studentId: id,
        sessions: 0,
        weakTopics: [],
        chat: [],
        selfGames: [],
        reviewQuestionIds: [],
        masteredIds: [],
        bestScores: {},
      },
    });
    setAdded(`${displayName} (${cleanEmail})`);
    setEmail('');
    setName('');
    setError(null);
  };

  return (
    <div className="form-card">
      <h3 className="subhead">Thêm học sinh bằng email</h3>
      <p className="guide-text">
        Nhập email của học sinh để thêm em vào lớp. Bản demo chưa gửi email thật — em sẽ có trong
        danh sách lớp ngay.
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
        disabled={email.trim() === '' || effectiveClassId === ''}
        onClick={submit}
      >
        Thêm vào lớp
      </button>
      {added ? (
        <p className="feedback-ok">
          Đã thêm {added} vào {cls?.name ?? 'lớp'}. Có thể đổi vai nhanh để vào thử.
        </p>
      ) : null}
    </div>
  );
}

export function ManageViews({ account }: { account: Account }) {
  const { state, dispatch } = useStore();
  const students = visibleStudents(account, state.accounts);
  const teachers = visibleTeachers(account, state.accounts);

  if (canDo(account, 'manageSystem')) {
    const filtered = state.schoolFilter
      ? state.accounts.filter((a) => a.schoolId === state.schoolFilter)
      : state.accounts;
    return (
      <div>
        <SectionBand title="Quản lý hệ thống" guide="Tất cả trường và tài khoản. Chọn một trường để lọc." />
        <label className="field field-inline">
          <span>Lọc theo trường</span>
          <select
            value={state.schoolFilter ?? ''}
            onChange={(e) => dispatch({ type: 'SET_SCHOOL_FILTER', schoolId: e.target.value === '' ? null : e.target.value })}
          >
            <option value="">Tất cả các trường</option>
            {REFERENCE.SCHOOLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Vai trò</th>
                <th>Trường</th>
                <th>Lớp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{ROLE_META[a.role].label}</td>
                  <td>
                    {a.schoolId
                      ? REFERENCE.SCHOOLS.find((s) => s.id === a.schoolId)?.name ?? ''
                      : 'Tất cả các trường'}
                  </td>
                  <td>{a.classIds.map((id) => state.classes.find((c) => c.id === id)?.name ?? id).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionBand
        title="Quản lý"
        guide="Tài khoản trong phạm vi bạn quản lý."
      />
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
              </span>
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
  const { dispatch } = useStore();
  const [confirming, setConfirming] = useState(false);
  return (
    <div>
      <SectionBand title="Hồ sơ & giới thiệu" guide="Hồ sơ giảng dạy của bạn và thông tin về bản demo." />
      <TeachingProfileForm account={account} />
      <div className="form-card">
        <h3 className="subhead">Về bản demo</h3>
        <p>
          Đây là khung giao diện EduPro, chạy hoàn toàn trên trình duyệt với dữ liệu giả. Chưa có máy chủ, chưa có cơ
          sở dữ liệu, chưa có đăng nhập thật. Mọi thay đổi sẽ mất khi tải lại trang.
        </p>
        <p>
          Bạn đang vào với vai trò <strong>{ROLE_META[account.role].label}</strong> — {account.name}. Dùng mục “Đổi
          vai nhanh” trên thanh đầu trang để thử các vai khác.
        </p>
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
      <div className="form-card">
        <h3 className="subhead">Dữ liệu demo</h3>
        <p className="guide-text">Đặt lại toàn bộ dữ liệu demo về trạng thái ban đầu.</p>
        {confirming ? (
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'RESET_DEMO' });
                setConfirming(false);
              }}
            >
              Xác nhận đặt lại
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
              Hủy
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
            Đặt lại dữ liệu demo
          </button>
        )}
      </div>
    </div>
  );
}

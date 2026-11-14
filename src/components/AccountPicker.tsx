// Mock login: click a person to enter the demo. No password, no real auth.
// This is a demo aid only and is always labelled as such.
import type { Account, Role } from '../types';
import { ROLE_META } from '../types';
import { REFERENCE } from '../state/store';

const ROLE_ORDER: Role[] = ['admin', 'principal', 'lead', 'teacher', 'student'];

export function AccountPicker({
  accounts,
  onPick,
}: {
  accounts: Account[];
  onPick: (accountId: string) => void;
}) {
  const demo = accounts.filter((a) => a.demoLogin);
  const schoolName = (a: Account) =>
    a.schoolId ? REFERENCE.SCHOOLS.find((s) => s.id === a.schoolId)?.name ?? '' : 'Tất cả các trường';

  return (
    <div className="picker-page">
      <div className="picker-card">
        <div className="picker-logo">EduPro</div>
        <h1 className="picker-title">Chọn một tài khoản để vào bản demo</h1>
        <p className="picker-guide">
          Bấm vào một người. Không cần mật khẩu. Màu sắc là màu của vai trò, dùng thống nhất trong toàn bộ app.
        </p>
        <div className="demo-badge demo-badge-lg">
          BẢN DEMO — đăng nhập giả, chưa có bảo mật thật
        </div>
        {ROLE_ORDER.map((role) => {
          const group = demo.filter((a) => a.role === role);
          if (group.length === 0) return null;
          const meta = ROLE_META[role];
          return (
            <div key={role} className="picker-group">
              <div
                className="picker-group-head"
                style={{ backgroundColor: meta.tint, color: meta.color }}
              >
                {meta.label}
              </div>
              <div className="picker-list">
                {group.map((a) => (
                  <button key={a.id} type="button" className="picker-person" onClick={() => onPick(a.id)}>
                    <span className="avatar avatar-lg" style={{ backgroundColor: meta.color }}>
                      {a.initials}
                    </span>
                    <span className="picker-person-text">
                      <span className="picker-person-name">{a.name}</span>
                      <span className="picker-person-sub">{schoolName(a)}</span>
                    </span>
                    <span className="picker-arrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="picker-foot">
          Tài khoản mẫu thuộc Trường Tiểu học An Bình, trừ Admin xem được cả hai trường.
        </p>
      </div>
    </div>
  );
}

// App shell: top bar (demo badge, fast role switcher), side nav filtered
// by the permission table, and the content area.
import type { ReactNode } from 'react';
import type { Account, NavItem, ViewId } from '../types';
import { ROLE_META } from '../types';
import { RoleBadge } from './RoleBadge';

export function Shell({
  account,
  accounts,
  navItems,
  activeView,
  onNavigate,
  onSwitchAccount,
  onLogout,
  children,
}: {
  account: Account;
  accounts: Account[];
  navItems: NavItem[];
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  onSwitchAccount: (accountId: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const meta = ROLE_META[account.role];
  const demoAccounts = accounts.filter((a) => a.demoLogin);
  return (
    <div
      className="shell"
      style={{ ['--role-color' as string]: meta.color, ['--role-tint' as string]: meta.tint }}
    >
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo">EduPro</span>
          <span className="demo-badge">BẢN DEMO — đăng nhập giả, chưa có bảo mật thật</span>
        </div>
        <div className="topbar-right">
          <label className="switcher-label" htmlFor="role-switcher">
            Đổi vai nhanh
          </label>
          <select
            id="role-switcher"
            className="switcher"
            value={account.id}
            onChange={(e) => onSwitchAccount(e.target.value)}
          >
            {demoAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {ROLE_META[a.role].label} — {a.name}
              </option>
            ))}
          </select>
          <RoleBadge account={account} />
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Thoát
          </button>
        </div>
      </header>
      <div className="shell-body">
        <nav className="sidenav" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <button
              key={item.view}
              type="button"
              className={item.view === activeView ? 'nav-btn nav-active' : 'nav-btn'}
              onClick={() => onNavigate(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

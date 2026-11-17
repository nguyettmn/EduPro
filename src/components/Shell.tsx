// App shell: top bar (account + logout), side nav filtered by the
// permission table, and the content area.
import type { ReactNode } from 'react';
import type { Account, NavItem, ViewId } from '../types';
import { ROLE_META } from '../types';
import { RoleBadge } from './RoleBadge';

export function Shell({
  account,
  navItems,
  activeView,
  onNavigate,
  onLogout,
  children,
}: {
  account: Account;
  navItems: NavItem[];
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const meta = ROLE_META[account.role];
  return (
    <div
      className="shell"
      style={{ ['--role-color' as string]: meta.color, ['--role-tint' as string]: meta.tint }}
    >
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo">EduPro</span>
        </div>
        <div className="topbar-right">
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

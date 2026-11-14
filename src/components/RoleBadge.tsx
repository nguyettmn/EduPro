// Role-coloured avatar + badge. Colour is the role identity everywhere.
import type { Account } from '../types';
import { ROLE_META } from '../types';

export function RoleBadge({ account, showName = true }: { account: Account; showName?: boolean }) {
  const meta = ROLE_META[account.role];
  return (
    <span className="role-badge">
      <span
        className="avatar"
        style={{ backgroundColor: meta.color }}
        aria-hidden="true"
      >
        {account.initials}
      </span>
      {showName ? (
        <span className="role-badge-text">
          <span className="role-badge-name">{account.name}</span>
          <span
            className="role-badge-role"
            style={{ backgroundColor: meta.tint, color: meta.color }}
          >
            {meta.label}
          </span>
        </span>
      ) : null}
    </span>
  );
}

export function RoleDot({ role, label }: { role: Account['role']; label?: string }) {
  const meta = ROLE_META[role];
  return (
    <span className="role-dot" style={{ backgroundColor: meta.tint, color: meta.color }}>
      {label ?? meta.label}
    </span>
  );
}

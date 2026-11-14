// THE central permission table.
// Every view and action consults this module. Components must NOT hardcode
// role checks; use canDo() and the scope helpers below.
//
// Principle (user decision): if A manages B, A sees everything of B EXCEPT
// the contents of a student's Tutor Space (managers see only a summary).
// Chain: Admin > Principal > Team Lead > Teacher > Student.
// Access = view, copy, re-assign, request edits. No direct edit/delete of
// someone else's original: edits happen on a copy.
import type {
  Account,
  ClassGroup,
  NavItem,
  Proposal,
  Role,
  ViewId,
} from './types';

export type Action =
  | 'createContent'
  | 'assign'
  | 'grade'
  | 'createStudentAccount'
  | 'manageSchool'
  | 'manageSystem'
  | 'propose'
  | 'useTutor'
  | 'approveTeam'
  | 'approveSchool'
  | 'reviewStudentProposal';

const ROLE_VIEWS: Record<Role, ViewId[]> = {
  admin: ['dashboard', 'library', 'lesson', 'studio', 'assignments', 'repo', 'manage', 'settings'],
  principal: ['dashboard', 'library', 'lesson', 'studio', 'assignments', 'repo', 'manage', 'settings'],
  lead: ['dashboard', 'library', 'lesson', 'studio', 'assignments', 'repo', 'manage', 'settings'],
  teacher: ['dashboard', 'library', 'lesson', 'studio', 'assignments', 'repo', 'manage', 'settings'],
  student: ['dashboard', 'library', 'lesson', 'assignments', 'tutor', 'settings'],
};

const ROLE_ACTIONS: Record<Role, Action[]> = {
  admin: ['createContent', 'createStudentAccount', 'manageSchool', 'manageSystem', 'propose', 'approveTeam', 'approveSchool', 'reviewStudentProposal'],
  principal: ['createContent', 'assign', 'createStudentAccount', 'manageSchool', 'propose', 'approveSchool'],
  lead: ['createContent', 'assign', 'propose', 'approveTeam'],
  teacher: ['createContent', 'assign', 'grade', 'createStudentAccount', 'propose', 'reviewStudentProposal'],
  student: ['propose', 'useTutor'],
};

const NAV_LABELS: Record<ViewId, string> = {
  dashboard: 'Trang chính',
  library: 'Thư viện',
  lesson: 'Bài học',
  studio: 'Soạn bài',
  assignments: 'Giao bài',
  repo: 'Kho chung',
  tutor: 'Tutor Space',
  manage: 'Quản lý',
  settings: 'Cài đặt',
};

export function getNavItems(role: Role): NavItem[] {
  // The lesson view is reached from the library, not from top-level nav.
  return ROLE_VIEWS[role]
    .filter((v) => v !== 'lesson')
    .map((view) => ({ view, label: NAV_LABELS[view] }));
}

export function canView(role: Role, view: ViewId): boolean {
  return ROLE_VIEWS[role].includes(view);
}

export function canDo(account: Account, action: Action): boolean {
  return ROLE_ACTIONS[account.role].includes(action);
}

// ---------- Scope helpers ----------

/** Accounts the viewer manages (directly or transitively), excluding self. */
export function managedAccounts(viewer: Account, accounts: Account[]): Account[] {
  switch (viewer.role) {
    case 'admin':
      return accounts.filter((a) => a.id !== viewer.id);
    case 'principal':
      return accounts.filter(
        (a) => a.id !== viewer.id && a.schoolId === viewer.schoolId,
      );
    case 'lead':
      return accounts.filter((a) => {
        if (a.id === viewer.id || a.schoolId !== viewer.schoolId) return false;
        if (a.role === 'teacher' || a.role === 'lead') return a.teamId === viewer.teamId;
        if (a.role === 'student') {
          // Students of teachers in this team.
          const teachers = accounts.filter(
            (t) => t.role === 'teacher' && t.teamId === viewer.teamId,
          );
          return teachers.some((t) => t.classIds.some((c) => a.classIds.includes(c)));
        }
        return false;
      });
    case 'teacher':
      return accounts.filter(
        (a) =>
          a.role === 'student' &&
          a.classIds.some((c) => viewer.classIds.includes(c)),
      );
    case 'student':
      return [];
  }
}

export function visibleStudents(viewer: Account, accounts: Account[]): Account[] {
  if (viewer.role === 'student') return [viewer];
  return managedAccounts(viewer, accounts).filter((a) => a.role === 'student');
}

export function visibleTeachers(viewer: Account, accounts: Account[]): Account[] {
  if (viewer.role === 'teacher') return [viewer];
  return managedAccounts(viewer, accounts).filter((a) => a.role === 'teacher');
}

export function visibleClasses(
  viewer: Account,
  classes: ClassGroup[],
): ClassGroup[] {
  switch (viewer.role) {
    case 'admin':
      return classes;
    case 'principal':
      return classes.filter((c) => c.schoolId === viewer.schoolId);
    case 'lead':
      return classes.filter((c) => c.teamId === viewer.teamId);
    case 'teacher':
    case 'student':
      return classes.filter((c) => viewer.classIds.includes(c.id));
  }
}

/** Tutor Space contents are visible ONLY to the owning student. */
export function canViewTutorContents(viewer: Account, studentId: string): boolean {
  return viewer.id === studentId;
}

/** Managers in scope see only the general summary (sessions, weak topics). */
export function canViewTutorSummary(
  viewer: Account,
  student: Account,
  accounts: Account[],
): boolean {
  if (viewer.id === student.id) return true;
  return managedAccounts(viewer, accounts).some((a) => a.id === student.id);
}

// ---------- Proposal routing ----------

/**
 * Who may decide this proposal right now?
 * - stage 'teacher': the class teacher of the student proposer (or Admin).
 * - stage 'team': the Team Lead of the proposal's team (or Admin).
 * - stage 'school': the Principal of the proposal's school (or Admin).
 */
export function canDecideProposal(
  viewer: Account,
  proposal: Proposal,
  accounts: Account[],
): boolean {
  if (proposal.status !== 'pending') return false;
  if (viewer.role === 'admin') return true;
  if (proposal.stage === 'teacher') {
    if (!canDo(viewer, 'reviewStudentProposal')) return false;
    const proposer = accounts.find((a) => a.id === proposal.createdBy);
    if (!proposer) return false;
    return proposer.classIds.some((c) => viewer.classIds.includes(c));
  }
  if (proposal.stage === 'team') {
    return (
      viewer.role === 'lead' &&
      viewer.teamId === proposal.teamId &&
      viewer.schoolId === proposal.schoolId
    );
  }
  if (proposal.stage === 'school') {
    return viewer.role === 'principal' && viewer.schoolId === proposal.schoolId;
  }
  return false;
}

/** Next stage after an approval at the current stage. */
export function nextStageAfterApproval(proposal: Proposal): Proposal['stage'] {
  if (proposal.stage === 'teacher') {
    return proposal.targetRepo === 'team' ? 'team' : 'school';
  }
  return 'done';
}

/** Team scope for browsing Kho Tổ: a team id, or null for "all teams". */
export function repoTeamScope(viewer: Account): string | null {
  if (viewer.role === 'lead' || viewer.role === 'teacher') return viewer.teamId;
  return null;
}

/** Display name for a repo item, honouring the anonymous choice. */
export function displayOwnerName(anonymous: boolean, ownerName: string): string {
  return anonymous ? 'Ẩn danh' : ownerName;
}

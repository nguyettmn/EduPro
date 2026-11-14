// Shared domain types for EduPro frame v1 (frontend-only demo).
// No backend, no network: all state is in-memory mock data.

export type Role = 'admin' | 'principal' | 'lead' | 'teacher' | 'student';

export interface RoleMeta {
  label: string;
  color: string;
  tint: string;
}

// Exact colours from the approved role diagram. Used everywhere a role appears.
export const ROLE_META: Record<Role, RoleMeta> = {
  admin: { label: 'Admin', color: '#6d28d9', tint: '#f5f3ff' },
  principal: { label: 'Hiệu trưởng', color: '#1d4ed8', tint: '#eff6ff' },
  lead: { label: 'Tổ trưởng', color: '#0f766e', tint: '#f0fdfa' },
  teacher: { label: 'Giáo viên', color: '#ea580c', tint: '#fff7ed' },
  student: { label: 'Học sinh', color: '#be185d', tint: '#fdf2f8' },
};

export interface Account {
  id: string;
  name: string;
  role: Role;
  /** Admin has no single school: null means "all schools". */
  schoolId: string | null;
  teamId: string | null;
  /** Teachers: classes they teach. Students: [own class]. */
  classIds: string[];
  /** Shown on the mock-login picker. */
  demoLogin: boolean;
  initials: string;
}

export interface School {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  schoolId: string;
  name: string;
}

export interface ClassGroup {
  id: string;
  schoolId: string;
  teamId: string;
  name: string;
  grade: number;
  teacherId: string;
}

// ---------- Maths content ----------
// Fractions are ALWAYS rendered stacked (see Fraction component).
// Never write a fraction as "a/b" text anywhere in the UI.

export type MathToken =
  | { k: 'f'; n: number; d: number }
  | { k: 'm'; w: number; n: number; d: number }
  | { k: 't'; s: string };

export type MathLine = MathToken[];

export type Answer =
  | { type: 'fraction'; n: number; d: number }
  | { type: 'mixed'; w: number; n: number; d: number }
  | { type: 'whole'; v: number }
  | { type: 'decimal'; v: number; display: string }
  | { type: 'choice'; index: number };

export interface Question {
  id: string;
  topicId: string;
  difficulty: 1 | 2 | 3;
  /** Vietnamese instruction, e.g. "Rút gọn phân số". */
  label: string;
  expr: MathLine;
  answer: Answer;
  choices?: MathLine[];
  /** One equation per line. Never join equations with a middle dot. */
  solution: MathLine[];
  solutionNote?: string;
}

export type StudentAnswer =
  | { type: 'fraction'; n: number; d: number }
  | { type: 'mixed'; w: number; n: number; d: number }
  | { type: 'whole'; v: number }
  | { type: 'decimal'; v: number }
  | { type: 'choice'; index: number }
  | { type: 'empty' };

export interface LongDivisionStep {
  label: string;
  detail: string;
}

export interface LessonSection {
  id: string;
  title: string;
  /** Worked example FIRST, before the how-to steps. */
  example: MathLine[];
  /** How-to steps, shown after the example. */
  steps: string[];
  tip?: string;
  /** Optional bar model visual: filled parts out of total. */
  bar?: { filled: number; total: number };
  longDivision?: {
    dividend: number;
    divisor: number;
    result: string;
    rows: LongDivisionStep[];
  };
}

export interface Lesson {
  id: string;
  title: string;
  topicIds: string[];
  color: string;
  sections: LessonSection[];
  questionIds: string[];
  /** Set on personal copies; pack originals have no owner. */
  ownerId?: string;
  /** Id of the lesson this copy was made from. */
  sourceId?: string;
}

export interface Topic {
  id: string;
  code: string;
  title: string;
  color: string;
}

export interface Pack {
  id: string;
  title: string;
  grade: number;
  subject: string;
  color: string;
  topics: Topic[];
  lessonIds: string[];
}

// ---------- Assignments & submissions ----------

export interface Assignment {
  id: string;
  lessonId: string;
  title: string;
  classId: string;
  createdBy: string;
  /** ISO date (yyyy-mm-dd). */
  dueDate: string;
  attemptsAllowed: number;
  status: 'active' | 'closed';
  createdAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  answers: Record<string, StudentAnswer>;
  score: number;
  total: number;
  submittedAt: string;
  comment?: string;
  reviewed: boolean;
}

// ---------- Shared repository & proposals ----------

export type RepoKind = 'lesson' | 'game' | 'questions';
export type RepoId = 'team' | 'school';

export interface GameDef {
  id: string;
  title: string;
  mechanic: 'quick-quiz';
  theme: 'ocean' | 'space' | 'forest';
  topicId: string;
  questionIds: string[];
  createdBy: string;
  createdByName: string;
  anonymous: boolean;
}

export interface Proposal {
  id: string;
  kind: RepoKind;
  title: string;
  topicId: string;
  createdBy: string;
  createdByName: string;
  anonymous: boolean;
  targetRepo: RepoId;
  schoolId: string;
  teamId: string | null;
  /** teacher -> team/school -> done */
  stage: 'teacher' | 'team' | 'school' | 'done';
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  lessonCopyId?: string;
  game?: GameDef;
  questionIds?: string[];
  createdAt: string;
  decidedBy?: string;
}

export interface RepoItem {
  id: string;
  repo: RepoId;
  kind: RepoKind;
  title: string;
  topicId: string;
  ownerName: string;
  anonymous: boolean;
  schoolId: string;
  teamId: string | null;
  lessonCopyId?: string;
  game?: GameDef;
  questionIds?: string[];
  approvedBy: string;
}

// ---------- Tutor Space (student-private) ----------

export interface ChatMsg {
  id: string;
  from: 'student' | 'tutor';
  text: string;
}

export interface TutorData {
  studentId: string;
  sessions: number;
  weakTopics: string[];
  chat: ChatMsg[];
  selfGames: GameDef[];
  reviewQuestionIds: string[];
  masteredIds: string[];
  bestScores: Record<string, number>;
}

// ---------- Views ----------

export type ViewId =
  | 'dashboard'
  | 'library'
  | 'lesson'
  | 'studio'
  | 'assignments'
  | 'repo'
  | 'tutor'
  | 'manage'
  | 'settings';

export interface NavItem {
  view: ViewId;
  label: string;
}

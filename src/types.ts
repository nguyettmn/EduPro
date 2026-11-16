// Shared domain types for EduPro.
// Demo state is in-memory (resets on reload). The only network call is
// POST /api/ai-soan-bai, the server-side Gemini route for AI authoring.

export type Role = 'principal' | 'lead' | 'teacher' | 'student';

export interface RoleMeta {
  label: string;
  color: string;
  tint: string;
}

// Exact colours from the approved role diagram. Used everywhere a role appears.
export const ROLE_META: Record<Role, RoleMeta> = {
  principal: { label: 'Hiệu trưởng', color: '#1d4ed8', tint: '#eff6ff' },
  lead: { label: 'Tổ trưởng', color: '#0f766e', tint: '#f0fdfa' },
  teacher: { label: 'Giáo viên', color: '#ea580c', tint: '#fff7ed' },
  student: { label: 'Học sinh', color: '#be185d', tint: '#fdf2f8' },
};

export interface Account {
  id: string;
  name: string;
  role: Role;
  /** Every account belongs to one school; null is unused by current
   * roles (there is no Admin role: the system's owner edits the source
   * code and the database directly). */
  schoolId: string | null;
  teamId: string | null;
  /** Teachers: classes they teach. Students: [own class]. */
  classIds: string[];
  /** Shown on the mock-login picker. */
  demoLogin: boolean;
  initials: string;
  /** Students added by email: the address the teacher invited. */
  email?: string;
  /** Teaching profile (Hồ sơ giảng dạy): the grades + subjects this
   * account teaches, picked in Hồ sơ. The AI authoring flow only offers
   * these grades/subjects when a profile is set. */
  teachingProfile?: TeachingProfile;
}

/** Grades + subjects a teacher pre-selects in profile settings.
 * subjectsByGrade keys are grade numbers as strings; values are the
 * selected subject names for that grade (master list + hand-added). */
export interface TeachingProfile {
  grades: number[];
  subjectsByGrade: Record<string, string[]>;
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
  /** AI-composed single-file HTML lesson (see HtmlLessonPlayer). When set,
   * the lesson renders from this HTML instead of `sections`, and it has
   * no structured questions: practice lives inside the HTML itself. */
  html?: string;
  /** Grade + subject the lesson was composed for (AI lessons). */
  grade?: number;
  subject?: string;
  /** Topic label for grouping inside "Bài của tôi" (teacher-assigned;
   * e.g. "Phân số" groups "Rút gọn phân số", "So sánh phân số", ...).
   * When unset, grouping falls back to the first Pack topic, if any. */
  topic?: string;
  /** Generation inputs kept for the file round-trip: exporting the
   * lesson embeds them as JSON so re-import restores them. */
  outline?: string;
  roleSentence?: string;
  extraRequests?: string;
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
  /** When set and non-empty, only these students see and do the assignment. */
  studentIds?: string[];
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

// ---------- HTML games (AI-generated / uploaded single-file games) ----------
// Distinct from GameDef (the frame-v1 quick-quiz built from the question
// bank). An HtmlGame is one self-contained HTML file — the same record
// shape as the user's old Gemini game files ({id, title, mechanic,
// theme, htmlCode, createdAt}), so those files import directly. A game
// is attached to a lesson (lessonId set, one lesson can have many
// games) or standalone in a student's Tutor Space (no lessonId).

export interface HtmlGame {
  id: string;
  title: string;
  /** Free text, e.g. "Snake Game", "Pacman Maze", "Imported". */
  mechanic: string;
  theme: string;
  htmlCode: string;
  ownerId: string;
  lessonId?: string;
  /** Challenge code (seed) for the run; shown inside the game. */
  seed?: string;
  createdAt: string;
  /** Generation inputs, kept so the game can be reopened in the studio. */
  grade?: number;
  subject?: string;
  topic?: string;
  /** True when the file came from an old CDN-based game: needs internet. */
  needsInternet?: boolean;
}

export interface GameSkillResult {
  skill: string;
  correct: number;
  wrong: number;
}

/** One finished run of an HTML game, reported by the game itself via the
 * EDUPRO_GAME_RESULT postMessage protocol. Feeds the weak-topic system
 * the same way a submission does. */
export interface GameResult {
  id: string;
  gameId: string;
  studentId: string;
  won: boolean;
  score: number;
  stars: number;
  durationSec: number;
  correct: number;
  wrong: number;
  skills: GameSkillResult[];
  missedSkills: string[];
  playedAt: string;
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

// ---------- Practice exercises (generated from a lesson) ----------

export interface ExerciseQuestion {
  id: string;
  kind: 'choice' | 'short';
  /** Question text, plain Vietnamese. */
  prompt: string;
  /** Choice questions: 3–4 options, exactly one correct. */
  choices?: string[];
  /** Choice questions: index into `choices`. */
  answerIndex?: number;
  /** Short-answer questions: the expected answer (compared loosely). */
  expected?: string;
  hint?: string;
}

export interface ExerciseSet {
  id: string;
  lessonId: string;
  title: string;
  createdBy: string;
  questions: ExerciseQuestion[];
  createdAt: string;
}

// ---------- Public marketplace ("Kho user nộp lên") ----------

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  grade: number;
  subject: string;
  topic: string;
  sellerName: string;
  /** 0 = free. Demo prices in VND; no real payments in the demo. */
  price: number;
  /** True when the seller made it with AI assistance (labelled for buyers). */
  aiAssisted: boolean;
  /** The lesson content, previewed before taking a copy. */
  lesson: Lesson;
}

// ---------- Views ----------

export type ViewId =
  | 'dashboard'
  | 'classes'
  | 'lesson'
  | 'studio'
  | 'kho'
  | 'assignments'
  | 'repo'
  | 'managed'
  | 'tutor'
  | 'manage'
  | 'settings'
  | 'gamestudio';

export interface NavItem {
  view: ViewId;
  label: string;
}

// Row <-> domain-type mapping for the Supabase tables (migrations 0001
// + 0002). The schema mirrors the app types almost 1:1; the only
// translations are snake_case columns, uuid[] arrays, and jsonb blobs.
// Mappers are defensive: a malformed row degrades to a safe default
// instead of crashing the load.
import type {
  Account,
  Assignment,
  ChatMsg,
  ClassGroup,
  ExerciseQuestion,
  ExerciseSet,
  GameDef,
  GameResult,
  GameSkillResult,
  HtmlGame,
  Lesson,
  LessonSection,
  Proposal,
  RepoItem,
  Role,
  School,
  StudentAnswer,
  Submission,
  TeachingProfile,
  Team,
  TutorData,
} from '../types';

export type Row = Record<string, unknown>;

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? 'H';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asNullableStringArray(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  const arr = asStringArray(value);
  return arr.length > 0 ? arr : undefined;
}

function asJson<T>(value: unknown, fallback: T): T {
  return value === null || value === undefined ? fallback : (value as T);
}

function asRole(value: unknown): Role {
  return value === 'principal' || value === 'lead' || value === 'teacher' || value === 'student'
    ? value
    : 'student';
}

function asTeachingProfile(value: unknown): TeachingProfile | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  const grades = Array.isArray(v.grades) ? v.grades.filter((g): g is number => typeof g === 'number') : [];
  const subjectsByGrade: Record<string, string[]> = {};
  if (typeof v.subjectsByGrade === 'object' && v.subjectsByGrade !== null) {
    for (const [k, list] of Object.entries(v.subjectsByGrade as Record<string, unknown>)) {
      subjectsByGrade[k] = asStringArray(list);
    }
  }
  if (grades.length === 0 && Object.keys(subjectsByGrade).length === 0) return undefined;
  return { grades, subjectsByGrade };
}

export function mapSchool(row: Row): School {
  return { id: asString(row.id), name: asString(row.name) };
}

export function mapTeam(row: Row): Team {
  return { id: asString(row.id), schoolId: asString(row.school_id), name: asString(row.name) };
}

export function mapProfile(row: Row, classIds: string[]): Account {
  const name = asString(row.name, 'Chưa đặt tên');
  return {
    id: asString(row.id),
    name,
    role: asRole(row.role),
    schoolId: asNullableString(row.school_id),
    teamId: asNullableString(row.team_id),
    classIds,
    demoLogin: false,
    initials: initialsOf(name),
    email: asNullableString(row.email) ?? undefined,
    teachingProfile: asTeachingProfile(row.teaching_profile),
    status: row.status === 'pending' ? 'pending' : 'active',
  };
}

export function mapClass(row: Row): ClassGroup {
  return {
    id: asString(row.id),
    schoolId: asNullableString(row.school_id),
    teamId: asNullableString(row.team_id),
    name: asString(row.name),
    grade: asNumber(row.grade, 1),
    teacherId: asNullableString(row.teacher_id),
  };
}

export function mapLesson(row: Row): Lesson {
  return {
    id: asString(row.id),
    title: asString(row.title),
    topicIds: asStringArray(row.topic_ids),
    color: asString(row.color, '#2563eb'),
    sections: asJson<LessonSection[]>(row.sections, []),
    questionIds: asStringArray(row.question_ids),
    ownerId: asString(row.owner_id),
    sourceId: asNullableString(row.source_id) ?? undefined,
    html: asNullableString(row.html) ?? undefined,
    grade: asNullableNumber(row.grade) ?? undefined,
    subject: asNullableString(row.subject) ?? undefined,
    topic: asNullableString(row.topic) ?? undefined,
    outline: asNullableString(row.outline) ?? undefined,
    roleSentence: asNullableString(row.role_sentence) ?? undefined,
    extraRequests: asNullableString(row.extra_requests) ?? undefined,
  };
}

/** Lesson -> insert/update payload. Pack originals (no ownerId) are never
 * written: they stay static in the app code. */
export function lessonToRow(lesson: Lesson): Row {
  return {
    id: lesson.id,
    title: lesson.title,
    topic_ids: lesson.topicIds,
    color: lesson.color,
    sections: lesson.sections,
    question_ids: lesson.questionIds,
    owner_id: lesson.ownerId ?? null,
    source_id: lesson.sourceId ?? null,
    html: lesson.html ?? null,
    grade: lesson.grade ?? null,
    subject: lesson.subject ?? null,
    topic: lesson.topic ?? null,
    outline: lesson.outline ?? null,
    role_sentence: lesson.roleSentence ?? null,
    extra_requests: lesson.extraRequests ?? null,
  };
}

export function mapAssignment(row: Row): Assignment {
  return {
    id: asString(row.id),
    lessonId: asString(row.lesson_id),
    title: asString(row.title),
    classId: asString(row.class_id),
    studentIds: asNullableStringArray(row.student_ids),
    createdBy: asString(row.created_by),
    dueDate: asString(row.due_date).slice(0, 10),
    attemptsAllowed: asNumber(row.attempts_allowed, 1),
    status: row.status === 'closed' ? 'closed' : 'active',
    createdAt: asString(row.created_at).slice(0, 10),
  };
}

export function assignmentToRow(a: Assignment): Row {
  return {
    id: a.id,
    lesson_id: a.lessonId,
    title: a.title,
    class_id: a.classId,
    student_ids: a.studentIds ?? [],
    created_by: a.createdBy,
    due_date: a.dueDate,
    attempts_allowed: a.attemptsAllowed,
    status: a.status,
  };
}

export function mapSubmission(row: Row): Submission {
  return {
    id: asString(row.id),
    assignmentId: asString(row.assignment_id),
    studentId: asString(row.student_id),
    answers: asJson<Record<string, StudentAnswer>>(row.answers, {}),
    score: asNumber(row.score),
    total: asNumber(row.total),
    submittedAt: asString(row.submitted_at),
    comment: asNullableString(row.comment) ?? undefined,
    reviewed: asBoolean(row.reviewed),
  };
}

export function submissionToRow(s: Submission): Row {
  return {
    id: s.id,
    assignment_id: s.assignmentId,
    student_id: s.studentId,
    answers: s.answers,
    score: s.score,
    total: s.total,
    submitted_at: s.submittedAt,
    comment: s.comment ?? null,
    reviewed: s.reviewed,
  };
}

export function mapProposal(row: Row): Proposal {
  const stage = row.stage;
  return {
    id: asString(row.id),
    kind: row.kind === 'game' || row.kind === 'questions' ? row.kind : 'lesson',
    title: asString(row.title),
    topicId: asString(row.topic_id),
    createdBy: asString(row.created_by),
    createdByName: asString(row.created_by_name),
    anonymous: asBoolean(row.anonymous),
    targetRepo: row.target_repo === 'school' ? 'school' : 'team',
    schoolId: asString(row.school_id),
    teamId: asNullableString(row.team_id),
    stage: stage === 'team' || stage === 'school' || stage === 'done' ? stage : 'teacher',
    status: row.status === 'approved' || row.status === 'rejected' ? row.status : 'pending',
    reason: asNullableString(row.reason) ?? undefined,
    lessonCopyId: asNullableString(row.lesson_copy_id) ?? undefined,
    game: (row.game as GameDef | null) ?? undefined,
    questionIds: asNullableStringArray(row.question_ids),
    createdAt: asString(row.created_at).slice(0, 10),
    decidedBy: asNullableString(row.decided_by) ?? undefined,
  };
}

export function proposalToRow(p: Proposal): Row {
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    topic_id: p.topicId,
    created_by: p.createdBy,
    created_by_name: p.createdByName,
    anonymous: p.anonymous,
    target_repo: p.targetRepo,
    school_id: p.schoolId,
    team_id: p.teamId,
    stage: p.stage,
    status: p.status,
    reason: p.reason ?? null,
    lesson_copy_id: p.lessonCopyId ?? null,
    game: p.game ?? null,
    question_ids: p.questionIds ?? null,
    decided_by: p.decidedBy ?? null,
  };
}

export function mapRepoItem(row: Row): RepoItem {
  return {
    id: asString(row.id),
    repo: row.repo === 'school' ? 'school' : 'team',
    kind: row.kind === 'game' || row.kind === 'questions' ? row.kind : 'lesson',
    title: asString(row.title),
    topicId: asString(row.topic_id),
    ownerName: asString(row.owner_name),
    anonymous: asBoolean(row.anonymous),
    schoolId: asString(row.school_id),
    teamId: asNullableString(row.team_id),
    lessonCopyId: asNullableString(row.lesson_copy_id) ?? undefined,
    game: (row.game as GameDef | null) ?? undefined,
    questionIds: asNullableStringArray(row.question_ids),
    approvedBy: asString(row.approved_by),
  };
}

export function repoItemToRow(item: RepoItem): Row {
  return {
    id: item.id,
    repo: item.repo,
    kind: item.kind,
    title: item.title,
    topic_id: item.topicId,
    owner_name: item.ownerName,
    anonymous: item.anonymous,
    school_id: item.schoolId,
    team_id: item.teamId,
    lesson_copy_id: item.lessonCopyId ?? null,
    game: item.game ?? null,
    question_ids: item.questionIds ?? null,
    approved_by: item.approvedBy,
  };
}

export function mapExerciseSet(row: Row): ExerciseSet {
  return {
    id: asString(row.id),
    lessonId: asString(row.lesson_id),
    title: asString(row.title),
    createdBy: asString(row.created_by),
    questions: asJson<ExerciseQuestion[]>(row.questions, []),
    createdAt: asString(row.created_at).slice(0, 10),
  };
}

export function exerciseSetToRow(set: ExerciseSet): Row {
  return {
    id: set.id,
    lesson_id: set.lessonId,
    title: set.title,
    created_by: set.createdBy,
    questions: set.questions,
  };
}

export function mapHtmlGame(row: Row): HtmlGame {
  return {
    id: asString(row.id),
    title: asString(row.title),
    mechanic: asString(row.mechanic),
    theme: asString(row.theme),
    htmlCode: asString(row.html_code),
    ownerId: asString(row.owner_id),
    lessonId: asNullableString(row.lesson_id) ?? undefined,
    seed: asNullableString(row.seed) ?? undefined,
    createdAt: asString(row.created_at),
    grade: asNullableNumber(row.grade) ?? undefined,
    subject: asNullableString(row.subject) ?? undefined,
    topic: asNullableString(row.topic) ?? undefined,
    needsInternet: asBoolean(row.needs_internet),
  };
}

export function htmlGameToRow(game: HtmlGame): Row {
  return {
    id: game.id,
    title: game.title,
    mechanic: game.mechanic,
    theme: game.theme,
    html_code: game.htmlCode,
    owner_id: game.ownerId,
    lesson_id: game.lessonId ?? null,
    seed: game.seed ?? null,
    grade: game.grade ?? null,
    subject: game.subject ?? null,
    topic: game.topic ?? null,
    needs_internet: game.needsInternet ?? false,
  };
}

export function mapGameResult(row: Row): GameResult {
  return {
    id: asString(row.id),
    gameId: asString(row.game_id),
    studentId: asString(row.student_id),
    won: asBoolean(row.won),
    score: asNumber(row.score),
    stars: asNumber(row.stars),
    durationSec: asNumber(row.duration_sec),
    correct: asNumber(row.correct),
    wrong: asNumber(row.wrong),
    skills: asJson<GameSkillResult[]>(row.skills, []),
    missedSkills: asStringArray(row.missed_skills),
    playedAt: asString(row.played_at),
  };
}

export function gameResultToRow(result: GameResult): Row {
  return {
    id: result.id,
    game_id: result.gameId,
    student_id: result.studentId,
    won: result.won,
    score: result.score,
    stars: result.stars,
    duration_sec: result.durationSec,
    correct: result.correct,
    wrong: result.wrong,
    skills: result.skills,
    missed_skills: result.missedSkills,
  };
}

export function mapTutor(row: Row): TutorData {
  return {
    studentId: asString(row.student_id),
    sessions: asNumber(row.sessions),
    weakTopics: asStringArray(row.weak_topics),
    chat: asJson<ChatMsg[]>(row.chat, []),
    selfGames: asJson<GameDef[]>(row.self_games, []),
    reviewQuestionIds: asStringArray(row.review_question_ids),
    masteredIds: asStringArray(row.mastered_ids),
    bestScores: asJson<Record<string, number>>(row.best_scores, {}),
  };
}

/** TutorData -> upsert payload. `standaloneGameCount` is a client-only
 * summary field and is never written: it is not a column. */
export function tutorToRow(tutor: TutorData): Row {
  return {
    student_id: tutor.studentId,
    sessions: tutor.sessions,
    weak_topics: tutor.weakTopics,
    chat: tutor.chat,
    self_games: tutor.selfGames,
    review_question_ids: tutor.reviewQuestionIds,
    mastered_ids: tutor.masteredIds,
    best_scores: tutor.bestScores,
  };
}

export function emptyTutor(studentId: string): TutorData {
  return {
    studentId,
    sessions: 0,
    weakTopics: [],
    chat: [],
    selfGames: [],
    reviewQuestionIds: [],
    masteredIds: [],
    bestScores: {},
  };
}

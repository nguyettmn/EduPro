// Load the whole visible app state from Supabase. Row-level security
// does the scoping: every SELECT below returns exactly what the signed-in
// user may see, so the client never filters by permission itself. The
// Pack lessons stay static in the app code and are merged with the
// database lessons on every load.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppState } from '../state/store';
import type { TutorData } from '../types';
import { PACK_LESSONS, SCHOOLS, TEAMS } from '../data/seed';
import {
  emptyTutor,
  mapAssignment,
  mapClass,
  mapExerciseSet,
  mapGameResult,
  mapHtmlGame,
  mapLesson,
  mapProfile,
  mapProposal,
  mapRepoItem,
  mapSchool,
  mapSubmission,
  mapTeam,
  mapTutor,
} from './mapping';
import type { Row } from './mapping';

interface LoadedTable {
  name: string;
  rows: Row[];
}

async function selectAll(
  client: SupabaseClient,
  table: string,
  columns = '*',
): Promise<LoadedTable> {
  const { data, error } = await client.from(table).select(columns);
  if (error) {
    throw new Error(`Không tải được bảng ${table}: ${error.message}`);
  }
  return { name: table, rows: ((data ?? []) as unknown) as Row[] };
}

export async function loadAppState(
  client: SupabaseClient,
  userId: string,
): Promise<AppState> {
  const [
    schools,
    teams,
    profiles,
    memberships,
    classes,
    lessons,
    assignments,
    submissions,
    proposals,
    repoItems,
    exerciseSets,
    htmlGames,
    gameResults,
    tutorRows,
    spaceNameRows,
  ] = await Promise.all([
    selectAll(client, 'schools'),
    selectAll(client, 'teams'),
    selectAll(client, 'profiles'),
    selectAll(client, 'class_memberships'),
    selectAll(client, 'classes'),
    selectAll(client, 'lessons'),
    selectAll(client, 'assignments'),
    selectAll(client, 'submissions'),
    selectAll(client, 'proposals'),
    selectAll(client, 'repo_items'),
    selectAll(client, 'exercise_sets'),
    selectAll(client, 'html_games'),
    selectAll(client, 'game_results'),
    selectAll(client, 'tutor_data'),
    selectAll(client, 'space_names'),
  ]);

  // Memberships -> classIds per profile. A profile's class list is every
  // class it belongs to, teacher or student.
  const classIdsByProfile = new Map<string, string[]>();
  for (const m of memberships.rows) {
    const profileId = String(m.profile_id ?? '');
    const classId = String(m.class_id ?? '');
    if (!profileId || !classId) continue;
    const list = classIdsByProfile.get(profileId) ?? [];
    if (!list.includes(classId)) list.push(classId);
    classIdsByProfile.set(profileId, list);
  }

  const accounts = profiles.rows.map((row) =>
    mapProfile(row, classIdsByProfile.get(String(row.id)) ?? []),
  );

  // Tutor data: the signed-in student's own row is readable in full.
  // Every other visible student contributes only the privacy-safe summary
  // from the get_tutor_summary RPC (sessions, weak topics, standalone
  // game count) — never chat, questions, or game contents.
  const tutor: Record<string, TutorData> = {};
  for (const row of tutorRows.rows) {
    const data = mapTutor(row);
    tutor[data.studentId] = data;
  }
  if (!tutor[userId]) {
    const me = accounts.find((a) => a.id === userId);
    if (me?.role === 'student') tutor[userId] = emptyTutor(userId);
  }
  const otherStudents = accounts.filter((a) => a.role === 'student' && a.id !== userId);
  const summaries = await Promise.all(
    otherStudents.map(async (student) => {
      const { data, error } = await client.rpc('get_tutor_summary', {
        p_student: student.id,
      });
      if (error || !Array.isArray(data) || data.length === 0) {
        return { studentId: student.id, summary: null };
      }
      return { studentId: student.id, summary: data[0] as Row };
    }),
  );
  for (const { studentId, summary } of summaries) {
    const base = emptyTutor(studentId);
    tutor[studentId] = {
      ...base,
      sessions: typeof summary?.sessions === 'number' ? summary.sessions : 0,
      weakTopics: Array.isArray(summary?.weak_topics)
        ? (summary.weak_topics as unknown[]).filter((t): t is string => typeof t === 'string')
        : [],
      standaloneGameCount:
        typeof summary?.self_game_count === 'number' ? summary.self_game_count : 0,
    };
  }

  // Pack lessons are static content (never stored in the database), so
  // they are merged in front of the database lessons on every load.
  const dbLessons = lessons.rows.map(mapLesson);
  const dbIds = new Set(dbLessons.map((l) => l.id));
  const packLessons = PACK_LESSONS.filter((l) => !dbIds.has(l.id)).map((l) =>
    JSON.parse(JSON.stringify(l)),
  ) as typeof PACK_LESSONS;

  const spaceNames: Record<string, string> = {};
  for (const row of spaceNameRows.rows) {
    const studentId = String(row.student_id ?? '');
    const name = typeof row.name === 'string' ? row.name : '';
    if (studentId && name) spaceNames[studentId] = name;
  }

  const loadedSchools = schools.rows.map(mapSchool);
  const loadedTeams = teams.rows.map(mapTeam);

  return {
    currentAccountId: userId,
    accounts,
    schools: loadedSchools.length > 0 ? loadedSchools : [...SCHOOLS],
    teams: loadedTeams.length > 0 ? loadedTeams : [...TEAMS],
    classes: classes.rows.map(mapClass),
    lessons: [...packLessons, ...dbLessons],
    assignments: assignments.rows.map(mapAssignment),
    submissions: submissions.rows.map(mapSubmission),
    proposals: proposals.rows.map(mapProposal),
    repoItems: repoItems.rows.map(mapRepoItem),
    tutor,
    exerciseSets: exerciseSets.rows.map(mapExerciseSet),
    htmlGames: htmlGames.rows.map(mapHtmlGame),
    gameResults: gameResults.rows.map(mapGameResult),
    spaceNames,
  };
}


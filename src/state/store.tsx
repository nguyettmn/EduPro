// Store: React context + reducer, backed by Supabase.
// The state loads from the database on sign-in (row-level security scopes
// every table to what the user may see) and every change writes through
// to Supabase via a FIFO persist queue, in dispatch order. The Pack
// lessons stay static in the app code and are merged in on every load.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type {
  Account,
  Assignment,
  ChatMsg,
  ClassGroup,
  ExerciseSet,
  GameDef,
  GameResult,
  HtmlGame,
  Lesson,
  Proposal,
  RepoItem,
  School,
  StudentAnswer,
  Submission,
  TeachingProfile,
  Team,
  TutorData,
} from '../types';
import { PACK, PACK_LESSONS, SCHOOLS, TEAMS } from '../data/seed';
import { QUESTIONS } from '../data/questions';
import { topicResults, topicResultsFromGameSkills, updateWeakTopics } from '../answers';
import { INITIAL_HASH, clearAuthHash, supabase } from '../supabase/client';
import { loadAppState } from '../supabase/load';
import { persistAction } from '../supabase/persist';

export interface AppState {
  currentAccountId: string | null;
  accounts: Account[];
  /** Schools and teams, loaded from the database (static seed as fallback). */
  schools: School[];
  teams: Team[];
  /** Classes are mutable state: teachers can create new ones. */
  classes: ClassGroup[];
  lessons: Lesson[];
  assignments: Assignment[];
  submissions: Submission[];
  proposals: Proposal[];
  repoItems: RepoItem[];
  tutor: Record<string, TutorData>;
  /** Practice exercise sets generated from lessons, keyed by set id. */
  exerciseSets: ExerciseSet[];
  /** Single-file HTML games (AI-generated or uploaded), attached to
   * lessons or standalone in a student's Tutor Space. */
  htmlGames: HtmlGame[];
  /** Finished runs reported by HTML games via EDUPRO_GAME_RESULT. */
  gameResults: GameResult[];
  /** Personal Space renames, keyed by student id. */
  spaceNames: Record<string, string>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildInitialState(): AppState {
  return {
    currentAccountId: null,
    accounts: [],
    schools: clone(SCHOOLS),
    teams: clone(TEAMS),
    classes: [],
    lessons: clone(PACK_LESSONS),
    assignments: [],
    submissions: [],
    proposals: [],
    repoItems: [],
    tutor: {},
    exerciseSets: [],
    htmlGames: [],
    gameResults: [],
    spaceNames: {},
  };
}

export type Action =
  | { type: 'LOAD_STATE'; state: AppState }
  | { type: 'LOGOUT' }
  | { type: 'SUBMIT_WORK'; submission: Submission }
  | { type: 'ADD_COMMENT'; submissionId: string; comment: string }
  | { type: 'MARK_REVIEWED'; submissionId: string }
  | { type: 'PROPOSE'; proposal: Proposal }
  | { type: 'REVIEW_PROPOSAL'; proposalId: string; decision: 'approved' | 'rejected'; reason: string; decidedBy: string; repoItem?: RepoItem; nextStage?: Proposal['stage'] }
  | { type: 'CREATE_ASSIGNMENT'; assignment: Assignment }
  | { type: 'COPY_TO_MY_SPACE'; lesson: Lesson }
  | { type: 'CREATE_CLASS'; classGroup: ClassGroup }
  | { type: 'SET_TEACHING_PROFILE'; accountId: string; profile: TeachingProfile }
  | { type: 'CREATE_EXERCISE_SET'; set: ExerciseSet }
  | { type: 'UPDATE_EXERCISE_SET'; set: ExerciseSet }
  | { type: 'DELETE_EXERCISE_SET'; setId: string }
  | { type: 'CREATE_HTML_GAME'; game: HtmlGame }
  | { type: 'UPDATE_HTML_GAME'; game: HtmlGame }
  | { type: 'DELETE_HTML_GAME'; gameId: string }
  | { type: 'RECORD_HTML_GAME_RESULT'; result: GameResult }
  | { type: 'ADD_REVIEW_QUESTION'; studentId: string; questionId: string }
  | { type: 'MARK_MASTERED'; studentId: string; questionId: string }
  | { type: 'ADD_CHAT'; studentId: string; message: ChatMsg }
  | { type: 'SAVE_GAME'; studentId: string; game: GameDef }
  | { type: 'RECORD_GAME_SCORE'; studentId: string; gameId: string; score: number }
  | { type: 'UPDATE_LESSON_COPY'; lesson: Lesson }
  | { type: 'CREATE_LESSON_COPY'; lesson: Lesson }
  | { type: 'DELETE_LESSON_COPY'; lessonId: string }
  | { type: 'RENAME_SPACE'; studentId: string; name: string };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
      return action.state;
    case 'LOGOUT':
      return { ...state, currentAccountId: null };
    case 'SUBMIT_WORK': {
      const existing = state.submissions.findIndex(
        (s) => s.assignmentId === action.submission.assignmentId && s.studentId === action.submission.studentId,
      );
      const submissions = [...state.submissions];
      if (existing >= 0) submissions[existing] = action.submission;
      else submissions.push(action.submission);
      // A new submission is fresh evidence about the student's weak topics:
      // fully correct on a topic clears it, under half correct flags it.
      const tutorData = state.tutor[action.submission.studentId];
      if (!tutorData) return { ...state, submissions };
      const assignment = state.assignments.find((a) => a.id === action.submission.assignmentId);
      const lesson = assignment
        ? state.lessons.find((l) => l.id === assignment.lessonId)
        : undefined;
      if (!lesson) return { ...state, submissions };
      const questions = QUESTIONS.filter((q) => lesson.questionIds.includes(q.id));
      const weakTopics = updateWeakTopics(
        tutorData.weakTopics,
        topicResults(questions, action.submission.answers),
        PACK.topics.map((t) => t.id),
      );
      return {
        ...state,
        submissions,
        tutor: {
          ...state.tutor,
          [action.submission.studentId]: { ...tutorData, weakTopics },
        },
      };
    }
    case 'ADD_COMMENT':
      return {
        ...state,
        submissions: state.submissions.map((s) =>
          s.id === action.submissionId ? { ...s, comment: action.comment } : s,
        ),
      };
    case 'MARK_REVIEWED':
      return {
        ...state,
        submissions: state.submissions.map((s) =>
          s.id === action.submissionId ? { ...s, reviewed: true } : s,
        ),
      };
    case 'PROPOSE':
      return { ...state, proposals: [...state.proposals, action.proposal] };
    case 'REVIEW_PROPOSAL': {
      const nextStage: Proposal['stage'] = action.nextStage ?? 'done';
      const proposals = state.proposals.map((p): Proposal => {
        if (p.id !== action.proposalId) return p;
        if (action.decision === 'rejected') {
          return { ...p, status: 'rejected', reason: action.reason, decidedBy: action.decidedBy };
        }
        if (nextStage === 'done') {
          return { ...p, status: 'approved', stage: 'done', decidedBy: action.decidedBy };
        }
        return { ...p, stage: nextStage, decidedBy: action.decidedBy };
      });
      const repoItems = action.repoItem ? [...state.repoItems, action.repoItem] : state.repoItems;
      return { ...state, proposals, repoItems };
    }
    case 'CREATE_ASSIGNMENT':
      return { ...state, assignments: [...state.assignments, action.assignment] };
    case 'COPY_TO_MY_SPACE':
      return { ...state, lessons: [...state.lessons, action.lesson] };
    case 'CREATE_CLASS': {
      // The new class must also join the teacher's class list: teacher
      // visibility (visibleClasses) is driven by account.classIds.
      const teacherId = action.classGroup.teacherId;
      return {
        ...state,
        classes: [...state.classes, action.classGroup],
        accounts: state.accounts.map((a) =>
          teacherId !== null && a.id === teacherId && !a.classIds.includes(action.classGroup.id)
            ? { ...a, classIds: [...a.classIds, action.classGroup.id] }
            : a,
        ),
      };
    }
    case 'SET_TEACHING_PROFILE':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId ? { ...a, teachingProfile: action.profile } : a,
        ),
      };
    case 'CREATE_EXERCISE_SET':
      return { ...state, exerciseSets: [...state.exerciseSets, action.set] };
    case 'UPDATE_EXERCISE_SET':
      return {
        ...state,
        exerciseSets: state.exerciseSets.map((s) => (s.id === action.set.id ? action.set : s)),
      };
    case 'DELETE_EXERCISE_SET':
      return { ...state, exerciseSets: state.exerciseSets.filter((s) => s.id !== action.setId) };
    case 'CREATE_HTML_GAME':
      return { ...state, htmlGames: [...state.htmlGames, action.game] };
    case 'UPDATE_HTML_GAME':
      return {
        ...state,
        htmlGames: state.htmlGames.map((g) => (g.id === action.game.id ? action.game : g)),
      };
    case 'DELETE_HTML_GAME':
      return { ...state, htmlGames: state.htmlGames.filter((g) => g.id !== action.gameId) };
    case 'RECORD_HTML_GAME_RESULT': {
      const result = action.result;
      const tutorData = state.tutor[result.studentId];
      const gameResults = [...state.gameResults, result];
      if (!tutorData) return { ...state, gameResults };
      // A finished game run is fresh evidence about weak topics, with
      // the same rule as a submission: fully correct clears a topic,
      // under half correct flags it.
      const weakTopics = updateWeakTopics(
        tutorData.weakTopics,
        topicResultsFromGameSkills(result.skills, PACK.topics),
        PACK.topics.map((t) => t.id),
      );
      const prevBest = tutorData.bestScores[result.gameId] ?? 0;
      return {
        ...state,
        gameResults,
        tutor: {
          ...state.tutor,
          [result.studentId]: {
            ...tutorData,
            weakTopics,
            bestScores: {
              ...tutorData.bestScores,
              [result.gameId]: Math.max(prevBest, result.score),
            },
          },
        },
      };
    }
    case 'ADD_REVIEW_QUESTION': {
      const t = state.tutor[action.studentId];
      if (!t || t.reviewQuestionIds.includes(action.questionId)) return state;
      return {
        ...state,
        tutor: { ...state.tutor, [action.studentId]: { ...t, reviewQuestionIds: [...t.reviewQuestionIds, action.questionId] } },
      };
    }
    case 'MARK_MASTERED': {
      const t = state.tutor[action.studentId];
      if (!t) return state;
      return {
        ...state,
        tutor: {
          ...state.tutor,
          [action.studentId]: {
            ...t,
            reviewQuestionIds: t.reviewQuestionIds.filter((id) => id !== action.questionId),
            masteredIds: t.masteredIds.includes(action.questionId) ? t.masteredIds : [...t.masteredIds, action.questionId],
          },
        },
      };
    }
    case 'ADD_CHAT': {
      const t = state.tutor[action.studentId];
      if (!t) return state;
      return {
        ...state,
        tutor: { ...state.tutor, [action.studentId]: { ...t, chat: [...t.chat, action.message] } },
      };
    }
    case 'SAVE_GAME': {
      const t = state.tutor[action.studentId];
      if (!t) return state;
      return {
        ...state,
        tutor: { ...state.tutor, [action.studentId]: { ...t, selfGames: [...t.selfGames, action.game] } },
      };
    }
    case 'RECORD_GAME_SCORE': {
      const t = state.tutor[action.studentId];
      if (!t) return state;
      const prev = t.bestScores[action.gameId] ?? 0;
      return {
        ...state,
        tutor: {
          ...state.tutor,
          [action.studentId]: {
            ...t,
            bestScores: { ...t.bestScores, [action.gameId]: Math.max(prev, action.score) },
          },
        },
      };
    }
    case 'UPDATE_LESSON_COPY':
      return {
        ...state,
        lessons: state.lessons.map((l) => (l.id === action.lesson.id ? action.lesson : l)),
      };
    case 'CREATE_LESSON_COPY':
      return { ...state, lessons: [...state.lessons, action.lesson] };
    case 'DELETE_LESSON_COPY':
      // The database cascades the delete to the lesson's games and
      // exercise sets; mirror that here so no stale rows linger in state.
      return {
        ...state,
        lessons: state.lessons.filter((l) => l.id !== action.lessonId),
        htmlGames: state.htmlGames.filter((g) => g.lessonId !== action.lessonId),
        exerciseSets: state.exerciseSets.filter((s) => s.lessonId !== action.lessonId),
      };
    case 'RENAME_SPACE':
      return {
        ...state,
        spaceNames: { ...state.spaceNames, [action.studentId]: action.name.trim() },
      };
    default:
      return state;
  }
}

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'no-config';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  /** True when the user arrived via an invite/recovery link and must set
   * a password before using the app. */
  needsPassword: boolean;
  /** Last load failure, if the state could not be read from Supabase. */
  loadError: string | null;
  /** Last persist failure, if a change could not be written. */
  syncError: string | null;
  refreshing: boolean;
  refresh: () => void;
  signOut: () => void;
  clearNeedsPassword: () => void;
  clearSyncError: () => void;
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  currentAccount: Account | null;
  auth: AuthContextValue;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/** Invite and recovery links carry their type in the URL hash. */
function cameFromInviteOrRecovery(): boolean {
  return INITIAL_HASH.includes('type=invite') || INITIAL_HASH.includes('type=recovery');
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(reducer, undefined, buildInitialState);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(supabase ? 'loading' : 'no-config');
  const [session, setSession] = useState<Session | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  // Persist queue: one promise chain, so writes land in dispatch order.
  const queueRef = useRef(Promise.resolve());
  const loadingForRef = useRef<string | null>(null);

  const loadIntoStore = useCallback(async (userId: string) => {
    if (!supabase || loadingForRef.current === userId) return;
    loadingForRef.current = userId;
    setRefreshing(true);
    setLoadError(null);
    try {
      const loaded = await loadAppState(supabase, userId);
      baseDispatch({ type: 'LOAD_STATE', state: loaded });
      setAuthStatus('signed-in');
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Không tải được dữ liệu. Hãy thử lại.',
      );
      setAuthStatus('signed-in');
    } finally {
      loadingForRef.current = null;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setSession(data.session);
        if (cameFromInviteOrRecovery()) setNeedsPassword(true);
        void loadIntoStore(data.session.user.id);
      } else {
        setAuthStatus('signed-out');
      }
    });
    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      if (event === 'SIGNED_IN' && nextSession) {
        setSession(nextSession);
        if (cameFromInviteOrRecovery()) setNeedsPassword(true);
        void loadIntoStore(nextSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setNeedsPassword(false);
        setLoadError(null);
        baseDispatch({ type: 'LOAD_STATE', state: buildInitialState() });
        setAuthStatus('signed-out');
      } else if (event === 'PASSWORD_RECOVERY') {
        setNeedsPassword(true);
      }
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadIntoStore]);

  const dispatch = useCallback((action: Action) => {
    const prev = stateRef.current;
    baseDispatch(action);
    const next = reducer(prev, action);
    stateRef.current = next;
    if (!supabase || action.type === 'LOAD_STATE' || action.type === 'LOGOUT') return;
    const client = supabase;
    queueRef.current = queueRef.current
      .then(() => persistAction(client, action, next))
      .catch((err: unknown) => {
        setSyncError(err instanceof Error ? err.message : 'Không lưu được thay đổi.');
      });
  }, []);

  const refresh = useCallback(() => {
    if (!session) return;
    setSyncError(null);
    void loadIntoStore(session.user.id);
  }, [session, loadIntoStore]);

  const signOut = useCallback(() => {
    if (!supabase) return;
    void supabase.auth.signOut();
  }, []);

  const clearNeedsPassword = useCallback(() => {
    setNeedsPassword(false);
    clearAuthHash();
  }, []);

  const clearSyncError = useCallback(() => setSyncError(null), []);

  const value = useMemo<StoreContextValue>(() => {
    const currentAccount =
      state.accounts.find((a) => a.id === state.currentAccountId) ?? null;
    return {
      state,
      dispatch,
      currentAccount,
      auth: {
        status: authStatus,
        session,
        needsPassword,
        loadError,
        syncError,
        refreshing,
        refresh,
        signOut,
        clearNeedsPassword,
        clearSyncError,
      },
    };
  }, [
    state,
    dispatch,
    authStatus,
    session,
    needsPassword,
    loadError,
    syncError,
    refreshing,
    refresh,
    signOut,
    clearNeedsPassword,
    clearSyncError,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

// Static reference data: the Pack only. Schools, teams and classes live
// in AppState because they come from the database.
export const REFERENCE = { PACK };

export type { StudentAnswer };

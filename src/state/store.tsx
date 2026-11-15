// In-memory demo store: React context + reducer.
// No backend: everything resets when the page reloads, and "reset demo"
// restores the seed data exactly.
import { createContext, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type {
  Account,
  Assignment,
  ChatMsg,
  ClassGroup,
  GameDef,
  Lesson,
  Proposal,
  RepoItem,
  StudentAnswer,
  Submission,
  TeachingProfile,
  TutorData,
} from '../types';
import {
  ACCOUNTS,
  ASSIGNMENTS,
  CLASSES,
  LESSON_COPIES,
  PACK,
  PACK_LESSONS,
  PROPOSALS,
  REPO_ITEMS,
  SCHOOLS,
  SUBMISSIONS,
  TEAMS,
  TUTOR_DATA,
} from '../data/seed';
import { QUESTIONS } from '../data/questions';
import { topicResults, updateWeakTopics } from '../answers';

export interface AppState {
  currentAccountId: string | null;
  accounts: Account[];
  /** Classes are mutable state: teachers can create new ones. */
  classes: ClassGroup[];
  lessons: Lesson[];
  assignments: Assignment[];
  submissions: Submission[];
  proposals: Proposal[];
  repoItems: RepoItem[];
  tutor: Record<string, TutorData>;
  /** Personal Space renames, keyed by student id. */
  spaceNames: Record<string, string>;
  /** Admin school filter (null = all schools). */
  schoolFilter: string | null;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildInitialState(): AppState {
  return {
    currentAccountId: null,
    accounts: clone(ACCOUNTS),
    classes: clone(CLASSES),
    lessons: clone([...PACK_LESSONS, ...LESSON_COPIES]),
    assignments: clone(ASSIGNMENTS),
    submissions: clone(SUBMISSIONS),
    proposals: clone(PROPOSALS),
    repoItems: clone(REPO_ITEMS),
    tutor: clone(TUTOR_DATA),
    spaceNames: {},
    schoolFilter: null,
  };
}

export type Action =
  | { type: 'SWITCH_ACCOUNT'; accountId: string }
  | { type: 'LOGOUT' }
  | { type: 'SUBMIT_WORK'; submission: Submission }
  | { type: 'ADD_COMMENT'; submissionId: string; comment: string }
  | { type: 'MARK_REVIEWED'; submissionId: string }
  | { type: 'PROPOSE'; proposal: Proposal }
  | { type: 'REVIEW_PROPOSAL'; proposalId: string; decision: 'approved' | 'rejected'; reason: string; decidedBy: string; repoItem?: RepoItem; nextStage?: Proposal['stage'] }
  | { type: 'CREATE_ASSIGNMENT'; assignment: Assignment }
  | { type: 'COPY_TO_MY_SPACE'; lesson: Lesson }
  | { type: 'CREATE_STUDENT'; account: Account; tutor: TutorData }
  | { type: 'CREATE_CLASS'; classGroup: ClassGroup }
  | { type: 'SET_TEACHING_PROFILE'; accountId: string; profile: TeachingProfile }
  | { type: 'ADD_REVIEW_QUESTION'; studentId: string; questionId: string }
  | { type: 'MARK_MASTERED'; studentId: string; questionId: string }
  | { type: 'ADD_CHAT'; studentId: string; message: ChatMsg }
  | { type: 'SAVE_GAME'; studentId: string; game: GameDef }
  | { type: 'RECORD_GAME_SCORE'; studentId: string; gameId: string; score: number }
  | { type: 'UPDATE_LESSON_COPY'; lesson: Lesson }
  | { type: 'CREATE_LESSON_COPY'; lesson: Lesson }
  | { type: 'DELETE_LESSON_COPY'; lessonId: string }
  | { type: 'SET_SCHOOL_FILTER'; schoolId: string | null }
  | { type: 'RENAME_SPACE'; studentId: string; name: string }
  | { type: 'RESET_DEMO' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SWITCH_ACCOUNT':
      return { ...state, currentAccountId: action.accountId };
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
    case 'CREATE_STUDENT':
      return {
        ...state,
        accounts: [...state.accounts, action.account],
        tutor: { ...state.tutor, [action.account.id]: action.tutor },
      };
    case 'CREATE_CLASS': {
      // The new class must also join the teacher's class list: teacher
      // visibility (visibleClasses) is driven by account.classIds.
      const teacherId = action.classGroup.teacherId;
      return {
        ...state,
        classes: [...state.classes, action.classGroup],
        accounts: state.accounts.map((a) =>
          a.id === teacherId && !a.classIds.includes(action.classGroup.id)
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
      return { ...state, lessons: state.lessons.filter((l) => l.id !== action.lessonId) };
    case 'SET_SCHOOL_FILTER':
      return { ...state, schoolFilter: action.schoolId };
    case 'RENAME_SPACE':
      return {
        ...state,
        spaceNames: { ...state.spaceNames, [action.studentId]: action.name.trim() },
      };
    case 'RESET_DEMO':
      return { ...buildInitialState(), currentAccountId: state.currentAccountId };
    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  currentAccount: Account | null;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const value = useMemo<StoreContextValue>(() => {
    const currentAccount =
      state.accounts.find((a) => a.id === state.currentAccountId) ?? null;
    return { state, dispatch, currentAccount };
  }, [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

// Static reference data (not part of the mutable demo state). Classes are
// NOT here: they live in AppState because teachers can create new ones.
export const REFERENCE = { SCHOOLS, TEAMS, PACK };

export type { StudentAnswer };

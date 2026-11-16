// Shared wire types for POST /api/ai-soan-bai, the copy the browser
// client uses. The Vercel function keeps a DUPLICATE of these types
// inlined in api/ai-soan-bai.ts (it cannot import project files — see
// the header rule in that file). The two copies MUST stay in sync: edit
// both whenever the wire format changes.
export type AuthorMode = 'auto' | 'topic' | 'outline';

export type GameMechanicChoice = 'ai' | 'snake' | 'pacman' | 'runner' | 'defender' | 'adventure';

/** Chat-revision mode for games: only the named part changes, the rest
 * of the file (especially tuned numbers) is preserved. */
export type GameReviseMode = 'tune' | 'reskin' | 'rules' | 'questions' | 'redo';

export type GameSession = 'short' | 'standard' | 'long';

export interface GameCard {
  title: string;
  mechanic: string;
  themeSummary: string;
  rules: string[];
  scoring: { action: string; points: string }[];
  questionPlan: string;
  difficultyTiers: string[];
  learningGoal: string;
  /** Full question bank (non-maths subjects): listed for approval. */
  questionBank?: string[];
}

export interface WireAttachment {
  name: string;
  mimeType: string;
  /** Raw file bytes, base64-encoded. */
  dataBase64: string;
}

export interface ChatTurn {
  from: 'teacher' | 'ai';
  text: string;
}

export interface AiRequestBody {
  stage: 'propose' | 'generate' | 'revise' | 'plan' | 'exercises' | 'game-propose' | 'game-generate' | 'game-revise';
  grade: number;
  subject: string;
  roleSentence: string;
  mode: AuthorMode;
  topic: string;
  outline: string;
  extraRequests: string;
  approvedStructure?: string;
  attachments: WireAttachment[];
  /** Revise only. */
  currentHtml?: string;
  history?: ChatTurn[];
  instruction?: string;
  /** Exercises only: plain text extracted from the lesson HTML. */
  lessonText?: string;
  /** Exercises only: how many questions to generate (1–20). */
  exerciseCount?: number;
  /** Game stages only. */
  gameMechanic?: GameMechanicChoice;
  gameTheme?: string;
  gameRules?: string;
  gameSeed?: string;
  gameSession?: GameSession;
  gameLanguage?: 'en' | 'vi';
  gamePlayers?: 1 | 2;
  /** game-generate only: the approved Game Card, JSON-encoded. */
  gameCard?: string;
  /** game-revise only: which part of the game the revision may change. */
  gameMode?: GameReviseMode;
}

// Shared wire types for POST /api/ai-soan-bai, the copy the browser
// client uses. The Vercel function keeps a DUPLICATE of these types
// inlined in api/ai-soan-bai.ts (it cannot import project files — see
// the header rule in that file). The two copies MUST stay in sync: edit
// both whenever the wire format changes.
export type AuthorMode = 'auto' | 'topic' | 'outline';

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
  stage: 'propose' | 'generate' | 'revise' | 'plan' | 'exercises';
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
}

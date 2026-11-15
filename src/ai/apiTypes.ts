// Shared wire types for POST /api/ai-soan-bai. Imported by both the
// browser client and the Vercel function so the two sides cannot drift.
// This file has no imports of its own (types only): the function imports
// it with `import type`, which is erased before bundling, so it is safe
// for the function to reference it from ../src. Runtime code the function
// needs must live under api/ instead (see api/_lib/prompt.ts).
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
  stage: 'propose' | 'generate' | 'revise';
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
}

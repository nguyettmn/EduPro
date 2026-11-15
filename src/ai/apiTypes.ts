// Shared wire types for POST /api/ai-soan-bai. Imported by both the
// browser client and the Vercel function so the two sides cannot drift.
import type { AuthorMode } from './prompt';

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

// Pure answer checking. Used by QuizRunner, the game, and the seed builder
// so demo submissions are scored by exactly the same rules as live answers.
import type { Question, StudentAnswer } from './types';

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0 ? 1 : x;
}

/** Value of a fraction answer as [numerator, denominator] in lowest terms. */
export function toLowest(n: number, d: number): [number, number] {
  const g = gcd(n, d);
  return [n / g, d / g];
}

export function checkAnswer(question: Question, given: StudentAnswer): boolean {
  const a = question.answer;
  if (given.type === 'empty') return false;
  switch (a.type) {
    case 'fraction': {
      if (given.type !== 'fraction' || given.d === 0) return false;
      const [an, ad] = toLowest(a.n, a.d);
      const [gn, gd] = toLowest(given.n, given.d);
      return an === gn && ad === gd;
    }
    case 'mixed': {
      if (given.type !== 'mixed' || given.d === 0) return false;
      // The fractional part must be a proper fraction.
      if (given.n >= given.d) return false;
      const expected = a.w + a.n / a.d;
      const got = given.w + given.n / given.d;
      return Math.abs(expected - got) < 1e-9;
    }
    case 'whole': {
      if (given.type === 'whole') return given.v === a.v;
      if (given.type === 'fraction' && given.d !== 0) {
        return given.n / given.d === a.v;
      }
      return false;
    }
    case 'decimal': {
      if (given.type !== 'decimal') return false;
      return Math.abs(given.v - a.v) < 0.001;
    }
    case 'choice': {
      return given.type === 'choice' && given.index === a.index;
    }
  }
}

/** Build the canonical correct StudentAnswer for a question (used by seed data). */
export function correctStudentAnswer(question: Question): StudentAnswer {
  const a = question.answer;
  switch (a.type) {
    case 'fraction':
      return { type: 'fraction', n: a.n, d: a.d };
    case 'mixed':
      return { type: 'mixed', w: a.w, n: a.n, d: a.d };
    case 'whole':
      return { type: 'whole', v: a.v };
    case 'decimal':
      return { type: 'decimal', v: a.v };
    case 'choice':
      return { type: 'choice', index: a.index };
  }
}

export function scoreAnswers(
  questions: Question[],
  answers: Record<string, StudentAnswer>,
): { score: number; total: number } {
  let score = 0;
  for (const q of questions) {
    const given = answers[q.id] ?? { type: 'empty' as const };
    if (checkAnswer(q, given)) score += 1;
  }
  return { score, total: questions.length };
}

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

export interface TopicResult {
  topicId: string;
  correct: number;
  total: number;
}

/**
 * Per-topic results for one submission. Only the given questions count;
 * unanswered questions count as wrong, exactly like scoreAnswers.
 */
export function topicResults(
  questions: Question[],
  answers: Record<string, StudentAnswer>,
): TopicResult[] {
  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const q of questions) {
    const entry = byTopic.get(q.topicId) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (checkAnswer(q, answers[q.id] ?? { type: 'empty' as const })) entry.correct += 1;
    byTopic.set(q.topicId, entry);
  }
  return [...byTopic.entries()].map(([topicId, { correct, total }]) => ({
    topicId,
    correct,
    total,
  }));
}

/**
 * Refresh a student's weak-topic list from one new submission.
 * - A topic answered fully correctly stops being weak.
 * - A topic with fewer than half correct becomes weak.
 * - Anything in between leaves the list unchanged, and topics the
 *   submission did not cover are untouched.
 * The result follows the pack topic order.
 */
export function updateWeakTopics(
  current: string[],
  results: TopicResult[],
  topicOrder: string[],
): string[] {
  const next = new Set(current);
  for (const r of results) {
    if (r.total === 0) continue;
    if (r.correct === r.total) next.delete(r.topicId);
    else if (r.correct * 2 < r.total) next.add(r.topicId);
  }
  const ordered = topicOrder.filter((id) => next.has(id));
  for (const id of next) {
    if (!topicOrder.includes(id)) ordered.push(id);
  }
  return ordered;
}

function normSkill(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Map a game's per-skill results onto Pack topics so a finished game run
 * refreshes weak topics with the same rule as a submission. A skill
 * matches a topic when one name contains the other (the game reports
 * free-text skill names from the lesson's topic labels). Unmatched
 * skills are ignored: a game must never invent weak topics.
 */
export function topicResultsFromGameSkills(
  skills: { skill: string; correct: number; wrong: number }[],
  topics: { id: string; title: string }[],
): TopicResult[] {
  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const s of skills) {
    const name = normSkill(s.skill);
    if (name === '') continue;
    const topic = topics.find((t) => {
      const title = normSkill(t.title);
      return title !== '' && (name.includes(title) || title.includes(name));
    });
    if (!topic) continue;
    const entry = byTopic.get(topic.id) ?? { correct: 0, total: 0 };
    entry.correct += s.correct;
    entry.total += s.correct + s.wrong;
    byTopic.set(topic.id, entry);
  }
  return [...byTopic.entries()].map(([topicId, { correct, total }]) => ({
    topicId,
    correct,
    total,
  }));
}

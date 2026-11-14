// Playable quick-quiz game: timed multiple choice built from the question
// bank. Used by lesson Game tabs and by Tutor Space game creation.
// No external images: themes are pure CSS.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameDef, MathLine, Question } from '../types';
import { MathExpr } from './Fraction';
import { QUESTIONS } from '../data/questions';

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmtDecimal(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

/** Turn any question into 4 shuffled multiple-choice options. */
function optionsFor(q: Question): { options: MathLine[]; correctIndex: number } {
  const a = q.answer;
  let options: MathLine[];
  if (a.type === 'choice') {
    options = [...(q.choices ?? [])];
    const correct = options[a.index];
    const rand = mulberry32(hashStr(q.id));
    const shuffled = [...options].sort(() => rand() - 0.5);
    return { options: shuffled, correctIndex: shuffled.indexOf(correct) };
  }
  const pool: { line: MathLine; value: number }[] = [];
  const push = (line: MathLine, value: number) => {
    if (pool.every((p) => Math.abs(p.value - value) > 1e-9)) pool.push({ line, value });
  };
  if (a.type === 'fraction') {
    push([{ k: 'f', n: a.n, d: a.d }], a.n / a.d);
    push([{ k: 'f', n: a.n + 1, d: a.d }], (a.n + 1) / a.d);
    push([{ k: 'f', n: a.n, d: a.d + 1 }], a.n / (a.d + 1));
    push([{ k: 'f', n: a.n + 2, d: a.d }], (a.n + 2) / a.d);
    push([{ k: 'f', n: a.n, d: a.d + 2 }], a.n / (a.d + 2));
    if (a.n > 0) push([{ k: 'f', n: a.n - 1, d: a.d }], (a.n - 1) / a.d);
  } else if (a.type === 'mixed') {
    const val = a.w + a.n / a.d;
    push([{ k: 'm', w: a.w, n: a.n, d: a.d }], val);
    push([{ k: 'm', w: a.w + 1, n: a.n, d: a.d }], val + 1);
    push([{ k: 'm', w: a.w, n: a.n + 1, d: a.d }], a.w + (a.n + 1) / a.d);
    push([{ k: 'm', w: a.w, n: a.n, d: a.d + 1 }], a.w + a.n / (a.d + 1));
    if (a.w > 0) push([{ k: 'm', w: a.w - 1, n: a.n, d: a.d }], val - 1);
  } else if (a.type === 'whole') {
    push([{ k: 't', s: String(a.v) }], a.v);
    push([{ k: 't', s: String(a.v + 1) }], a.v + 1);
    push([{ k: 't', s: String(a.v + 2) }], a.v + 2);
    if (a.v > 0) push([{ k: 't', s: String(a.v - 1) }], a.v - 1);
    push([{ k: 't', s: String(a.v + 3) }], a.v + 3);
  } else {
    push([{ k: 't', s: a.display }], a.v);
    push([{ k: 't', s: fmtDecimal(a.v + 0.1) }], a.v + 0.1);
    push([{ k: 't', s: fmtDecimal(a.v + 0.05) }], a.v + 0.05);
    if (a.v >= 0.1) push([{ k: 't', s: fmtDecimal(a.v - 0.1) }], a.v - 0.1);
    push([{ k: 't', s: fmtDecimal(a.v + 0.2) }], a.v + 0.2);
  }
  const picked = pool.slice(0, 4);
  const correctLine = picked[0].line;
  const rand = mulberry32(hashStr(q.id));
  const shuffled = [...picked].sort(() => rand() - 0.5).map((p) => p.line);
  return { options: shuffled, correctIndex: shuffled.indexOf(correctLine) };
}

const THEME_CLASS: Record<GameDef['theme'], string> = {
  ocean: 'game-theme-ocean',
  space: 'game-theme-space',
  forest: 'game-theme-forest',
};

const GAME_SECONDS = 60;

export function GameView({
  game,
  bestScore,
  onFinish,
  onExit,
}: {
  game: Pick<GameDef, 'title' | 'theme' | 'questionIds'>;
  bestScore?: number;
  onFinish?: (score: number, total: number) => void;
  onExit?: () => void;
}) {
  const questions = useMemo(
    () => game.questionIds.map((id) => QUESTIONS.find((q) => q.id === id)).filter((q): q is Question => Boolean(q)),
    [game.questionIds],
  );
  const rounds = useMemo(() => questions.map((q) => ({ q, ...optionsFor(q) })), [questions]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);
  const [done, setDone] = useState(false);
  const [runId, setRunId] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (done) return undefined;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setDone(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [done, runId]);

  useEffect(() => {
    if (done && !finishedRef.current) {
      finishedRef.current = true;
      onFinish?.(score, rounds.length);
    }
  }, [done, score, rounds.length, onFinish]);

  if (rounds.length === 0) {
    return <div className="empty-state">Game này chưa có câu hỏi.</div>;
  }

  if (done) {
    return (
      <div className={`game-shell ${THEME_CLASS[game.theme]}`}>
        <h3>{game.title}</h3>
        <div className="game-result">
          Điểm: {score} trên {rounds.length}
        </div>
        {bestScore !== undefined ? <p className="game-best">Điểm cao nhất trước đây: {bestScore}</p> : null}
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIndex(0);
              setScore(0);
              setPicked(null);
              setSecondsLeft(GAME_SECONDS);
              setDone(false);
              setRunId((r) => r + 1);
              finishedRef.current = false;
            }}
          >
            Chơi lại
          </button>
          {onExit ? (
            <button type="button" className="btn btn-secondary" onClick={onExit}>
              Quay lại
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const round = rounds[index];

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === round.correctIndex;
    if (correct) setScore((s) => s + 1);
    window.setTimeout(() => {
      if (index + 1 >= rounds.length) setDone(true);
      else {
        setIndex(index + 1);
        setPicked(null);
      }
    }, 700);
  };

  return (
    <div className={`game-shell ${THEME_CLASS[game.theme]}`}>
      <div className="game-top">
        <span className="game-title">{game.title}</span>
        <span className="game-timer">Còn lại: {secondsLeft} giây</span>
        <span className="game-progress">
          Câu {index + 1} trên {rounds.length} · Điểm {score}
        </span>
      </div>
      <div className="game-question">
        <div className="question-label">{round.q.label}</div>
        {round.q.expr.length > 0 ? (
          <div className="question-expr">
            <MathExpr line={round.q.expr} large />
          </div>
        ) : null}
      </div>
      <div className="game-options">
        {round.options.map((option, i) => {
          let cls = 'game-option';
          if (picked !== null) {
            if (i === round.correctIndex) cls += ' game-option-correct';
            else if (i === picked) cls += ' game-option-wrong';
          }
          return (
            <button key={i} type="button" className={cls} disabled={picked !== null} onClick={() => pick(i)}>
              <MathExpr line={option} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

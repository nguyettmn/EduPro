// Renders a single-file HTML game inside a sandboxed iframe (same
// sandbox as HtmlLessonPlayer: allow-scripts, NO allow-same-origin),
// injects the game id + challenge seed the game reads, and listens for
// the EDUPRO_GAME_RESULT postMessage the game sends when it ends. The
// result is recorded in the store (weak topics + best score) and shown
// as a recap below the frame. In preview mode (game studio) results are
// shown but NOT recorded.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameResult, HtmlGame } from '../types';
import { useStore } from '../state/store';

/** Inject the game id + seed globals the GAME_RESULT protocol and the
 * seeded PRNG read. Inserted right after <head> when present, else at
 * the top of the document. Values are JSON-encoded, never interpolated. */
export function injectGameGlobals(html: string, gameId: string, seed: string): string {
  const script = `<script>window.EDUPRO_GAME_ID=${JSON.stringify(gameId)};window.EDUPRO_GAME_SEED=${JSON.stringify(seed)};</script>`;
  const head = /<head[^>]*>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return `${html.slice(0, at)}${script}${html.slice(at)}`;
  }
  return `${script}${html}`;
}

function randomSeed(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let seed = '';
  for (let i = 0; i < 4; i++) seed += chars[Math.floor(Math.random() * chars.length)];
  return seed;
}

interface IncomingResult {
  type?: unknown;
  gameId?: unknown;
  seed?: unknown;
  won?: unknown;
  score?: unknown;
  stars?: unknown;
  durationSec?: unknown;
  correct?: unknown;
  wrong?: unknown;
  skills?: unknown;
  missedSkills?: unknown;
}

function parseGameResult(data: unknown, gameId: string): GameResult | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as IncomingResult;
  if (d.type !== 'EDUPRO_GAME_RESULT' || d.gameId !== gameId) return null;
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const skills: GameResult['skills'] = Array.isArray(d.skills)
    ? d.skills
        .filter(
          (s): s is { skill: unknown; correct: unknown; wrong: unknown } =>
            typeof s === 'object' && s !== null,
        )
        .map((s) => ({
          skill: typeof s.skill === 'string' ? s.skill : '',
          correct: num(s.correct),
          wrong: num(s.wrong),
        }))
        .filter((s) => s.skill !== '')
    : [];
  const missedSkills: string[] = Array.isArray(d.missedSkills)
    ? d.missedSkills.filter((s): s is string => typeof s === 'string')
    : [];
  return {
    id: `GR-${Date.now()}`,
    gameId,
    studentId: '',
    won: d.won === true,
    score: num(d.score),
    stars: Math.max(0, Math.min(3, Math.round(num(d.stars)))),
    durationSec: num(d.durationSec),
    correct: num(d.correct),
    wrong: num(d.wrong),
    skills,
    missedSkills,
    playedAt: new Date().toISOString(),
  };
}

export function GamePlayer({
  game,
  studentId,
  preview,
}: {
  game: HtmlGame;
  /** The player: results are recorded for this student (skipped in preview). */
  studentId: string;
  /** Studio preview: show results locally, do not record them. */
  preview?: boolean;
}) {
  const { dispatch } = useStore();
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const resultRef = useRef<string | null>(null);
  const seed = useMemo(() => game.seed ?? randomSeed(), [game.seed, game.id]);
  const srcDoc = useMemo(
    () => injectGameGlobals(game.htmlCode, game.id, seed),
    [game.htmlCode, game.id, seed],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const parsed = parseGameResult(event.data, game.id);
      if (!parsed) return;
      // One report per run: ignore repeats of the same finished run.
      const key = `${parsed.score}-${parsed.correct}-${parsed.wrong}-${parsed.durationSec}`;
      if (resultRef.current === key) return;
      resultRef.current = key;
      setResult(parsed);
      if (!preview) {
        dispatch({ type: 'RECORD_HTML_GAME_RESULT', result: { ...parsed, studentId } });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [game.id, studentId, preview, dispatch]);

  const replay = () => {
    resultRef.current = null;
    setResult(null);
    setRunKey((k) => k + 1);
  };

  return (
    <div>
      <div className="html-game-frame-wrap">
        <iframe
          key={`${game.id}-${runKey}`}
          className="html-game-frame"
          title={game.title}
          sandbox="allow-scripts"
          srcDoc={srcDoc}
        />
      </div>
      <p className="guide-text">
        Mã thử thách của lượt này: <strong>{seed}</strong>
        {game.needsInternet ? ' · Game này tải tài nguyên từ mạng, cần có mạng mới chơi đầy đủ.' : ''}
      </p>
      <div className="row-actions">
        <button type="button" className="btn btn-secondary" onClick={replay}>
          Chơi lại từ đầu
        </button>
      </div>
      {result ? (
        <div className="game-recap">
          <h3 className="subhead">
            Kết quả lượt chơi {result.won ? '— Thắng!' : '— Chưa thắng'}
          </h3>
          <p>
            Điểm <strong>{result.score}</strong> · {'★'.repeat(result.stars)}
            {'☆'.repeat(3 - result.stars)} · Đúng {result.correct} / Sai {result.wrong} ·{' '}
            {result.durationSec} giây
          </p>
          {result.skills.length > 0 ? (
            <ul>
              {result.skills.map((s) => (
                <li key={s.skill}>
                  {s.skill}: đúng {s.correct}, sai {s.wrong}
                </li>
              ))}
            </ul>
          ) : null}
          {result.missedSkills.length > 0 ? (
            <p>
              Cần luyện thêm: <strong>{result.missedSkills.join(', ')}</strong>
            </p>
          ) : (
            <p>Không có kỹ năng nào cần luyện thêm trong lượt này.</p>
          )}
          {preview ? (
            <p className="guide-text">Đây là bản xem trước trong studio — kết quả không được lưu.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

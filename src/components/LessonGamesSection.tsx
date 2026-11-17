// Games attached to a lesson (one lesson can have many games) or
// standalone games in a student's Tutor Space. Create-by-AI opens the
// game studio; upload takes a .json record or a raw .html game file.
// Play is open to anyone viewing the lesson; edit/delete belong to the
// game owner only (managers never edit someone else's original).
import { useRef, useState } from 'react';
import type { Account, HtmlGame, Lesson, ViewId } from '../types';
import { canDo } from '../permissions';
import { useStore } from '../state/store';
import type { Route } from '../route';
import { buildGameExport, parseGameFile } from '../ai/gameFile';
import { downloadTextFile, safeFilename } from '../ai/lessonFile';
import { GamePlayer } from './GamePlayer';
import { EmptyState } from './ui';

export function LessonGamesSection({
  account,
  lesson,
  go,
  from,
  assignmentId,
}: {
  account: Account;
  /** The lesson the games attach to; null = the student's own Tutor Space games. */
  lesson: Lesson | null;
  go: (route: Route) => void;
  /** View the game studio returns to; defaults to the lesson detail page. */
  from?: ViewId;
  /** Assignment the studio returns to when `from` is 'assignments'. */
  assignmentId?: string;
}) {
  const { state, dispatch } = useStore();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isStudent = canDo(account, 'useTutor');
  const isTutorContext = lesson === null;

  const games = state.htmlGames.filter((g) =>
    isTutorContext ? g.ownerId === account.id && !g.lessonId : g.lessonId === lesson!.id,
  );
  const canCreate = isTutorContext ? isStudent : canDo(account, 'createContent');
  const canUpload = isTutorContext ? isStudent : canDo(account, 'createContent');

  // Games attach to database lessons. A Pack original is not a database
  // row, so the first game action on one copies it into "Bài của tôi"
  // and attaches the game to the copy instead.
  const ensureOwnedLesson = (): Lesson => {
    if (isTutorContext || lesson!.ownerId) return lesson!;
    const copy: Lesson = {
      ...JSON.parse(JSON.stringify(lesson!)) as Lesson,
      id: `LC-${Date.now()}`,
      title: `${lesson!.title} (bản của ${account.name})`,
      ownerId: account.id,
      sourceId: lesson!.id,
    };
    dispatch({ type: 'COPY_TO_MY_SPACE', lesson: copy });
    return copy;
  };

  const openStudio = (gameId?: string) => {
    if (isTutorContext) {
      go({ view: 'gamestudio', from: 'tutor', studentId: account.id, ...(gameId ? { gameId } : {}) });
    } else {
      const target = gameId ? lesson! : ensureOwnedLesson();
      go({
        view: 'gamestudio',
        from: from ?? 'lesson',
        lessonId: target.id,
        ...(assignmentId ? { assignmentId } : {}),
        ...(gameId ? { gameId } : {}),
      });
    }
  };

  const importFile = async (file: File) => {
    setNotice(null);
    setImportErrors([]);
    const text = await file.text();
    const { game, errors, warnings } = parseGameFile(text, file.name);
    if (!game) {
      setImportErrors(errors);
      return;
    }
    const record: HtmlGame = {
      id: `game_${Date.now()}`,
      title: game.title,
      mechanic: game.mechanic,
      theme: game.theme,
      htmlCode: game.htmlCode,
      ownerId: account.id,
      ...(lesson ? { lessonId: ensureOwnedLesson().id } : {}),
      createdAt: new Date().toISOString().slice(0, 10),
      needsInternet: game.needsInternet || undefined,
    };
    dispatch({ type: 'CREATE_HTML_GAME', game: record });
    setNotice(
      `Đã tải game "${game.title}" lên.${warnings.length > 0 ? ` ${warnings.join(' ')}` : ''}`,
    );
  };

  const downloadJson = (game: HtmlGame) => {
    downloadTextFile(safeFilename(game.title, 'json'), buildGameExport(game), 'application/json');
  };

  const downloadHtml = (game: HtmlGame) => {
    downloadTextFile(safeFilename(game.title, 'html'), game.htmlCode, 'text/html;charset=utf-8');
  };

  return (
    <div className="lesson-games">
      <h3 className="subhead">Trò chơi {games.length > 0 ? `(${games.length})` : ''}</h3>
      <p className="guide-text">
        {isTutorContext
          ? 'Game em tự tạo bằng AI hoặc tải lên. Chỉ em xem được các game này.'
          : isStudent
            ? 'Một bài học có thể có nhiều game. Chơi ngay tại đây.'
            : 'Một bài học có thể có nhiều game. Chơi ngay tại đây, hoặc tạo game mới gắn vào bài này.'}
      </p>
      {notice ? <p className="notice">{notice}</p> : null}
      {importErrors.map((e, i) => (
        <p key={i} className="guide-text">
          {e}
        </p>
      ))}
      {games.length === 0 ? (
        <EmptyState text={isTutorContext ? 'Em chưa có game nào.' : 'Bài này chưa có game nào.'} />
      ) : (
        games.map((game) => {
          const isOwner = game.ownerId === account.id;
          return (
            <div key={game.id} className="repo-item">
              <div className="repo-item-head">
                <span>
                  <strong>{game.title}</strong> · {game.mechanic} · {game.theme}
                </span>
                {game.seed ? <span className="muted">Mã: {game.seed}</span> : null}
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setPlayingId(playingId === game.id ? null : game.id)}
                >
                  {playingId === game.id ? 'Đóng game' : 'Chơi'}
                </button>
                {isOwner ? (
                  <button type="button" className="btn btn-secondary" onClick={() => openStudio(game.id)}>
                    Sửa
                  </button>
                ) : null}
                <button type="button" className="btn btn-secondary" onClick={() => downloadJson(game)}>
                  Tải JSON
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => downloadHtml(game)}>
                  Tải HTML
                </button>
                {isOwner ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      dispatch({ type: 'DELETE_HTML_GAME', gameId: game.id });
                      if (playingId === game.id) setPlayingId(null);
                      setNotice(`Đã xóa game "${game.title}".`);
                    }}
                  >
                    Xóa
                  </button>
                ) : null}
              </div>
              {playingId === game.id ? <GamePlayer game={game} studentId={account.id} /> : null}
            </div>
          );
        })
      )}
      <div className="row-actions">
        {canCreate ? (
          <button type="button" className="btn btn-primary" onClick={() => openStudio()}>
            + Tạo game bằng AI
          </button>
        ) : null}
        {canUpload ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.html,.htm"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = '';
              }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Tải game lên (JSON hoặc HTML)
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

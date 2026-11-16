// Tutor Space: the student's PRIVATE space. Contents (chat, self-made
// questions and games) are visible ONLY to the owning student. Managers
// opening it see ONLY the summary card — enforced here, in the view.
import { useState } from 'react';
import type { Account, GameDef } from '../types';
import { QUESTIONS } from '../data/questions';
import { canViewTutorContents, canViewTutorSummary } from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import type { Route } from '../route';
import { tutorReply } from '../tutorEngine';
import { GameView } from './GameView';
import { LessonGamesSection } from './LessonGamesSection';
import { QuizRunner } from './QuizRunner';
import { EmptyState, SectionBand, StatCard, TopicTag } from './ui';

type TutorTab = 'chat' | 'practice' | 'game' | 'review';

const THEME_LABEL: Record<GameDef['theme'], string> = {
  ocean: 'Đại dương',
  space: 'Vũ trụ',
  forest: 'Rừng xanh',
};

function TutorSummary({
  student,
  viewer,
  route,
  go,
}: {
  student: Account;
  viewer: Account;
  route: Route;
  go: (route: Route) => void;
}) {
  const { state } = useStore();
  const tutor = state.tutor[student.id];
  const topics = REFERENCE.PACK.topics;
  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() =>
          go({
            view: route.from ?? 'dashboard',
            ...(route.from === 'classes' && route.classId ? { classId: route.classId } : {}),
          })
        }
      >
        ← Quay lại
      </button>
      <SectionBand
        title={`Tóm tắt Tutor Space của ${student.name}`}
        guide="Bạn chỉ thấy tóm tắt chung. Nội dung bên trong Tutor Space là riêng tư, kể cả với người quản lý."
        color="#be185d"
      />
      <div className="privacy-note">
        Nội dung chat, câu hỏi và game tự tạo của học sinh không hiện ở đây. Chỉ khi học sinh đề xuất một món lên
        Kho chung thì món đó mới được người duyệt xem.
      </div>
      <div className="stat-grid">
        <StatCard label="Số buổi luyện" value={String(tutor?.sessions ?? 0)} color="#be185d" />
        <StatCard label="Câu cần ôn lại" value={String(tutor?.reviewQuestionIds.length ?? 0)} color="#be185d" />
        <StatCard label="Câu đã thuộc" value={String(tutor?.masteredIds.length ?? 0)} color="#be185d" />
        <StatCard
          label="Game tự tạo"
          value={String(
            (tutor?.selfGames.length ?? 0) +
              state.htmlGames.filter((g) => g.ownerId === student.id && !g.lessonId).length,
          )}
          color="#be185d"
        />
      </div>
      <h3 className="subhead">Chủ đề còn yếu</h3>
      {tutor && tutor.weakTopics.length > 0 ? (
        <div className="tag-row">
          {tutor.weakTopics.map((id) => {
            const t = topics.find((x) => x.id === id);
            return t ? <TopicTag key={id} topic={t} /> : null;
          })}
        </div>
      ) : (
        <p className="guide-text">Không có chủ đề yếu nào được ghi nhận.</p>
      )}
      <p className="guide-text">
        Bạn đang xem với vai trò {viewer.name}. Học sinh là người duy nhất đọc được nội dung bên trong không gian
        này.
      </p>
    </div>
  );
}

export function TutorSpace({
  account,
  route,
  go,
}: {
  account: Account;
  route: Route;
  go: (route: Route) => void;
}) {
  const { state, dispatch } = useStore();
  const studentId = route.studentId ?? account.id;
  const student = state.accounts.find((a) => a.id === studentId);
  const [tab, setTab] = useState<TutorTab>('chat');
  const [chatDraft, setChatDraft] = useState('');
  const [practiceTopic, setPracticeTopic] = useState('A');
  const [practiceLevel, setPracticeLevel] = useState<1 | 2 | 3>(1);
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [gameTitle, setGameTitle] = useState('');
  const [gameTheme, setGameTheme] = useState<GameDef['theme']>('ocean');
  const [gameTopic, setGameTopic] = useState('A');
  const [gameCount, setGameCount] = useState(4);
  const [playingGameId, setPlayingGameId] = useState<string | null>(null);
  const [proposeGameId, setProposeGameId] = useState<string | null>(null);
  const [proposeTarget, setProposeTarget] = useState<'team' | 'school'>('school');
  const [proposeAnonymous, setProposeAnonymous] = useState(true);
  const [reviewId, setReviewId] = useState<string | null>(null);

  if (!student || student.role !== 'student') {
    return <EmptyState text="Không tìm thấy học sinh này." />;
  }
  if (!canViewTutorContents(account, studentId)) {
    if (!canViewTutorSummary(account, student, state.accounts)) {
      return <EmptyState text="Bạn không có quyền xem Tutor Space của học sinh này." />;
    }
    return <TutorSummary student={student} viewer={account} route={route} go={go} />;
  }

  const tutor = state.tutor[studentId] ?? {
    studentId,
    sessions: 0,
    weakTopics: [],
    chat: [],
    selfGames: [],
    reviewQuestionIds: [],
    masteredIds: [],
    bestScores: {},
  };
  const topics = REFERENCE.PACK.topics;

  const sendChat = () => {
    const text = chatDraft.trim();
    if (text === '') return;
    const stamp = Date.now();
    dispatch({ type: 'ADD_CHAT', studentId, message: { id: `m-${stamp}`, from: 'student', text } });
    dispatch({
      type: 'ADD_CHAT',
      studentId,
      message: { id: `m-${stamp + 1}`, from: 'tutor', text: tutorReply(text, student.name) },
    });
    setChatDraft('');
  };

  const practiceQuestions = QUESTIONS.filter(
    (q) => q.topicId === practiceTopic && q.difficulty === practiceLevel,
  ).slice(0, 5);

  const reviewQuestions = QUESTIONS.filter((q) => tutor.reviewQuestionIds.includes(q.id));
  const reviewQuestion = reviewQuestions.find((q) => q.id === reviewId);

  const createGame = () => {
    const pool = QUESTIONS.filter((q) => q.topicId === gameTopic).slice(0, gameCount);
    if (pool.length === 0) return;
    const game: GameDef = {
      id: `G-${Date.now()}`,
      title: gameTitle.trim() !== '' ? gameTitle.trim() : `Game ${topics.find((t) => t.id === gameTopic)?.title ?? ''}`,
      mechanic: 'quick-quiz',
      theme: gameTheme,
      topicId: gameTopic,
      questionIds: pool.map((q) => q.id),
      createdBy: studentId,
      createdByName: student.name,
      anonymous: false,
    };
    dispatch({ type: 'SAVE_GAME', studentId, game });
    setGameTitle('');
  };

  const proposeGame = (game: GameDef) => {
    dispatch({
      type: 'PROPOSE',
      proposal: {
        id: `PR-${Date.now()}`,
        kind: 'game',
        title: game.title,
        topicId: game.topicId,
        createdBy: studentId,
        createdByName: student.name,
        anonymous: proposeAnonymous,
        targetRepo: proposeTarget,
        schoolId: student.schoolId ?? 'S1',
        teamId: state.classes.find((c) => student.classIds.includes(c.id))?.teamId ?? null,
        stage: 'teacher',
        status: 'pending',
        game: { ...game, anonymous: proposeAnonymous },
        createdAt: new Date().toISOString().slice(0, 10),
      },
    });
    setProposeGameId(null);
  };

  return (
    <div>
      <SectionBand
        title="Tutor Space của tôi"
        guide="Không gian riêng tư của em. Thầy cô chỉ thấy tóm tắt chung, không đọc được nội dung ở đây."
        color="#be185d"
      />
      <div className="tabs" role="tablist">
        <button type="button" className={tab === 'chat' ? 'tab tab-active' : 'tab'} onClick={() => setTab('chat')}>
          Chat AI
        </button>
        <button type="button" className={tab === 'practice' ? 'tab tab-active' : 'tab'} onClick={() => setTab('practice')}>
          Tự luyện
        </button>
        <button type="button" className={tab === 'game' ? 'tab tab-active' : 'tab'} onClick={() => setTab('game')}>
          Tạo game
        </button>
        <button type="button" className={tab === 'review' ? 'tab tab-active' : 'tab'} onClick={() => setTab('review')}>
          Ngân hàng ôn tập ({tutor.reviewQuestionIds.length})
        </button>
      </div>

      {tab === 'chat' ? (
        <div className="chat-shell">
          <div className="chat-list">
            {tutor.chat.length === 0 ? (
              <p className="guide-text">Hãy hỏi một câu về phân số để bắt đầu nhé.</p>
            ) : (
              tutor.chat.map((m) => (
                <div key={m.id} className={m.from === 'student' ? 'chat-msg chat-mine' : 'chat-msg chat-tutor'}>
                  {m.text}
                </div>
              ))
            )}
          </div>
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
          >
            <input
              aria-label="Hỏi gia sư AI"
              placeholder="Hỏi về phân số, ví dụ: rút gọn là gì?"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Gửi
            </button>
          </form>
          <p className="guide-text">
            Gia sư demo trả lời bằng gợi ý có sẵn, không dùng AI thật. Với bài được giao, gia sư chỉ gợi ý, không cho
            đáp án trực tiếp.
          </p>
        </div>
      ) : null}

      {tab === 'practice' ? (
        <div>
          <div className="form-card">
            <h3 className="subhead">Tự tạo buổi luyện</h3>
            <div className="field-row">
              <label className="field">
                <span>Chủ đề</span>
                <select value={practiceTopic} onChange={(e) => setPracticeTopic(e.target.value)}>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} · {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Độ khó</span>
                <select
                  value={practiceLevel}
                  onChange={(e) => setPracticeLevel(Number(e.target.value) as 1 | 2 | 3)}
                >
                  <option value={1}>Dễ</option>
                  <option value={2}>Vừa</option>
                  <option value={3}>Khó</option>
                </select>
              </label>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setPracticeStarted(true)}>
              Bắt đầu luyện
            </button>
          </div>
          {practiceStarted ? (
            practiceQuestions.length === 0 ? (
              <EmptyState text="Không có câu hỏi nào cho lựa chọn này. Hãy thử chủ đề hoặc độ khó khác." />
            ) : (
              <QuizRunner
                key={`${practiceTopic}-${practiceLevel}`}
                questions={practiceQuestions}
                mode="practice"
                accentColor="#be185d"
                title="Buổi tự luyện"
                onWrongAnswer={(qid) =>
                  dispatch({ type: 'ADD_REVIEW_QUESTION', studentId, questionId: qid })
                }
              />
            )
          ) : null}
        </div>
      ) : null}

      {tab === 'game' ? (
        <div>
          <div className="form-card">
            <h3 className="subhead">Tạo game mới</h3>
            <p className="guide-text">Game được tạo từ ngân hàng câu hỏi, chơi ngay trong trang này.</p>
            <label className="field">
              <span>Tên game</span>
              <input value={gameTitle} onChange={(e) => setGameTitle(e.target.value)} placeholder="Ví dụ: Đua xe phân số" />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Giao diện</span>
                <select value={gameTheme} onChange={(e) => setGameTheme(e.target.value as GameDef['theme'])}>
                  {(Object.keys(THEME_LABEL) as GameDef['theme'][]).map((th) => (
                    <option key={th} value={th}>
                      {THEME_LABEL[th]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Chủ đề</span>
                <select value={gameTopic} onChange={(e) => setGameTopic(e.target.value)}>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} · {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Số câu</span>
                <select value={gameCount} onChange={(e) => setGameCount(Number(e.target.value))}>
                  <option value={4}>4 câu</option>
                  <option value={6}>6 câu</option>
                  <option value={8}>8 câu</option>
                </select>
              </label>
            </div>
            <button type="button" className="btn btn-primary" onClick={createGame}>
              Tạo game
            </button>
          </div>
          <h3 className="subhead">Game của em</h3>
          {tutor.selfGames.length === 0 ? (
            <EmptyState text="Em chưa tạo game nào." />
          ) : (
            tutor.selfGames.map((game) => (
              <div key={game.id} className="repo-item">
                <div className="repo-item-head">
                  <span>
                    <strong>{game.title}</strong> · {THEME_LABEL[game.theme]} · {game.questionIds.length} câu
                  </span>
                  <span className="muted">
                    Điểm cao nhất: {tutor.bestScores[game.id] ?? 'chưa chơi'}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setPlayingGameId(playingGameId === game.id ? null : game.id)}
                  >
                    {playingGameId === game.id ? 'Đóng game' : 'Chơi'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setProposeGameId(proposeGameId === game.id ? null : game.id)}
                  >
                    Đề xuất lên Kho chung
                  </button>
                </div>
                {playingGameId === game.id ? (
                  <GameView
                    game={game}
                    bestScore={tutor.bestScores[game.id]}
                    onFinish={(score) =>
                      dispatch({ type: 'RECORD_GAME_SCORE', studentId, gameId: game.id, score })
                    }
                    onExit={() => setPlayingGameId(null)}
                  />
                ) : null}
                {proposeGameId === game.id ? (
                  <div className="form-card">
                    <label className="field">
                      <span>Gửi lên</span>
                      <select
                        value={proposeTarget}
                        onChange={(e) => setProposeTarget(e.target.value as 'team' | 'school')}
                      >
                        <option value="team">Kho Tổ</option>
                        <option value="school">Kho Trường</option>
                      </select>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={proposeAnonymous}
                        onChange={(e) => setProposeAnonymous(e.target.checked)}
                      />
                      <span>Ẩn tên em khi lên Kho chung (bỏ chọn để hiện tên)</span>
                    </label>
                    <p className="guide-text">
                      Giáo viên sẽ duyệt trước. Chỉ bản sao của game này được gửi đi, game gốc vẫn ở trong Tutor
                      Space của em.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={() => proposeGame(game)}>
                      Gửi đề xuất
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
          <LessonGamesSection account={account} lesson={null} go={go} />
        </div>
      ) : null}

      {tab === 'review' ? (
        <div>
          <p className="guide-text">
            Những câu em đã làm sai sẽ tự vào đây. Làm đúng một câu thì câu đó được đánh dấu đã thuộc.
          </p>
          {reviewQuestions.length === 0 ? (
            <EmptyState text="Ngân hàng ôn tập đang trống. Làm sai câu nào, câu đó sẽ vào đây." />
          ) : (
            <>
              <div className="tag-row">
                {reviewQuestions.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    className={reviewId === q.id ? 'topic-filter topic-filter-active' : 'topic-filter'}
                    onClick={() => setReviewId(q.id)}
                  >
                    Câu {q.id}
                  </button>
                ))}
              </div>
              {reviewQuestion ? (
                <QuizRunner
                  key={reviewQuestion.id}
                  questions={[reviewQuestion]}
                  mode="practice"
                  accentColor="#be185d"
                  title={`Ôn lại câu ${reviewQuestion.id}`}
                  onCorrectAnswer={(qid) => dispatch({ type: 'MARK_MASTERED', studentId, questionId: qid })}
                />
              ) : (
                <p className="guide-text">Chọn một câu để ôn lại.</p>
              )}
            </>
          )}
          {tutor.masteredIds.length > 0 ? (
            <p className="guide-text">Đã thuộc: {tutor.masteredIds.join(', ')}.</p>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={() => go({ view: 'dashboard' })}>
            Quay lại Trang chính
          </button>
        </div>
      ) : null}
    </div>
  );
}

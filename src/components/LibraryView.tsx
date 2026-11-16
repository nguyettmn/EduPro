// Lesson detail: Nội dung / Luyện tập / Game. Reached from Soạn bài
// (Pack tab) or from the student's Space. Pack browsing lives in Studio.
import type { Account, Lesson } from '../types';
import { QUESTIONS } from '../data/questions';
import { canDo } from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import type { Route } from '../route';
import { LessonPlayer } from './LessonPlayer';
import { HtmlLessonPlayer } from './HtmlLessonPlayer';
import { LessonExerciseSets } from './ExerciseRunner';
import { QuizRunner } from './QuizRunner';
import { GameView } from './GameView';
import { EmptyState, TopicTag } from './ui';

function LessonDetail({
  lesson,
  account,
  tab,
  go,
}: {
  lesson: Lesson;
  account: Account;
  tab: 'content' | 'practice' | 'game';
  go: (route: Route) => void;
}) {
  const { dispatch } = useStore();
  const questions = QUESTIONS.filter((q) => lesson.questionIds.includes(q.id));
  const topics = REFERENCE.PACK.topics.filter((t) => lesson.topicIds.includes(t.id));
  const isHtml = lesson.html !== undefined && lesson.html !== '';
  const isStudent = canDo(account, 'useTutor');
  const setTab = (next: 'content' | 'practice' | 'game') =>
    go({ view: 'lesson', lessonId: lesson.id, tab: next });

  const copyToMySpace = () => {
    const copy: Lesson = {
      ...JSON.parse(JSON.stringify(lesson)) as Lesson,
      id: `LC-${Date.now()}`,
      title: `${lesson.title} (bản của ${account.name})`,
      ownerId: account.id,
      sourceId: lesson.id,
    };
    dispatch({ type: 'COPY_TO_MY_SPACE', lesson: copy });
    go({ view: 'studio', lessonId: copy.id });
  };

  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => go(isStudent ? { view: 'assignments' } : { view: 'studio' })}
      >
        {isStudent ? '← Quay lại Space' : '← Quay lại Soạn bài'}
      </button>
      <div className="lesson-detail-head" style={{ borderTopColor: lesson.color }}>
        <h2>{lesson.title}</h2>
        <div className="tag-row">
          {topics.map((t) => (
            <TopicTag key={t.id} topic={t} />
          ))}
          {isHtml ? (
            <span className="muted">
              Bài HTML tương tác (AI soạn)
              {lesson.grade ? ` · Khối ${lesson.grade}` : ''}
              {lesson.subject ? ` · ${lesson.subject}` : ''}
            </span>
          ) : (
            <span className="muted">{questions.length} câu hỏi</span>
          )}
        </div>
        {canDo(account, 'createContent') && !lesson.ownerId ? (
          <button type="button" className="btn btn-secondary" onClick={copyToMySpace}>
            Copy về không gian của tôi
          </button>
        ) : null}
      </div>
      {isHtml ? (
        <>
          <HtmlLessonPlayer html={lesson.html!} title={lesson.title} />
          <LessonExerciseSets lessonId={lesson.id} />
        </>
      ) : (
        <>
      <div className="tabs" role="tablist">
        <button type="button" className={tab === 'content' ? 'tab tab-active' : 'tab'} onClick={() => setTab('content')}>
          Nội dung
        </button>
        <button type="button" className={tab === 'practice' ? 'tab tab-active' : 'tab'} onClick={() => setTab('practice')}>
          Luyện tập
        </button>
        <button type="button" className={tab === 'game' ? 'tab tab-active' : 'tab'} onClick={() => setTab('game')}>
          Game
        </button>
      </div>
      {tab === 'content' ? (
        <LessonPlayer
          lesson={lesson}
          onStartPractice={() => setTab('practice')}
          onPlayGame={() => setTab('game')}
        />
      ) : null}
      {tab === 'practice' ? (
        <QuizRunner
          questions={questions}
          mode="practice"
          accentColor={lesson.color}
          title={`Luyện tập: ${lesson.title}`}
          onWrongAnswer={
            isStudent
              ? (qid) => dispatch({ type: 'ADD_REVIEW_QUESTION', studentId: account.id, questionId: qid })
              : undefined
          }
        />
      ) : null}
      {tab === 'game' ? (
        <GameView
          game={{
            title: `Game: ${lesson.title}`,
            theme: 'ocean',
            questionIds: questions.slice(0, 8).map((q) => q.id),
          }}
        />
      ) : null}
        </>
      )}
    </div>
  );
}

export function LibraryView({
  account,
  route,
  go,
}: {
  account: Account;
  route: Route;
  go: (route: Route) => void;
}) {
  const { state } = useStore();
  // Copies are assignable, so a lesson detail lookup must find copies too.
  const lesson = route.lessonId ? state.lessons.find((l) => l.id === route.lessonId) : undefined;
  if (!lesson) return <EmptyState text="Không tìm thấy bài học." />;
  return <LessonDetail lesson={lesson} account={account} tab={route.tab ?? 'content'} go={go} />;
}

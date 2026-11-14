// Library: Pack list -> topics -> lessons. Lesson detail has three tabs:
// Nội dung / Luyện tập / Game.
import { useState } from 'react';
import type { Account, Lesson } from '../types';
import { QUESTIONS } from '../data/questions';
import { canDo } from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import type { Route } from '../route';
import { LessonPlayer } from './LessonPlayer';
import { QuizRunner } from './QuizRunner';
import { GameView } from './GameView';
import { EmptyState, SectionBand, TopicTag } from './ui';

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
    go({ view: 'studio' });
  };

  return (
    <div>
      <button type="button" className="btn btn-ghost" onClick={() => go({ view: 'library' })}>
        ← Quay lại Thư viện
      </button>
      <div className="lesson-detail-head" style={{ borderTopColor: lesson.color }}>
        <h2>{lesson.title}</h2>
        <div className="tag-row">
          {topics.map((t) => (
            <TopicTag key={t.id} topic={t} />
          ))}
          <span className="muted">{questions.length} câu hỏi</span>
        </div>
        {canDo(account, 'createContent') && !lesson.ownerId ? (
          <button type="button" className="btn btn-secondary" onClick={copyToMySpace}>
            Copy về không gian của tôi
          </button>
        ) : null}
      </div>
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
            canDo(account, 'useTutor')
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
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const pack = REFERENCE.PACK;

  const lesson = route.lessonId
    ? state.lessons.find((l) => l.id === route.lessonId && !l.ownerId)
    : undefined;
  if (route.lessonId) {
    if (!lesson) return <EmptyState text="Không tìm thấy bài học." />;
    return <LessonDetail lesson={lesson} account={account} tab={route.tab ?? 'content'} go={go} />;
  }

  const lessons = pack.lessonIds
    .map((id) => state.lessons.find((l) => l.id === id))
    .filter((l): l is Lesson => Boolean(l))
    .filter((l) => !topicFilter || l.topicIds.includes(topicFilter));

  return (
    <div>
      <SectionBand
        title="Thư viện"
        guide="Chọn một chủ đề, rồi chọn bài học. Mỗi chủ đề có một màu riêng, dùng thống nhất ở mọi nơi."
        color={pack.color}
      />
      <div className="pack-card" style={{ borderTopColor: pack.color }}>
        <div className="pack-title">{pack.title}</div>
        <div className="muted">
          Khối {pack.grade} · Môn {pack.subject} · {pack.lessonIds.length} bài học · {QUESTIONS.length} câu hỏi
        </div>
        <div className="tag-row">
          {pack.topics.map((t) => (
            <button
              key={t.id}
              type="button"
              className={topicFilter === t.id ? 'topic-filter topic-filter-active' : 'topic-filter'}
              style={{ borderColor: t.color, color: t.color }}
              onClick={() => setTopicFilter(topicFilter === t.id ? null : t.id)}
            >
              {t.code} · {t.title}
            </button>
          ))}
        </div>
      </div>
      <div className="lesson-grid">
        {lessons.map((l) => {
          const topics = pack.topics.filter((t) => l.topicIds.includes(t.id));
          return (
            <button
              key={l.id}
              type="button"
              className="lesson-card"
              style={{ borderTopColor: l.color }}
              onClick={() => go({ view: 'lesson', lessonId: l.id, tab: 'content' })}
            >
              <span className="lesson-card-title">{l.title}</span>
              <span className="tag-row">
                {topics.map((t) => (
                  <TopicTag key={t.id} topic={t} />
                ))}
              </span>
              <span className="muted">
                {l.sections.length} phần · {l.questionIds.length} câu hỏi
              </span>
            </button>
          );
        })}
      </div>
      {lessons.length === 0 ? <EmptyState text="Không có bài học nào thuộc chủ đề này." /> : null}
    </div>
  );
}

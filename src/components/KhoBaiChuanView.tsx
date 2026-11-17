// Kho bài chuẩn: standard content (BGD branch) and the public teacher
// marketplace. A standalone sidebar view since 2026-11-16 (moved out of
// Soạn bài at the user's request). Taking a lesson always copies it into
// "Bài của tôi" — the original is never edited directly.
import { useState } from 'react';
import type { Account, Lesson } from '../types';
import { GRADES, SUBJECTS_BY_GRADE, gradesFor, subjectsFor } from '../ai/subjects';
import { QUESTIONS } from '../data/questions';
import { MARKETPLACE_ITEMS } from '../data/seed';
import { REFERENCE, useStore } from '../state/store';
import type { Route } from '../route';
import { LessonPlayer } from './LessonPlayer';
import { AssignSheet } from './StudioShell';
import { EmptyState, SectionBand, TopicTag } from './ui';

export function KhoBaiChuanView({
  account,
  go,
}: {
  account: Account;
  go: (route: Route) => void;
}) {
  const { state, dispatch } = useStore();
  const [khoBranch, setKhoBranch] = useState<'bgd' | 'market'>('bgd');
  const [bgdGrade, setBgdGrade] = useState(() => gradesFor(account.teachingProfile)[0] ?? 5);
  const [bgdSubject, setBgdSubject] = useState(
    () => subjectsFor(account.teachingProfile, gradesFor(account.teachingProfile)[0] ?? 5)[0] ?? 'Toán',
  );
  const [marketPreviewId, setMarketPreviewId] = useState<string | null>(null);
  const [marketNotice, setMarketNotice] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [assignLessonId, setAssignLessonId] = useState<string | null>(null);

  const pack = REFERENCE.PACK;
  const packLessons = pack.lessonIds
    .map((id) => state.lessons.find((l) => l.id === id))
    .filter((l): l is Lesson => Boolean(l))
    .filter((l) => !topicFilter || l.topicIds.includes(topicFilter));
  const assignLesson = assignLessonId
    ? state.lessons.find((l) => l.id === assignLessonId)
    : undefined;

  // Copy into "Bài của tôi" and open the copy there (the studio deep link
  // opens it and shows the confirmation notice).
  const copyToMine = (source: Lesson, extra?: Partial<Lesson>) => {
    const copy = {
      ...JSON.parse(JSON.stringify(source)) as Lesson,
      id: `LC-${Date.now()}`,
      title: `${source.title} (bản của ${account.name})`,
      ownerId: account.id,
      sourceId: source.id,
      ...extra,
    };
    dispatch({ type: 'COPY_TO_MY_SPACE', lesson: copy });
    go({ view: 'studio', lessonId: copy.id });
  };

  // Assign from Kho bài chuẩn: the assignment references the teacher's
  // own copy, never the Pack original (Pack lessons are not database
  // rows, so an assignment pointing at one would violate the foreign
  // key). The persist queue writes the copy before the assignment.
  const assignFromKho = (source: Lesson) => {
    const copy = {
      ...JSON.parse(JSON.stringify(source)) as Lesson,
      id: `LC-${Date.now()}`,
      title: `${source.title} (bản của ${account.name})`,
      ownerId: account.id,
      sourceId: source.id,
    };
    dispatch({ type: 'COPY_TO_MY_SPACE', lesson: copy });
    setAssignLessonId(copy.id);
  };

  return (
    <div>
      <SectionBand
        title="Kho bài chuẩn"
        guide="Nội dung chuẩn do phía EduPro biên soạn theo chương trình của Bộ Giáo dục — và chợ công khai nơi giáo viên chia sẻ, bán bài cho nhau. Lấy bài về thì bài thành bản sao trong Bài của tôi, sửa thoải mái mà không động vào bản gốc."
      />
      {assignLesson ? (
        <AssignSheet
          key={assignLesson.id}
          account={account}
          lesson={assignLesson}
          go={go}
          onBack={() => setAssignLessonId(null)}
        />
      ) : (
        <div>
          <div className="tabs" role="tablist">
            <button
              type="button"
              className={khoBranch === 'bgd' ? 'tab tab-active' : 'tab'}
              onClick={() => setKhoBranch('bgd')}
            >
              Theo chương trình BGD
            </button>
            <button
              type="button"
              className={khoBranch === 'market' ? 'tab tab-active' : 'tab'}
              onClick={() => setKhoBranch('market')}
            >
              Kho user nộp lên (chợ)
            </button>
          </div>
          {khoBranch === 'market' ? (
            <div>
              <p className="guide-text">
                Chợ công khai: giáo viên chia sẻ hoặc bán bài cho nhau, EduPro chỉ thu phí chợ nhỏ. Bài nào
                soạn cùng AI đều được ghi rõ. Bản demo chưa có thanh toán và đăng bán — bài miễn phí thì lấy
                về dùng ngay được.
              </p>
              {marketNotice ? <p className="notice">{marketNotice}</p> : null}
              <div className="lesson-grid">
                {MARKETPLACE_ITEMS.map((item) => {
                  const open = marketPreviewId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="lesson-card"
                      style={{ borderTopColor: item.lesson.color }}
                    >
                      <span className="lesson-card-title">{item.title}</span>
                      <span className="muted">
                        {item.sellerName} · Khối {item.grade} · {item.subject} · Topic {item.topic}
                      </span>
                      <span>{item.description}</span>
                      <span className="tag-row">
                        <span
                          className="topic-tag"
                          style={{ backgroundColor: item.price === 0 ? '#059669' : '#d97706' }}
                        >
                          {item.price === 0 ? 'Miễn phí' : `${item.price.toLocaleString('vi-VN')} đ`}
                        </span>
                        {item.aiAssisted ? (
                          <span className="topic-tag" style={{ backgroundColor: '#475569' }}>
                            Soạn cùng AI
                          </span>
                        ) : null}
                      </span>
                      <span className="row-actions">
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => setMarketPreviewId(open ? null : item.id)}
                        >
                          {open ? 'Đóng xem trước' : 'Xem trước'}
                        </button>
                        {item.price === 0 ? (
                          <button
                            type="button"
                            className="btn btn-small btn-secondary"
                            onClick={() =>
                              copyToMine(item.lesson, {
                                grade: item.grade,
                                subject: item.subject,
                                topic: item.topic,
                              })
                            }
                          >
                            Lấy về Bài của tôi
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            onClick={() =>
                              setMarketNotice(
                                'Bản demo chưa có thanh toán. Bạn có thể xem trước nội dung, còn mua bán thật sẽ mở khi có backend và thanh toán.',
                              )
                            }
                          >
                            Mua — {item.price.toLocaleString('vi-VN')} đ
                          </button>
                        )}
                      </span>
                      {open ? (
                        <div className="repo-item-body">
                          <LessonPlayer lesson={item.lesson} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="field-row">
                <label className="field">
                  <span>Khối</span>
                  <select
                    value={bgdGrade}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setBgdGrade(next);
                      setBgdSubject((SUBJECTS_BY_GRADE[next] ?? [])[0] ?? 'Toán');
                    }}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Khối {g}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Môn</span>
                  <select value={bgdSubject} onChange={(e) => setBgdSubject(e.target.value)}>
                    {(SUBJECTS_BY_GRADE[bgdGrade] ?? []).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {bgdGrade === pack.grade && bgdSubject === pack.subject ? (
                <>
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
                    {packLessons.map((l) => {
                      const topics = pack.topics.filter((t) => l.topicIds.includes(t.id));
                      return (
                        <div key={l.id} className="lesson-card" style={{ borderTopColor: l.color }}>
                          <span className="lesson-card-title">{l.title}</span>
                          <span className="tag-row">
                            {topics.map((t) => (
                              <TopicTag key={t.id} topic={t} />
                            ))}
                          </span>
                          <span className="muted">
                            {l.sections.length} phần · {l.questionIds.length} câu hỏi
                          </span>
                          <span className="row-actions">
                            <button
                              type="button"
                              className="btn btn-small"
                              onClick={() => go({ view: 'lesson', lessonId: l.id, tab: 'content', from: 'kho' })}
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              className="btn btn-small btn-secondary"
                              onClick={() => copyToMine(l)}
                            >
                              Copy về của tôi
                            </button>
                            <button
                              type="button"
                              className="btn btn-small btn-primary"
                              onClick={() => assignFromKho(l)}
                            >
                              Giao bài
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {packLessons.length === 0 ? <EmptyState text="Không có bài học nào thuộc chủ đề này." /> : null}
                </>
              ) : (
                <EmptyState
                  text={`Kho bài chuẩn chưa có nội dung cho Khối ${bgdGrade} · Môn ${bgdSubject}. Nội dung chuẩn do phía EduPro biên soạn theo chương trình của Bộ Giáo dục và được bổ sung dần.`}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

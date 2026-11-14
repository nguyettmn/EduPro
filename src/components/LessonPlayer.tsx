// Lesson player: picture-first, worked example BEFORE the how-to steps.
import type { Lesson } from '../types';
import { FractionBar, LongDivisionView, MathExpr } from './Fraction';
import { SectionBand } from './ui';

export function LessonPlayer({
  lesson,
  onStartPractice,
  onPlayGame,
}: {
  lesson: Lesson;
  onStartPractice?: () => void;
  onPlayGame?: () => void;
}) {
  return (
    <div className="lesson-player">
      <SectionBand title={lesson.title} color={lesson.color} guide="Đọc ví dụ mẫu trước, rồi mới đọc các bước." />
      {lesson.sections.map((section, index) => (
        <section key={section.id} className="lesson-section">
          <div className="lesson-section-head" style={{ backgroundColor: `${lesson.color}1a` }}>
            <span className="lesson-section-num" style={{ backgroundColor: lesson.color }}>
              {index + 1}
            </span>
            <h3>{section.title}</h3>
          </div>
          <div className="example-box">
            <div className="example-label">Ví dụ mẫu</div>
            {section.example.map((line, i) => (
              <div key={i} className="example-line">
                <MathExpr line={line} large />
              </div>
            ))}
            {section.bar ? (
              <div className="example-visual">
                <FractionBar filled={section.bar.filled} total={section.bar.total} color={lesson.color} />
                <span className="example-visual-label">
                  {section.bar.filled} phần trong {section.bar.total} phần
                </span>
              </div>
            ) : null}
            {section.longDivision ? (
              <LongDivisionView
                dividend={section.longDivision.dividend}
                divisor={section.longDivision.divisor}
                result={section.longDivision.result}
                rows={section.longDivision.rows}
              />
            ) : null}
          </div>
          <div className="steps-box">
            <div className="steps-label">Các bước</div>
            <ol className="steps-list">
              {section.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
          {section.tip ? <div className="tip-box">{section.tip}</div> : null}
        </section>
      ))}
      <div className="lesson-actions">
        {onStartPractice ? (
          <button type="button" className="btn btn-primary" onClick={onStartPractice}>
            Làm luyện tập
          </button>
        ) : null}
        {onPlayGame ? (
          <button type="button" className="btn btn-secondary" onClick={onPlayGame}>
            Chơi game bài này
          </button>
        ) : null}
      </div>
    </div>
  );
}

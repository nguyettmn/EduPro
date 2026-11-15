// Small shared UI pieces: section bands, tags, stats, date formatting.
import type { Topic } from '../types';

/** Big, bold section title on a tinted band; guide text smaller and greyer. */
export function SectionBand({
  title,
  guide,
  color,
}: {
  title: string;
  guide?: string;
  color?: string;
}) {
  return (
    <div className="section-band" style={color ? { backgroundColor: `${color}1a` } : undefined}>
      <h2 className="section-band-title">{title}</h2>
      {guide ? <p className="section-band-guide">{guide}</p> : null}
    </div>
  );
}

export function TopicTag({ topic }: { topic: Topic }) {
  return (
    <span className="topic-tag" style={{ backgroundColor: topic.color }}>
      {topic.code} · {topic.title}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export function StatCard({
  label,
  value,
  sub,
  color,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  /** When provided, the card renders as a button that navigates. */
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className="stat-card stat-card-btn"
        style={color ? { borderTopColor: color } : undefined}
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="stat-card" style={color ? { borderTopColor: color } : undefined}>
      {inner}
    </div>
  );
}

/** Format an ISO date without slashes: "ngày 16 tháng 11 năm 2026". */
export function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** Today's date in Vietnamese, e.g. "Thứ bảy, ngày 15 tháng 11 năm 2025". */
export function todayLabel(): string {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${WEEKDAYS[d.getDay()]}, ${formatDate(iso)}`;
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${isoDate}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function dueLabel(isoDate: string): string {
  const left = daysUntil(isoDate);
  if (left < 0) return `Quá hạn ${-left} ngày`;
  if (left === 0) return 'Hết hạn hôm nay';
  if (left === 1) return 'Còn 1 ngày';
  return `Còn ${left} ngày`;
}

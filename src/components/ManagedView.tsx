// Trong phạm vi quản lý: the lesson copies of the people this account
// manages. View and copy only — a manager never edits someone else's
// original directly. A standalone sidebar view since 2026-11-16 (moved
// out of Soạn bài at the user's request).
import { useState } from 'react';
import type { Account, Lesson } from '../types';
import { managedAccounts } from '../permissions';
import { useStore } from '../state/store';
import type { Route } from '../route';
import { LessonPlayer } from './LessonPlayer';
import { HtmlLessonPlayer } from './HtmlLessonPlayer';
import { EmptyState, SectionBand } from './ui';

export function ManagedView({
  account,
  go,
}: {
  account: Account;
  go: (route: Route) => void;
}) {
  const { state, dispatch } = useStore();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const managed = managedAccounts(account, state.accounts);
  const managedCopies = state.lessons.filter(
    (l) => l.ownerId && managed.some((a) => a.id === l.ownerId),
  );

  // Copy into "Bài của tôi" and open the copy there (the studio deep link
  // opens it and shows the confirmation notice).
  const copyToMine = (source: Lesson) => {
    const copy = {
      ...JSON.parse(JSON.stringify(source)) as Lesson,
      id: `LC-${Date.now()}`,
      title: `${source.title} (bản của ${account.name})`,
      ownerId: account.id,
      sourceId: source.id,
    };
    dispatch({ type: 'COPY_TO_MY_SPACE', lesson: copy });
    go({ view: 'studio', lessonId: copy.id });
  };

  return (
    <div>
      <SectionBand
        title="Trong phạm vi quản lý"
        guide="Đây là bản sao của những người bạn quản lý. Bạn chỉ xem và copy về không gian của mình, không sửa trực tiếp bản của họ."
      />
      {managedCopies.length === 0 ? (
        <EmptyState text="Không có bản sao nào trong phạm vi quản lý của bạn." />
      ) : (
        managedCopies.map((l) => {
          const owner = state.accounts.find((a) => a.id === l.ownerId);
          const open = previewId === l.id;
          return (
            <div key={l.id} className="repo-item">
              <button type="button" className="repo-item-head" onClick={() => setPreviewId(open ? null : l.id)}>
                <span>
                  <strong>{l.title}</strong>
                </span>
                <span className="muted">Của {owner?.name ?? 'Không rõ'}</span>
              </button>
              {open ? (
                <div className="repo-item-body">
                  {l.html ? (
                    <HtmlLessonPlayer html={l.html} title={l.title} />
                  ) : (
                    <LessonPlayer lesson={l} />
                  )}
                  <button type="button" className="btn btn-secondary" onClick={() => copyToMine(l)}>
                    Copy về không gian của tôi
                  </button>
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

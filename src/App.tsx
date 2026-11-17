// App composition: Supabase auth gate, shell, and state-based view
// routing. Every route passes through the permission table before
// rendering.
import { useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { canDo, canView, canViewTutorSummary, getNavItems, spaceNameFor } from './permissions';
import type { Route } from './route';
import { AuthView, SetPasswordView } from './components/AuthView';
import { Shell } from './components/Shell';
import { Dashboard } from './components/Dashboard';
import { ClassView } from './components/ClassView';
import { LibraryView } from './components/LibraryView';
import { SpaceView } from './components/SpaceView';
import { RepoView } from './components/RepoView';
import { StudioShell } from './components/StudioShell';
import { KhoBaiChuanView } from './components/KhoBaiChuanView';
import { ManagedView } from './components/ManagedView';
import { TutorSpace } from './components/TutorSpace';
import { GameStudio } from './components/GameStudio';
import { ManageViews, SettingsView } from './components/ManageViews';
import { EmptyState } from './components/ui';

function SetupCard() {
  return (
    <div className="picker-page">
      <div className="picker-card">
        <div className="picker-logo">EduPro</div>
        <h1 className="picker-title">Chưa nối được với Supabase</h1>
        <p className="picker-guide">
          App chưa thấy địa chỉ và key của project Supabase. Hãy thêm hai biến môi trường
          VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào Vercel rồi Redeploy, sau đó tải lại trang này.
        </p>
      </div>
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="picker-page">
      <div className="picker-card">
        <div className="picker-logo">EduPro</div>
        <p className="picker-guide">{text}</p>
      </div>
    </div>
  );
}

function AppInner() {
  const { state, currentAccount, auth } = useStore();
  const [route, setRoute] = useState<Route>({ view: 'dashboard' });

  if (auth.status === 'no-config') {
    return <SetupCard />;
  }
  if (auth.status === 'loading') {
    return <LoadingCard text="Đang tải dữ liệu…" />;
  }
  if (!auth.session) {
    return <AuthView />;
  }
  if (auth.needsPassword) {
    return <SetPasswordView onDone={auth.clearNeedsPassword} />;
  }
  if (!currentAccount) {
    if (auth.loadError) {
      return (
        <div className="picker-page">
          <div className="picker-card">
            <div className="picker-logo">EduPro</div>
            <h1 className="picker-title">Không tải được hồ sơ của bạn</h1>
            <p className="picker-guide">{auth.loadError}</p>
            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={auth.refresh}>
                Thử lại
              </button>
              <button type="button" className="btn btn-ghost" onClick={auth.signOut}>
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <LoadingCard text="Đang tải hồ sơ của bạn…" />;
  }

  const go = (next: Route) => setRoute(next);

  // Permission guard: the route must be in the role's view list, except that
  // a manager may open a student's Tutor Space route to see the summary.
  let allowed = canView(currentAccount.role, route.view);
  if (!allowed && route.view === 'tutor' && route.studentId) {
    const student = state.accounts.find((a) => a.id === route.studentId);
    allowed = Boolean(student) && canViewTutorSummary(currentAccount, student!, state.accounts);
  }

  const isStudent = canDo(currentAccount, 'useTutor');
  const spaceName = isStudent
    ? spaceNameFor(currentAccount, state.classes, state.spaceNames)
    : undefined;
  const activeView =
    route.view === 'lesson'
      ? (route.from ?? (isStudent ? 'assignments' : 'studio'))
      : route.view === 'gamestudio'
        ? (route.from ?? 'studio')
        : route.view;

  return (
    <Shell
      account={currentAccount}
      navItems={getNavItems(currentAccount, spaceName)}
      activeView={activeView}
      onNavigate={(view) => setRoute({ view })}
      onLogout={auth.signOut}
    >
      {currentAccount.status === 'pending' ? (
        <p className="notice">
          {currentAccount.role === 'student'
            ? 'Tài khoản của em đang chờ được xếp vào lớp. Trong lúc chờ, em vẫn dùng được Tutor Space.'
            : 'Tài khoản của bạn đang chờ hiệu trưởng duyệt. Trong lúc chờ, bạn vẫn soạn bài, tạo game và dạy lớp riêng bình thường — nội dung của trường sẽ hiện ra sau khi được duyệt.'}
        </p>
      ) : null}
      {auth.syncError ? (
        <p className="notice">
          Có thay đổi chưa lưu được: {auth.syncError}{' '}
          <button type="button" className="btn btn-small btn-secondary" onClick={auth.refresh}>
            Tải lại dữ liệu
          </button>{' '}
          <button type="button" className="btn btn-small btn-ghost" onClick={auth.clearSyncError}>
            Bỏ qua
          </button>
        </p>
      ) : null}
      {!allowed ? (
        <EmptyState text="Bạn không có quyền xem trang này với vai trò hiện tại." />
      ) : route.view === 'dashboard' ? (
        <Dashboard account={currentAccount} go={go} />
      ) : route.view === 'classes' ? (
        <ClassView account={currentAccount} route={route} go={go} />
      ) : route.view === 'lesson' ? (
        <LibraryView account={currentAccount} route={route} go={go} />
      ) : route.view === 'assignments' ? (
        <SpaceView account={currentAccount} route={route} go={go} />
      ) : route.view === 'repo' ? (
        <RepoView account={currentAccount} />
      ) : route.view === 'studio' ? (
        <StudioShell account={currentAccount} route={route} go={go} />
      ) : route.view === 'kho' ? (
        <KhoBaiChuanView account={currentAccount} go={go} />
      ) : route.view === 'managed' ? (
        <ManagedView account={currentAccount} go={go} />
      ) : route.view === 'tutor' ? (
        <TutorSpace account={currentAccount} route={route} go={go} />
      ) : route.view === 'gamestudio' ? (
        <GameStudio account={currentAccount} route={route} go={go} />
      ) : route.view === 'manage' ? (
        <ManageViews account={currentAccount} />
      ) : (
        <SettingsView account={currentAccount} />
      )}
    </Shell>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}

// App composition: mock-login gate, shell, and state-based view routing.
// Every route passes through the permission table before rendering.
import { useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { canDo, canView, canViewTutorSummary, getNavItems, spaceNameFor } from './permissions';
import type { Route } from './route';
import { AccountPicker } from './components/AccountPicker';
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

function AppInner() {
  const { state, dispatch, currentAccount } = useStore();
  const [route, setRoute] = useState<Route>({ view: 'dashboard' });

  if (!currentAccount) {
    return (
      <AccountPicker
        accounts={state.accounts}
        onPick={(accountId) => {
          dispatch({ type: 'SWITCH_ACCOUNT', accountId });
          setRoute({ view: 'dashboard' });
        }}
      />
    );
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
      accounts={state.accounts}
      navItems={getNavItems(currentAccount, spaceName)}
      activeView={activeView}
      onNavigate={(view) => setRoute({ view })}
      onSwitchAccount={(accountId) => {
        dispatch({ type: 'SWITCH_ACCOUNT', accountId });
        setRoute({ view: 'dashboard' });
      }}
      onLogout={() => dispatch({ type: 'LOGOUT' })}
    >
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

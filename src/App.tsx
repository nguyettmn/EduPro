// App composition: mock-login gate, shell, and state-based view routing.
// Every route passes through the permission table before rendering.
import { useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { canView, canViewTutorSummary, getNavItems } from './permissions';
import type { Route } from './route';
import { AccountPicker } from './components/AccountPicker';
import { Shell } from './components/Shell';
import { Dashboard } from './components/Dashboard';
import { LibraryView } from './components/LibraryView';
import { AssignmentsView } from './components/AssignmentsView';
import { RepoView } from './components/RepoView';
import { StudioShell } from './components/StudioShell';
import { TutorSpace } from './components/TutorSpace';
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

  const activeView = route.view === 'lesson' ? 'library' : route.view;

  return (
    <Shell
      account={currentAccount}
      accounts={state.accounts}
      navItems={getNavItems(currentAccount.role)}
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
      ) : route.view === 'library' || route.view === 'lesson' ? (
        <LibraryView account={currentAccount} route={route} go={go} />
      ) : route.view === 'assignments' ? (
        <AssignmentsView account={currentAccount} route={route} go={go} />
      ) : route.view === 'repo' ? (
        <RepoView account={currentAccount} />
      ) : route.view === 'studio' ? (
        <StudioShell account={currentAccount} />
      ) : route.view === 'tutor' ? (
        <TutorSpace account={currentAccount} route={route} go={go} />
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

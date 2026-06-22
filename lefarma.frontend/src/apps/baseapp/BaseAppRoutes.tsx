import { Routes, Route } from 'react-router-dom';
import { RequireAuth } from '@/shared/auth/RequireAuth';
import { ShellLayout } from './ShellLayout';
import { Home } from './Home';
import { Profile } from './Profile';

/**
 * Route tree for the `/CxP/` base-app shell (app-routing spec: "App Subtree
 * Mounting" + base-app spec).
 *
 * Routes are RELATIVE to the router basename (`/CxP/`), which React Router
 * composes automatically. So `/` matches `/CxP/` and `/perfil` matches
 * `/CxP/perfil`.
 *
 * Every shell surface is wrapped in `RequireAuth` (redirects unauthenticated
 * sessions to the root login) and `ShellLayout` (primary nav + content region).
 * Administration UI is intentionally absent (base-app spec: "Excludes
 * Administration UI").
 */
export function BaseAppRoutes() {
  return (
    <RequireAuth>
      <ShellLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/perfil" element={<Profile />} />
        </Routes>
      </ShellLayout>
    </RequireAuth>
  );
}

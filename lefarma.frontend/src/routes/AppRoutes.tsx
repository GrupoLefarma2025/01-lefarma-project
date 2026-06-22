import { Routes } from 'react-router-dom';
import { GastosRoutes } from '@/apps/gastos/GastosRoutes';

/**
 * Root route tree (gastos-migration PR1).
 *
 * The full Gastos route table now lives in <GastosRoutes/> (relative paths,
 * shared with the future /CxP/gastos/ subtree). The root mount inlines that
 * Fragment as the children of <Routes>; React Router flattens the Fragment and
 * treats each <Route> as a top-level entry, so every historical root URL still
 * resolves identically (gastos-app spec: "Root build unchanged"). The RED
 * parity tests in src/test/gastos-routes.test.tsx lock that behavior.
 *
 * NOTE: GastosRoutes is invoked as a FUNCTION CALL — not as JSX `<GastosRoutes/>`
 * — because React Router's createRoutesFromChildren asserts every direct child
 * of <Routes> is a <Route> or <Fragment>; a component element would be rejected.
 */
export const AppRoutes = () => {
  return <Routes>{GastosRoutes({ variant: 'root' })}</Routes>;
};

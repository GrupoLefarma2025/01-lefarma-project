import { Navigate, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/LandingRoute';
import { SigmaLayout } from './SigmaLayout';

// Páginas de SIGMA (las implementa el módulo de pantallas). Todas deben tener
// `export default`; el nombre del componente es libre.
import EntradaSigma from '@/apps/sigma/routes/entrada';
import Home from '@/apps/sigma/routes/home';
import SubidaDocumentos from '@/apps/sigma/routes/subida-documentos';
import Bandeja from '@/apps/sigma/routes/bandeja';
import DocumentosFlujo from '@/apps/sigma/routes/documentos.flujo';
import BandejaAutorizadosRechazados from '@/apps/sigma/routes/bandeja.autorizados-rechazados';
import ValidarFirma from '@/apps/sigma/routes/validar-firma';
import AccesoExterno from '@/apps/sigma/routes/acceso-externo';

/**
 * Props del módulo de rutas de SIGMA. Mismo shape que los demás módulos de
 * rutas de app (root/subtree) para poder montarse de forma uniforme.
 */
export interface SigmaRoutesProps {
  variant: 'root' | 'subtree';
  loginPath?: string;
}

/**
 * Rutas de SIGMA, relativas al prefijo `/SIGMA` (el shell las monta bajo
 * `path="sigma"`). Se invocan como llamada de función —
 * `{SigmaRoutes({ variant: 'subtree', loginPath: '/login' })}` — porque React
 * Router rechaza hijos que no sean `<Route>` dentro de `<Routes>`.
 *
 * `variant` se conserva por simetría con los demás módulos. SIGMA no usa el
 * login global de Lefarma: su pantalla de acceso es la ruta índice `/SIGMA`,
 * así que el guard de sesión manda ahí (y no a `loginPath`) para que el
 * usuario vea la tarjeta de SIGMA con sus dos opciones: cuenta corporativa o
 * acceso externo.
 */
export function SigmaRoutes({ loginPath }: SigmaRoutesProps) {
  // Sin sesión, cualquier ruta protegida vuelve a la entrada del módulo. Sólo
  // se respeta `loginPath` si ya apunta dentro de SIGMA (los shells lo pasan
  // como `/login`, el login global de Lefarma, que aquí no aplica).
  const unauthRedirect =
    loginPath && loginPath.startsWith('/SIGMA') ? loginPath : '/SIGMA';

  return (
    <>
      {/*
        Boundary de tema: TODAS las rutas del módulo viven bajo `.sigma-theme`,
        incluidas las públicas. Antes `acceso-externo` y `validar-firma`
        quedaban fuera y heredaban los tokens azules de Lefarma (sidebar azul
        marino, botones azules). El guard de sesión sólo envuelve las rutas
        protegidas y las páginas siguen montando su propio sidebar: aquí no se
        duplica layout.
      */}
      <Route element={<SigmaLayout />}>
        {/* Públicas (sin sesión) */}
        <Route index element={<EntradaSigma />} />
        <Route path="acceso-externo" element={<AccesoExterno />} />
        <Route path="documentos/validar-firma" element={<ValidarFirma />} />

        {/* Protegidas: guard de sesión (el marco visual ya está arriba) */}
        <Route element={<ProtectedRoute unauthRedirect={unauthRedirect} />}>
          <Route path="home" element={<Home />} />
          <Route path="documentos/subir-pdf" element={<SubidaDocumentos />} />
          <Route path="documentos/bandeja-firmas" element={<Bandeja />} />
          <Route path="documentos/flujo" element={<DocumentosFlujo />} />
          <Route
            path="documentos/autorizados-rechazados"
            element={<BandejaAutorizadosRechazados />}
          />
        </Route>
      </Route>

      {/*
        Fallback: cualquier subruta desconocida vuelve a la entrada del módulo
        (`/SIGMA`). Es más coherente que saltar directo a `home`: sin sesión el
        usuario ve la tarjeta de entrada (login o visitante) en vez del login
        genérico, y con sesión `EntradaSigma` redirige a `home`. Se usa ruta
        absoluta porque este módulo siempre se monta bajo `/SIGMA`.
      */}
      <Route path="*" element={<Navigate to="/SIGMA" replace />} />
    </>
  );
}

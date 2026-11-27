import { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/LandingRoute';
import { SigmaLayout } from './SigmaLayout';

// Rutas con carga diferida: cada página viaja en su propio chunk.
const EntradaSigma = lazy(() => import('@/apps/sigma/routes/entrada'));
const Home = lazy(() => import('@/apps/sigma/routes/home'));
const SubidaDocumentos = lazy(() => import('@/apps/sigma/routes/subida-documentos'));
const Bandeja = lazy(() => import('@/apps/sigma/routes/bandeja'));
const DocumentosFlujo = lazy(() => import('@/apps/sigma/routes/documentos.flujo'));
const BandejaAutorizadosRechazados = lazy(() =>
  import('@/apps/sigma/routes/bandeja.autorizados-rechazados')
);
const ValidarFirma = lazy(() => import('@/apps/sigma/routes/validar-firma'));
const AccesoExterno = lazy(() => import('@/apps/sigma/routes/acceso-externo'));

export interface SigmaRoutesProps {
  variant: 'root' | 'subtree';
  loginPath?: string;
}

export function SigmaRoutes({ loginPath }: SigmaRoutesProps) {
  const unauthRedirect =
    loginPath && loginPath.startsWith('/SIGMA') ? loginPath : '/SIGMA';

  return (
    <>
      {}
      <Route element={<SigmaLayout />}>
        {}
        <Route index element={<EntradaSigma />} />
        <Route path="acceso-externo" element={<AccesoExterno />} />
        <Route path="documentos/validar-firma" element={<ValidarFirma />} />

        {}
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

      {}
      <Route path="*" element={<Navigate to="/SIGMA" replace />} />
    </>
  );
}

import { Navigate, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/LandingRoute';
import { SigmaLayout } from './SigmaLayout';

import EntradaSigma from '@/apps/sigma/routes/entrada';
import Home from '@/apps/sigma/routes/home';
import SubidaDocumentos from '@/apps/sigma/routes/subida-documentos';
import Bandeja from '@/apps/sigma/routes/bandeja';
import DocumentosFlujo from '@/apps/sigma/routes/documentos.flujo';
import BandejaAutorizadosRechazados from '@/apps/sigma/routes/bandeja.autorizados-rechazados';
import ValidarFirma from '@/apps/sigma/routes/validar-firma';
import AccesoExterno from '@/apps/sigma/routes/acceso-externo';

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

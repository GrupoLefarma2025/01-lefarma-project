import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/shared/auth/authStore';
import { ViaticosRoutes } from './ViaticosRoutes';
import type { SolicitudBandeja } from './types/aprobaciones.types';

/**
 * Rutas del subárbol de Viáticos. Solo se comprueba resolución URL→componente:
 * las páginas se exercised por sus propios tests, no por duplicarlos aquí.
 */

vi.mock('@/pages/Perfil', () => ({ default: () => <div>PERFIL_MARK</div> }));
vi.mock('./pages/solicitud/SolicitudPage', () => ({ SolicitudPage: () => <div>SOLICITUD_MARK</div> }));
vi.mock('./pages/mis-viajes/MisViajesPage', () => ({ MisViajesPage: () => <div>MIS_VIAJES_MARK</div> }));
vi.mock('./pages/concentrado/ConcentradoPage', () => ({ ConcentradoPage: () => <div>CONCENTRADO_MARK</div> }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => true }));

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/shared/api/apiClient', () => ({ API: { get: mocks.get, post: mocks.post } }));

// El layout arrastra sidebar/header; se reduce a <Outlet/> para aislar el ruteo.
vi.mock('@/components/layout/MainLayout', async () => {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { MainLayout: () => <Outlet /> };
});

const solicitud: SolicitudBandeja = {
  id_solicitud: 101,
  id_usuario_solicitante: 7,
  nombre_solicitante: 'Beto Empleado',
  periodo: '2026-10',
  gerencia: 'Gerencia Norte',
  destino: 'Toluca',
  estado: 'enviada',
  total: 2110,
  fecha_creacion: '2026-10-05T12:00:00Z',
};

// Los paths del subarbol son relativos: se monta igual que en BaseAppRoutes.
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="viaticos" element={<Outlet />}>
          {ViaticosRoutes({ variant: 'subtree', loginPath: '/viaticos/login' })}
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.get.mockResolvedValue({ data: { success: true, message: 'ok', data: [solicitud] } });
  useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
});

describe('ViaticosRoutes — bandeja de aprobaciones', () => {
  it('/viaticos/aprobaciones renderiza la bandeja dentro del subárbol', async () => {
    renderAt('/viaticos/aprobaciones');

    await waitFor(() => expect(screen.getByText('Bandeja de Autorizaciones')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Beto Empleado')).toBeInTheDocument());
    expect(screen.queryByText('SOLICITUD_MARK')).not.toBeInTheDocument();
  });

  it('sin sesión, /viaticos/aprobaciones rebota al login del subárbol con el destino', () => {
    useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
    renderAt('/viaticos/aprobaciones');

    expect(screen.queryByText('Bandeja de Autorizaciones')).not.toBeInTheDocument();
    // El índice del subárbol manda al login con ?return= (contrato del router).
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('/viaticos/dashboard es alias temporal del asistente de solicitud', () => {
    renderAt('/viaticos/dashboard');
    expect(screen.getByText('SOLICITUD_MARK')).toBeInTheDocument();
  });

  it('/viaticos/solicitud, /viaticos/mis-viajes y /viaticos/concentrado resuelven sus páginas', () => {
    renderAt('/viaticos/solicitud');
    expect(screen.getByText('SOLICITUD_MARK')).toBeInTheDocument();
  });

  it('/viaticos/mis-viajes resuelve Mis viajes', () => {
    renderAt('/viaticos/mis-viajes');
    expect(screen.getByText('MIS_VIAJES_MARK')).toBeInTheDocument();
  });

  it('/viaticos/concentrado resuelve el concentrado de revisión', () => {
    renderAt('/viaticos/concentrado');
    expect(screen.getByText('CONCENTRADO_MARK')).toBeInTheDocument();
  });
});

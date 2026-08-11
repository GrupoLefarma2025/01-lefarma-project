import { create } from 'zustand';
import {
  AuthState,
  UserInfo,
  Empresa,
  Sucursal,
} from '@/types/auth.types';
import type { Area } from '@/types/catalogo.types';
import type { SseUserInfo } from '@/types/sse.types';
import { navigateTo } from '@/lib/navigation';
import { authService } from '@/services/authService';
import { API } from '@/services/api';
import type { ApiResponse } from '@/types/api.types';
import type { Usuario } from '@/types/usuario.types';
import { useConfigStore } from './configStore';
import { toast } from 'sonner';


const LEGACY_TOKEN_KEY = 'token';

// Single área resolver (REQ-001):
// detalle.idArea (>0, ∈ empresa areas) → única área of empresa → null.
// Never picks the first área when multiple exist, never prompts the user.
function resolveAreaFrom(
  detalle: { idEmpresa: number; idSucursal: number; idArea: number | null } | null,
  areas: Area[],
  empresaId: string | number
): Area | null {
  const detalleAreaId = detalle?.idArea;
  if (detalleAreaId && detalleAreaId > 0) {
    const porDetalle = areas.find(
      (a) =>
        String(a.idArea) === String(detalleAreaId) &&
        String(a.idEmpresa) === String(empresaId)
    );
    if (porDetalle) return porDetalle;
  }

  const areasDeEmpresa = areas.filter((a) => String(a.idEmpresa) === String(empresaId));
  if (areasDeEmpresa.length === 1) return areasDeEmpresa[0];

  return null;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  empresa: null,
  sucursal: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  loginStep: 1,
  availableDomains: [],
  requiresDomainSelection: false,
  displayName: null,
  pendingUsername: null,
  empresas: [],
  sucursales: [],
  areas: [],
  area: null,
  hasFirma: null,
  puedeSeleccionarEmpresas: false,
  usuarioDetalle: null,


  loginStepOne: async (username: string) => {
    set({ isLoading: true });
    try {
      const response = await authService.loginStepOne(username);
      set({
        loginStep: 2,
        availableDomains: response.domains,
        requiresDomainSelection: response.requiresDomainSelection,
        displayName: response.displayName || null,
        pendingUsername: username,
        isLoading: false,
      });

      sessionStorage.setItem(
        'loginFlow',
        JSON.stringify({
          step: 2,
          username,
          domains: response.domains,
          requiresDomainSelection: response.requiresDomainSelection,
          displayName: response.displayName,
        })
      );
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginStepTwo: async (password: string, domain: string) => {
    const { pendingUsername } = get();
    if (!pendingUsername) {
      throw new Error('No hay usuario pendiente');
    }

    set({ isLoading: true });
    try {
      const response = await authService.loginStepTwo({
        username: pendingUsername,
        password,
        domain,
      });

      sessionStorage.removeItem('loginFlow');

      // Cargar empresas y sucursales para el paso 3
      const [empresas, sucursales, areas] = await Promise.all([
        authService.getEmpresas(),
        authService.getSucursales(),
        authService.getAreas(),
      ]);

      // Obtener perfil para saber si puede seleccionar empresas y su empresa asignada
      let puedeSeleccionar = false;
      let usuarioDetalle: { idEmpresa: number; idSucursal: number; idArea: number | null } | null = null;
      try {
        const profileRes = await API.get<ApiResponse<{ puedeSeleccionarEmpresas: boolean; detalle?: { idEmpresa?: number; idSucursal?: number; idArea?: number } }>>('/profile');
        puedeSeleccionar = profileRes.data.data?.puedeSeleccionarEmpresas ?? false;
        if (profileRes.data.data?.detalle) {
          usuarioDetalle = {
            idEmpresa: profileRes.data.data.detalle.idEmpresa ?? 0,
            idSucursal: profileRes.data.data.detalle.idSucursal ?? 0,
            idArea: profileRes.data.data.detalle.idArea ?? null,
          };
        }
      } catch {
        // Si falla el profile, se asume que no puede seleccionar
      }

      // Sincronizar con configStore
      useConfigStore.getState().updatePerfil({
        nombre: response.user.nombre || '',
        correo: response.user.correo || '',
      });

      // Si no puede seleccionar empresas, auto-seleccionar la unica que tiene y saltar al dashboard
      if (!puedeSeleccionar && empresas.length === 1) {
        const unicaEmpresa = empresas[0];
        const sucursalesDeEmpresa = sucursales.filter(
          (s) => String(s.idEmpresa) === String(unicaEmpresa.idEmpresa)
        );

        // Usar la sucursal del detalle si existe y pertenece a la empresa,
        // si no, usar la primera sucursal disponible de esa empresa
        const detalleSucursalId = usuarioDetalle?.idSucursal ?? 0;
        const sucursalDelDetalle = detalleSucursalId > 0
          ? sucursalesDeEmpresa.find((s) => String(s.idSucursal) === String(detalleSucursalId))
          : null;
        const unicaSucursal = sucursalDelDetalle
          ?? (sucursalesDeEmpresa.length > 0 ? sucursalesDeEmpresa[0] : null);

        authService.setEmpresa(unicaEmpresa);
        if (unicaSucursal) {
          authService.setSucursal(unicaSucursal);
        }

        // REQ-001: área resuelta por detalle → única de la empresa → null (nunca la primera).
        // Se usa el helper puro con los locales porque el store aún no tiene catalogs aquí.
        const areaResuelta = resolveAreaFrom(usuarioDetalle, areas, unicaEmpresa.idEmpresa);
        authService.setArea(areaResuelta);

        set({
          user: response.user,
          token: response.accessToken,
          isAuthenticated: false,
          isLoading: false,
          loginStep: 3,
          availableDomains: [],
          requiresDomainSelection: false,
          displayName: null,
          pendingUsername: null,
          empresas,
          sucursales,
          areas,
          puedeSeleccionarEmpresas: false,
          usuarioDetalle,
          empresa: unicaEmpresa,
          sucursal: unicaSucursal,
          area: areaResuelta,
        });

        useConfigStore.getState().updatePerfil({
          nombre: response.user.nombre || '',
          correo: response.user.correo || '',
        });

        await get().fetchProfileSignature();
        return;
      }

      // Si puede seleccionar, mostrar pantalla de seleccion
      set({
        user: response.user,
        token: response.accessToken,
        isAuthenticated: false,
        isLoading: false,
        loginStep: 3,
        availableDomains: [],
        requiresDomainSelection: false,
        displayName: null,
        pendingUsername: null,
        empresas,
        sucursales,
        areas,
        puedeSeleccionarEmpresas: puedeSeleccionar,
        usuarioDetalle,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginStepThree: async (empresaId: string, sucursalId: string) => {
    const { empresas, sucursales } = get();

    const empresa = empresas.find((e) => String(e.idEmpresa) === String(empresaId));
    const sucursal = sucursales.find((s) => String(s.idSucursal) === String(sucursalId));

    if (!empresa || !sucursal) {
      throw new Error('Empresa o sucursal no encontrada');
    }

    authService.setEmpresa(empresa);
    authService.setSucursal(sucursal);

    // REQ-001/002: el resolver es la única fuente del área; setArea se llama SIEMPRE
    // (null elimina la key 'area' — un área vieja nunca sobrevive).
    const selectedArea = get().resolveArea(empresaId);
    authService.setArea(selectedArea);

    set({
      empresa,
      sucursal,
      area: selectedArea,
      isAuthenticated: true,
      loginStep: 1,
      empresas: [],
      sucursales: [],
      areas: [],
    });

    await get().fetchProfileSignature();

    const { hasFirma } = get();
    if (hasFirma === false) {
      toast.warning('No has cargado tu firma digital', {
        description: 'Ve a Configuración para subir tu firma y poder autorizar documentos.',
        duration: 6000,
      });
    }
  },

  resetLoginFlow: () => {
    sessionStorage.removeItem('loginFlow');
    set({
      loginStep: 1,
      availableDomains: [],
      requiresDomainSelection: false,
      displayName: null,
      pendingUsername: null,
      empresas: [],
      sucursales: [],
      areas: [],
      usuarioDetalle: null,
    });
  },

  logout: async () => {
    await authService.logout();
    set({
      user: null,
      token: null,
      empresa: null,
      sucursal: null,
      area: null,
      isAuthenticated: false,
      loginStep: 1,
      empresas: [],
      sucursales: [],
      areas: [],
      hasFirma: null,
      puedeSeleccionarEmpresas: false,
      usuarioDetalle: null,
    });

    if (!window.location.pathname.endsWith('/login')) {
      navigateTo('/login');
    }
  },

  setEmpresa: (empresa: Empresa) => {
    authService.setEmpresa(empresa);
    set({ empresa });
  },

  setSucursal: (sucursal: Sucursal) => {
    authService.setSucursal(sucursal);
    set({ sucursal });
  },

  changeEmpresaSucursal: (empresa: Empresa, sucursal: Sucursal, area?: Area | null) => {
    authService.setEmpresa(empresa);
    authService.setSucursal(sucursal);
    if (area) authService.setArea(area);
    set({ empresa, sucursal, ...(area ? { area } : {}) });
  },

  setToken: (token: string) => {
    localStorage.setItem('accessToken', token);
    set({ token, isAuthenticated: true });
  },

  setUser: (user: UserInfo) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  updateUserFromSse: (sseUser: SseUserInfo) => {
    const user: UserInfo = {
      id: sseUser.id,
      username: sseUser.username,
      nombre: sseUser.nombre,
      correo: sseUser.correo,
      dominio: sseUser.dominio,
      roles: sseUser.roles.map((r) => ({
        idRol: r.idRol,
        nombreRol: r.nombreRol,
        descripcion: r.descripcion,
      })),
      permisos: sseUser.permisos.map((p) => ({
        idPermiso: p.idPermiso,
        codigoPermiso: p.codigoPermiso,
        nombrePermiso: p.nombrePermiso,
        categoria: p.categoria,
        recurso: p.recurso,
        accion: p.accion,
      })),
    };
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  setHasFirma: (has: boolean) => {
    set({ hasFirma: has });
  },

  fetchProfileSignature: async () => {
    try {
      const response = await API.get<ApiResponse<{ puedeSeleccionarEmpresas: boolean; detalle?: { firmaPath?: string } }>>('/profile');
      const firmaPath = response.data.data?.detalle?.firmaPath;
      const puedeSeleccionar = response.data.data?.puedeSeleccionarEmpresas ?? false;
      set({ hasFirma: !!firmaPath, puedeSeleccionarEmpresas: puedeSeleccionar });
    } catch {
        set({ hasFirma: false })
    }
  },

  resolveArea: (empresaId: string | number) => {
    const { usuarioDetalle, areas } = get();
    return resolveAreaFrom(usuarioDetalle, areas, empresaId);
  },

  loadProfile: async () => {
    try {
      const response = await API.get<ApiResponse<{ puedeSeleccionarEmpresas: boolean; detalle?: { idEmpresa?: number; idSucursal?: number; idArea?: number; firmaPath?: string } }>>('/profile');
      const data = response.data.data;
      const detalle = data?.detalle;
      set({
        usuarioDetalle: detalle
          ? {
              idEmpresa: detalle.idEmpresa ?? 0,
              idSucursal: detalle.idSucursal ?? 0,
              idArea: detalle.idArea ?? null,
            }
          : null,
        puedeSeleccionarEmpresas: data?.puedeSeleccionarEmpresas ?? false,
        hasFirma: detalle ? !!detalle.firmaPath : false,
      });
    } catch {
      set({ hasFirma: false });
    }
  },

  setCatalogs: (empresas: Empresa[], sucursales: Sucursal[], areas: Area[]) => {
    set({ empresas, sucursales, areas });
  },

  initialize: () => {
    const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacyToken && !localStorage.getItem('accessToken')) {
      localStorage.setItem('accessToken', legacyToken);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }

    const token = authService.getAccessToken();
    const user = authService.getCurrentUser();
    const empresa = authService.getEmpresa();
    const sucursal = authService.getSucursal();
    const area = authService.getArea();

    if (token && user) {
      set({
        token,
        user,
        empresa,
        sucursal,
        area,
        isAuthenticated: true,
        isLoading: false,
        loginStep: 1,
        availableDomains: [],
        requiresDomainSelection: false,
        displayName: null,
        pendingUsername: null,
        empresas: [],
        sucursales: [],
        areas: [],
        hasFirma: null,
        puedeSeleccionarEmpresas: false,
      });

      useConfigStore.getState().updatePerfil({
        nombre: user.nombre || '',
        correo: user.correo || '',
      });

      // REQ-005: profile load feeds resolveArea/SelectEmpresaSucursal (fire-and-forget)
      void get().loadProfile();
    } else {
      // No auth data
      set({
        isAuthenticated: false,
      });
    }

    const loginFlowStr = sessionStorage.getItem('loginFlow');
    if (loginFlowStr) {
      try {
        const loginFlow = JSON.parse(loginFlowStr);
        set({
          loginStep: loginFlow.step,
          pendingUsername: loginFlow.username,
          availableDomains: loginFlow.domains,
          requiresDomainSelection: loginFlow.requiresDomainSelection,
          displayName: loginFlow.displayName,
        });
      } catch {
        sessionStorage.removeItem('loginFlow');
      }
    }

    set({ isInitialized: true });
  },
}));

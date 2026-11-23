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
import { authService } from '@/shared/auth/authService';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import { useConfigStore } from '@/store/configStore';
import { toast } from 'sonner';
import {
  refreshPermissions,
  startPermissionsPolling,
  stopPermissionsPolling,
} from '@/utils/permissions';

const LEGACY_TOKEN_KEY = 'token';

const PROFILE_LOAD_ERROR = 'No se pudo cargar tu perfil. Puedes seleccionar empresa y sucursal manualmente.';

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

let profileInflight: Promise<void> | null = null;

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
  hasFirmaLegacy: null,
  firmaEnComprobacion: null,
  puedeSeleccionarEmpresas: false,
  areaEmpleado: null,
  puestoEmpleado: null,
  usuarioDetalle: null,
  profileError: null,

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

  loginStepTwo: async (
    password: string,
    domain: string,
    options?: { requireContextSelection?: boolean }
  ) => {
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

      useConfigStore.getState().updatePerfil({
        nombre: response.user.nombre || '',
        correo: response.user.correo || '',
      });

      if (options?.requireContextSelection === false) {
        set({
          user: response.user,
          token: response.accessToken,
          isAuthenticated: true,
          isLoading: false,
          loginStep: 1,
          availableDomains: [],
          requiresDomainSelection: false,
          displayName: null,
          pendingUsername: null,
        });
        void refreshPermissions();
        startPermissionsPolling();
        void get().fetchProfileSignature();
        return;
      }

      const [empresas, sucursales, areas] = await Promise.all([
        authService.getEmpresas(),
        authService.getSucursales(),
        authService.getAreas(),
      ]);

      let puedeSeleccionar = false;
      let usuarioDetalle: { idEmpresa: number; idSucursal: number; idArea: number | null } | null = null;
      let profileError: string | null = null;
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
        puedeSeleccionar = true;
        profileError = PROFILE_LOAD_ERROR;
      }

      useConfigStore.getState().updatePerfil({
        nombre: response.user.nombre || '',
        correo: response.user.correo || '',
      });

      if (!puedeSeleccionar && empresas.length === 1) {
        const unicaEmpresa = empresas[0];
        const sucursalesDeEmpresa = sucursales.filter(
          (s) => String(s.idEmpresa) === String(unicaEmpresa.idEmpresa)
        );

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
          profileError,
          empresa: unicaEmpresa,
          sucursal: unicaSucursal,
          area: areaResuelta,
        });

        await get().fetchProfileSignature();
        return;
      }

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
        profileError,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginStepThree: async (empresaId: string, sucursalId: string, areaId?: string) => {
    set({ isLoading: true });
    try {
      const { empresas, sucursales, areas } = get();

      const empresa = empresas.find((e) => String(e.idEmpresa) === String(empresaId));
      const sucursal = sucursales.find((s) => String(s.idSucursal) === String(sucursalId));

      if (!empresa || !sucursal) {
        throw new Error('Empresa o sucursal no encontrada');
      }

      authService.setEmpresa(empresa);
      authService.setSucursal(sucursal);

      let selectedArea: Area | null = null;
      if (areaId) {
        selectedArea = areas.find((a) => String(a.idArea) === String(areaId)) || null;
      } else {
        selectedArea = get().resolveArea(empresaId);
      }
      authService.setArea(selectedArea);

      set({
        empresa,
        sucursal,
        area: selectedArea,
        isAuthenticated: true,
        isLoading: false,
        loginStep: 1,
        empresas: [],
        sucursales: [],
        areas: [],
      });

      await get().fetchProfileSignature();

      const { hasFirma, hasFirmaLegacy } = get();
      if (hasFirma === false && hasFirmaLegacy === false) {
        toast.warning('No has cargado tu firma digital', {
          description: 'Ve a Configuración para subir tu firma y poder autorizar documentos.',
          duration: 6000,
        });
      }

      void refreshPermissions();
      startPermissionsPolling();
    } catch (error) {
      set({ isLoading: false });
      throw error;
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
    stopPermissionsPolling();
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
      hasFirmaLegacy: null,
      firmaEnComprobacion: null,
      puedeSeleccionarEmpresas: false,
      areaEmpleado: null,
      puestoEmpleado: null,
      usuarioDetalle: null,
    });

    const pathname = window.location.pathname;
    const isSigmaPath = /^\/sigma(?:\/|$)/i.test(pathname);
    if (isSigmaPath) {
      if (pathname.replace(/\/+$/, '').toLowerCase() !== '/sigma') {
        navigateTo('/SIGMA');
      }
    } else if (!pathname.endsWith('/login')) {
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

  changeEmpresaSucursal: async (empresa: Empresa, sucursal: Sucursal) => {
    authService.setEmpresa(empresa);
    authService.setSucursal(sucursal);

    if (get().areas.length === 0) {
      const areas = await authService.getAreas();
      set({ areas });
    }

    const areaResuelta = get().resolveArea(empresa.idEmpresa);
    authService.setArea(areaResuelta);
    set({ empresa, sucursal, area: areaResuelta });
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
    if (profileInflight) return profileInflight;
    profileInflight = (async () => {
      try {
        const response = await API.get<ApiResponse<{ puedeSeleccionarEmpresas: boolean; areaEmpleado?: string | null; puestoEmpleado?: string | null; detalle?: { firmaPath?: string; firmaPathCifrada?: string; firmaEnComprobacion?: boolean } }>>('/profile');
        const data = response.data.data;
        const detalle = data?.detalle;
        const firmaCifrada = detalle?.firmaPathCifrada;
        const puedeSeleccionar = data?.puedeSeleccionarEmpresas ?? false;
        set({
          hasFirma: !!firmaCifrada,
          hasFirmaLegacy: !!detalle?.firmaPath,
          firmaEnComprobacion: detalle?.firmaEnComprobacion ?? false,
          puedeSeleccionarEmpresas: puedeSeleccionar,
          areaEmpleado: data?.areaEmpleado ?? null,
          puestoEmpleado: data?.puestoEmpleado ?? null,
        });
      } catch {
        set({ hasFirma: false, hasFirmaLegacy: false });
      } finally {
        profileInflight = null;
      }
    })();
    return profileInflight;
  },

  resolveArea: (empresaId: string | number) => {
    const { usuarioDetalle, areas } = get();
    return resolveAreaFrom(usuarioDetalle, areas, empresaId);
  },

  loadProfile: async () => {
    try {
      const response = await API.get<ApiResponse<{ puedeSeleccionarEmpresas: boolean; areaEmpleado?: string | null; puestoEmpleado?: string | null; detalle?: { idEmpresa?: number; idSucursal?: number; idArea?: number; firmaPath?: string; firmaPathCifrada?: string; firmaEnComprobacion?: boolean } }>>('/profile');
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
        areaEmpleado: data?.areaEmpleado ?? null,
        puestoEmpleado: data?.puestoEmpleado ?? null,
        hasFirma: detalle ? !!detalle.firmaPathCifrada : false,
        hasFirmaLegacy: detalle ? !!detalle.firmaPath : false,
        firmaEnComprobacion: detalle?.firmaEnComprobacion ?? false,
        profileError: null,
      });
    } catch {
      set({ hasFirma: false, hasFirmaLegacy: false, profileError: PROFILE_LOAD_ERROR });
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
        hasFirmaLegacy: null,
        firmaEnComprobacion: null,
        puedeSeleccionarEmpresas: false,
        areaEmpleado: null,
        puestoEmpleado: null,
      });

      useConfigStore.getState().updatePerfil({
        nombre: user.nombre || '',
        correo: user.correo || '',
      });

      void get().loadProfile();
      get().fetchProfileSignature();
      void refreshPermissions();
      startPermissionsPolling();
    } else {
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

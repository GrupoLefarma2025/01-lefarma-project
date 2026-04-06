import { create } from 'zustand';
import {
  AuthState,
  UserInfo,
  Empresa,
  Sucursal,
} from '@/types/auth.types';
import type { Area } from '@/types/catalogo.types';
import type { SseUserInfo } from '@/types/sse.types';
import { authService } from '@/services/authService';
import { API } from '@/services/api';
import type { ApiResponse } from '@/types/api.types';
import type { Usuario } from '@/types/usuario.types';
import { useConfigStore } from './configStore';
import { toast } from 'sonner';


const LEGACY_TOKEN_KEY = 'token';

export const useAuthStore = create<AuthState>((set, get) => ({
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
  hasFirma: null as boolean | null,


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

      // Sincronizar con configStore
      useConfigStore.getState().updatePerfil({
        nombre: response.user.nombre || '',
        correo: response.user.correo || '',
      });

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
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginStepThree: async (empresaId: string, sucursalId: string, areaId?: string) => {
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
      if (selectedArea) {
        authService.setArea(selectedArea);
      }
    }

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
      });

    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
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

  changeEmpresaSucursal: (empresa: Empresa, sucursal: Sucursal) => {
    authService.setEmpresa(empresa);
    authService.setSucursal(sucursal);
    set({ empresa, sucursal });
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
      const response = await API.get<ApiResponse<Usuario>>('/profile');
      const firmaPath = response.data.data?.detalle?.firmaPath;
      set({ hasFirma: !!firmaPath });
    } catch {
    }
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
      const isAuthenticated = Boolean(empresa && sucursal && area);

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
    });
      useConfigStore.getState().updatePerfil({
        nombre: user.nombre || '',
        correo: user.correo || '',
      });

      get().fetchProfileSignature();
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

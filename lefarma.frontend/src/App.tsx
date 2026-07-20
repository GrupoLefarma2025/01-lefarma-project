import { useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { BaseAppRoutes } from './apps/baseapp/BaseAppRoutes';
import { useAuthStore } from '@/shared/auth/authStore';
import { useConfigStore } from './store/configStore';
import { Toaster } from '@/components/ui/sonner';
import { AutoVerify } from '@/components/AutoVerify';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { setNavigate } from '@/lib/navigation';

function NavigationRegistrar() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);
  return null;
}


function App() {
  const initialize = useAuthStore((state) => state.initialize);
  const tema = useConfigStore((state) => state.ui.tema);
  const setTema = useConfigStore((state) => state.setTema);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (tema) {
      setTema(tema);
    }
  }, [tema, setTema]);

  // Iniciar refresh proactivo de token
  useTokenRefresh();

  // Verificar si el modo autotest está habilitado
  const urlParams = new URLSearchParams(window.location.search);
  const isAutoTest = urlParams.get('autotest') === 'true';

  if (isAutoTest) {
    return <AutoVerify />;
  }

  // Build de shell único (nav-reorg): el shell del base-app raíz siempre está montado.
  // La antigua rama dual-build (shell condicional por basename vs árbol raíz) está
  // eliminada — el shell ahora vive en la raíz y CxP se monta como subárbol bajo
  // `/cxp/`. Ver BaseAppRoutes para el mapa de rutas.
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <NavigationRegistrar />
      <BaseAppRoutes />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;

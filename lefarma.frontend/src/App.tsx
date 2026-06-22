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

  // Check if autotest mode is enabled
  const urlParams = new URLSearchParams(window.location.search);
  const isAutoTest = urlParams.get('autotest') === 'true';

  if (isAutoTest) {
    return <AutoVerify />;
  }

  // Single shell build (nav-reorg): the root base-app shell is always mounted.
  // The former dual-build branch (basename-conditional shell vs root tree) is
  // eliminated — the shell now lives at root and CxP ships as a subtree under
  // `/cxp/`. See BaseAppRoutes for the route map.
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <NavigationRegistrar />
      <BaseAppRoutes />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;

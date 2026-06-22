import { useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
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

  // App tree selection (design: "App tree selection — branch on BASE_URL").
  // The `/CxP/` build renders the base-app shell; every other base renders the
  // existing Gastos route tree unchanged.
  const isBaseAppShell = import.meta.env.BASE_URL === '/CxP/';

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <NavigationRegistrar />
      {isBaseAppShell ? <BaseAppRoutes /> : <AppRoutes />}
      <Toaster />
    </BrowserRouter>
  );
}

export default App;

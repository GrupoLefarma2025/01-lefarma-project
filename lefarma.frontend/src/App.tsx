import { useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { BaseAppRoutes } from './apps/baseapp/BaseAppRoutes';
import { useConfigStore } from './store/configStore';
import { Toaster } from '@/components/ui/sonner';
import { AutoVerify } from '@/components/AutoVerify';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { setNavigate } from '@/lib/navigation';
import { ConnectionLostOverlay } from '@/components/connection/ConnectionLostOverlay';
import { startConnectivityWatchers } from '@/shared/connection/connectionStore';
import { ConfigSyncProvider } from '@/shared/configuracion/ConfigSyncProvider';
import { ErrorBoundary } from './shared/telemetria/ErrorBoundary';

function NavigationRegistrar() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);
  return null;
}

function App() {
  const tema = useConfigStore((state) => state.ui.tema);
  const setTema = useConfigStore((state) => state.setTema);

  useEffect(() => {
    if (tema) {
      setTema(tema);
    }
  }, [tema, setTema]);

  useEffect(() => startConnectivityWatchers(), []);

  useTokenRefresh();

  const urlParams = new URLSearchParams(window.location.search);
  const isAutoTest = urlParams.get('autotest') === 'true';

  if (isAutoTest) {
    return <AutoVerify />;
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <NavigationRegistrar />
      <ConfigSyncProvider>
        <ErrorBoundary>
          <BaseAppRoutes />
        </ErrorBoundary>
      </ConfigSyncProvider>
      <Toaster />
      <ConnectionLostOverlay />
    </BrowserRouter>
  );
}

export default App;

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

  // Reintentar la conexión en cuanto el navegador avisa de que hay red o de que
  // la pestaña vuelve a estar visible (ver startConnectivityWatchers).
  useEffect(() => startConnectivityWatchers(), []);

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

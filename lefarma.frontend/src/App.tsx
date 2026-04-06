import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { useAuthStore } from './store/authStore';
import { useConfigStore } from './store/configStore';
import { Toaster } from '@/components/ui/sonner';
import { AutoVerify } from '@/components/AutoVerify';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';


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

  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;

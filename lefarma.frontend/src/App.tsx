import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { useAuthStore } from './store/authStore';
import { Toaster } from '@/components/ui/sonner';
import { AutoVerify } from '@/components/AutoVerify';

function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

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

import { createRoot } from 'react-dom/client'
// CSS por responsabilidad:
// - index_ordenes.css: base global (tema/layout) + impresión de CxP
// - index_rh.css: impresión de RH (Solicitud de Personal)
// - index_educacion_medica.css: impresión de Educación Médica
import './index_ordenes.css'
import './index_rh.css'
import './index_educacion_medica.css'

import App from './App.tsx'
import { iniciarTelemetria } from './shared/telemetria/iniciarTelemetria'
import { useAuthStore } from './shared/auth/authStore'

// Antes de montar React: captura errores de arranque, clics y puntero desde el
// primer instante y guarda los eventos en el navegador.
iniciarTelemetria()

// Hidratar la sesión ANTES del primer render: los guards (RequireAuth,
// ProtectedRoute, PublicOnlyRoute) deciden con isInitialized/isAuthenticated
// en ese primer render. Hacerlo en un efecto (como antes) dejaba el primer
// frame con isAuthenticated=false y producía el destello de login al recargar.
useAuthStore.getState().initialize()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <App />,
)

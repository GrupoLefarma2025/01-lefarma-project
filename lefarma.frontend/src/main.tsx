import { createRoot } from 'react-dom/client'
import './index_ordenes.css'
import './index_rh.css'
import './index_educacion_medica.css'

import App from './App.tsx'
import { iniciarTelemetria } from './shared/telemetria/iniciarTelemetria'
import { useAuthStore } from './shared/auth/authStore'

iniciarTelemetria()

useAuthStore.getState().initialize()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <App />,
)

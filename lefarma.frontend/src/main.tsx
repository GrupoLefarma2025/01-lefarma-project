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

// Antes de montar React: captura errores de arranque, clics y puntero desde el
// primer instante y guarda los eventos en el navegador.
iniciarTelemetria()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <App />,
)

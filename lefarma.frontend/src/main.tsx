import { createRoot } from 'react-dom/client'
// import './index.css'
import './index_ordenes.css' // merged via worktree test

import App from './App.tsx'


const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <App />,
)

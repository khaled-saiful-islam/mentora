import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Self-hosted, never fetched from a font CDN: nothing about a child's visit
// leaves for a third party just to draw a letter.
import '@fontsource-variable/fredoka'
import '@fontsource-variable/nunito'
import '@fontsource/lilita-one'
import '@fontsource/andika/400.css'
import '@fontsource/andika/700.css'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

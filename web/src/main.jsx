import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'
import './ref.css'

if (!import.meta.env.VITE_DEMO) registerSW({ immediate: true })
createRoot(document.getElementById('root')).render(<App />)

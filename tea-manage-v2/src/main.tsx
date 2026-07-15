/** @file 应用入口 - 挂载React根组件 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/variables.css'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import reportWebVitals from "./reportWebVitals"
import "./index.css"
import { Buffer } from "buffer"
import process from "process/browser"

// Make polyfills available globally
window.Buffer = Buffer
window.process = process
window.global = window

// Render the app
const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

reportWebVitals()

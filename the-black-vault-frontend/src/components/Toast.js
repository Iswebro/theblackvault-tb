"use client"

import { useState, useCallback } from "react"

export function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = "info") => {
    // Use a unique id: timestamp + random string
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    const toast = { id, message, type }

    setToasts((prev) => [...prev, toast])

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => removeToast(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

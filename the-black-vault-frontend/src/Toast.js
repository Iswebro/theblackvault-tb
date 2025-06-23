"use client"

import { useState, useCallback } from "react"

// Toast Hook
export function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = "info", duration = 5000) => {
    const id = Date.now() + Math.random()
    const toast = { id, message, type, duration }

    setToasts((prev) => [...prev, toast])

    // Auto remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

// Toast Component
export function Toast({ toast, onRemove }) {
  const getToastStyles = (type) => {
    const baseStyles = "toast"
    switch (type) {
      case "success":
        return `${baseStyles} success`
      case "error":
        return `${baseStyles} error`
      case "warning":
        return `${baseStyles} warning`
      case "info":
      default:
        return `${baseStyles} info`
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return "✅"
      case "error":
        return "❌"
      case "warning":
        return "⚠️"
      case "info":
      default:
        return "ℹ️"
    }
  }

  return (
    <div className={getToastStyles(toast.type)}>
      <div className="flex items-center">
        <span className="mr-2">{getIcon(toast.type)}</span>
        <span>{toast.message}</span>
      </div>
      <button onClick={() => onRemove(toast.id)} className="toast-close" aria-label="Close notification">
        ×
      </button>
    </div>
  )
}

// Toast Container Component
export function ToastContainer({ toasts, removeToast }) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}

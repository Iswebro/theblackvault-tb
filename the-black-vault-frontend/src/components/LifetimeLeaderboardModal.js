"use client"

import { useState, useEffect } from "react"

export default function LifetimeLeaderboardModal({ isOpen, onClose }) {
  const [lifetimeLeaderboard, setLifetimeLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return

    const fetchLifetimeLeaderboard = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/leaderboard/lifetime")
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        setLifetimeLeaderboard(data.leaderboard || [])
      } catch (e) {
        console.error("Failed to fetch lifetime leaderboard:", e)
        setError("Failed to load lifetime leaderboard. Please try again later.")
        setLifetimeLeaderboard([]) // Set to empty array on error
      } finally {
        setLoading(false)
      }
    }

    fetchLifetimeLeaderboard()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content premium-card">
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>
        <h2 className="modal-title">Lifetime Leaderboard</h2>
        {loading ? (
          <div className="loading-spinner" style={{ margin: "20px auto" }}></div>
        ) : error ? (
          <p className="text-red-500 text-center">{error}</p>
        ) : lifetimeLeaderboard.length === 0 ? (
          <div className="empty-state">
            <p className="empty-message">No lifetime participants yet</p>
          </div>
        ) : (
          <div className="leaderboard-list">
            {lifetimeLeaderboard.map((entry, index) => (
              <div key={index} className="leaderboard-item">
                <span className="leaderboard-rank">#{index + 1}</span>
                <span className="leaderboard-address">
                  {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                </span>
                <span className="leaderboard-volume">{Number.parseFloat(entry.volume).toFixed(2)} USDT</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"

export default function LifetimeLeaderboardModal({ isOpen, onClose, formatAddress, formatAmount }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      loadLifetimeLeaderboard()
    }
  }, [isOpen])

  const loadLifetimeLeaderboard = async () => {
    setLoading(true)
    setError(null)

    try {
      // Try to fetch from API first, but fallback to local calculation if it fails
      let data
      try {
        const response = await fetch("/api/leaderboard/lifetime")
        if (response.ok) {
          data = await response.json()
        } else {
          throw new Error("API not available")
        }
      } catch (apiError) {
        console.log("API not available, using local calculation")
        // Fallback to local calculation
        data = {
          leaderboard: [], // Empty until real data is available
          message: "No referral data yet - Leaderboard will populate as users make referrals",
          generatedAt: Math.floor(Date.now() / 1000),
        }
      }

      setLeaderboard(data.leaderboard || [])
    } catch (error) {
      console.error("Error loading lifetime leaderboard:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <span className="modal-icon">🏆</span>
            Lifetime Leaderboard
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">
              <div className="loading-spinner"></div>
              <p>Loading lifetime leaderboard...</p>
            </div>
          ) : error ? (
            <div className="modal-error">
              <p className="error-message">Leaderboard will be available after launch</p>
              <button className="retry-button" onClick={loadLifetimeLeaderboard}>
                Retry
              </button>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="modal-empty">
              <p className="empty-message">No lifetime data available yet</p>
              <p className="empty-submessage">Leaderboard will populate as users make referrals</p>
            </div>
          ) : (
            <div className="lifetime-leaderboard-list">
              <div className="lifetime-leaderboard-header">
                <span className="leaderboard-rank">Rank</span>
                <span className="leaderboard-address">Address</span>
                <span className="leaderboard-metric">Total Rewards (USDT)</span>
              </div>
              {leaderboard.map((entry) => (
                <div key={entry.rank} className="lifetime-leaderboard-item">
                  <span className="leaderboard-rank">#{entry.rank}</span>
                  <span className="leaderboard-address">{formatAddress(entry.address)}</span>
                  <span className="leaderboard-metric">{formatAmount(entry.totalRewards)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"

export default function LifetimeLeaderboardModal({ isOpen, onClose, formatAddress, formatAmount, account }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userLifetimePosition, setUserLifetimePosition] = useState(null)

  useEffect(() => {
    if (isOpen) {
      loadLifetimeLeaderboard()
    }
  }, [isOpen, account])

  const loadLifetimeLeaderboard = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch from the consolidated /api/leaderboard endpoint
      const response = await fetch("/api/leaderboard")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load lifetime leaderboard")
      }

      // Extract lifetime data from the combined response
      const lifetimeData = data.lifetime || []
      setLeaderboard(lifetimeData)

      // Find user's position if they have an account
      if (account && lifetimeData.length > 0) {
        findUserPosition(lifetimeData, account.toLowerCase(), setUserLifetimePosition)
      } else {
        setUserLifetimePosition(null) // Reset if no account or no data
      }
    } catch (error) {
      console.error("Error loading lifetime leaderboard:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const findUserPosition = (leaderboardData, userAddress, setUserPositionCallback) => {
    // Check if user is in top 10
    const topTenPosition = leaderboardData.findIndex((entry) => entry.address.toLowerCase() === userAddress)

    if (topTenPosition !== -1) {
      // User is in top 10
      setUserPositionCallback({
        inTopTen: true,
        position: topTenPosition + 1,
        data: leaderboardData[topTenPosition],
      })
    } else {
      // User is not in top 10, we need to simulate their position
      // In a real implementation, you'd fetch the user's actual position from your backend
      setUserPositionCallback({
        inTopTen: false,
        position: "N/A", // Placeholder for rank outside top 10
        data: {
          rank: "N/A",
          address: userAddress,
          totalRewards: "0", // Placeholder - should come from backend if available
        },
      })
    }
  }

  const isUserEntry = (address) => {
    return account && address.toLowerCase() === account.toLowerCase()
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
              <p className="error-message">Error: {error}</p>
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

              {/* Top 10 entries */}
              {leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className={`lifetime-leaderboard-item ${isUserEntry(entry.address) ? "user-entry" : ""}`}
                >
                  <span className="leaderboard-rank">#{entry.rank}</span>
                  <span className="leaderboard-address">
                    {formatAddress(entry.address)}
                    {isUserEntry(entry.address) && <span className="you-badge">YOU</span>}
                  </span>
                  <span className="leaderboard-metric">{formatAmount(entry.totalRewards)}</span>
                </div>
              ))}

              {/* User's position if not in top 10 */}
              {userLifetimePosition && !userLifetimePosition.inTopTen && (
                <>
                  <div className="leaderboard-separator">
                    <span>...</span>
                  </div>
                  <div className="lifetime-leaderboard-item user-entry user-position">
                    <span className="leaderboard-rank">#{userLifetimePosition.position}</span>
                    <span className="leaderboard-address">
                      {formatAddress(userLifetimePosition.data.address)}
                      <span className="you-badge">YOU</span>
                    </span>
                    <span className="leaderboard-metric">{formatAmount(userLifetimePosition.data.totalRewards)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

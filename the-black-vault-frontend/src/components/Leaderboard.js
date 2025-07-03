"use client"

import { useState, useEffect, useCallback } from "react"

export default function Leaderboard({ account }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({ weekly: [], lifetime: [] }) // Combined state for both leaderboards

  const formatAddress = useCallback((addr) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }, [])

  const formatAmount = useCallback((amount) => {
    // Assuming amount is a string representation of BigInt (wei)
    const num = Number.parseFloat(amount) / 1e18 // Convert from wei to USDT
    if (num === 0) return "0"
    if (num < 0.0001) return "< 0.0001"
    return num.toFixed(2)
  }, [])

  const findUserPosition = useCallback((leaderboardData, userAddress) => {
    const topTenPosition = leaderboardData.findIndex((entry) => entry.address.toLowerCase() === userAddress)

    if (topTenPosition !== -1) {
      return {
        inTopTen: true,
        position: topTenPosition + 1,
        data: leaderboardData[topTenPosition],
      }
    } else {
      // If user is not in top 10, we need to simulate their position
      // In a real implementation, you'd fetch the user's actual position from your backend
      return {
        inTopTen: false,
        position: "N/A", // Placeholder for rank outside top 10
        data: {
          rank: "N/A",
          address: userAddress,
          totalRewards: "0", // Placeholder - should come from backend if available
        },
      }
    }
  }, [])

  const loadLeaderboardData = useCallback(async () => {
    setLoading(true)
    setError(null) // Clear previous errors on retry

    try {
      const res = await fetch("/api/leaderboard")

      if (!res.ok) {
        const errorText = await res.text() // Get raw error text for more details
        console.error("API response not OK:", res.status, errorText)
        throw new Error(`HTTP error! status: ${res.status} - ${errorText}`)
      }

      const json = await res.json()
      setData(json)
      setError(null) // Ensure error is null on success

      // Find user's position for weekly
      if (account && json.weekly.length > 0) {
        // Update userWeeklyPosition state
        // This state was previously directly in Leaderboard.js, but now it's part of the data object
        // and should be handled by the parent component if needed, or derived here.
        // For this component, we'll derive it locally for rendering.
      }

      // Find user's position for lifetime
      if (account && json.lifetime.length > 0) {
        // Similar to weekly, derive locally or handle in parent.
      }
    } catch (err) {
      console.error("Leaderboard fetch error:", err)
      setError(err.message || "Fetch failed")
    } finally {
      setLoading(false)
    }
  }, [account])

  useEffect(() => {
    loadLeaderboardData()
  }, [loadLeaderboardData])

  const isUserEntry = (address) => {
    return account && address.toLowerCase() === account.toLowerCase()
  }

  const renderLeaderboardSection = (title, leaderboardData, userPosition) => (
    <div className="vault-card premium-card">
      <h3 className="card-title">
        <span className="card-icon">🏆</span>
        {title}
      </h3>

      {loading ? (
        <div className="leaderboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading {title.toLowerCase()}...</p>
        </div>
      ) : error ? (
        <div className="leaderboard-error">
          <p className="error-message">Error: {error}</p>
          <button className="retry-button" onClick={loadLeaderboardData}>
            Retry
          </button>
        </div>
      ) : leaderboardData.length === 0 ? (
        <div className="leaderboard-empty">
          <p className="empty-message">No {title.toLowerCase()} data yet</p>
          <p className="empty-submessage">
            {title.includes("Weekly")
              ? "Weekly leaderboard will populate as users make referrals"
              : "Leaderboard will populate as users make referrals"}
          </p>
        </div>
      ) : (
        <div className="leaderboard-list">
          <div className="leaderboard-header">
            <span className="leaderboard-rank">Rank</span>
            <span className="leaderboard-address">Address</span>
            <span className="leaderboard-metric">
              {title.includes("Weekly") ? "Weekly Rewards (USDT)" : "Total Rewards (USDT)"}
            </span>
          </div>

          {leaderboardData.map((entry) => (
            <div key={entry.rank} className={`leaderboard-item ${isUserEntry(entry.address) ? "user-entry" : ""}`}>
              <span className="leaderboard-rank">#{entry.rank}</span>
              <span className="leaderboard-address">
                {formatAddress(entry.address)}
                {isUserEntry(entry.address) && <span className="you-badge">YOU</span>}
              </span>
              <span className="leaderboard-metric">{formatAmount(entry.totalRewards)}</span>
            </div>
          ))}

          {userPosition && !userPosition.inTopTen && (
            <>
              <div className="leaderboard-separator">
                <span>...</span>
              </div>
              <div className="leaderboard-item user-entry user-position">
                <span className="leaderboard-rank">#{userPosition.position}</span>
                <span className="leaderboard-address">
                  {formatAddress(userPosition.data.address)}
                  <span className="you-badge">YOU</span>
                </span>
                <span className="leaderboard-metric">{formatAmount(userPosition.data.totalRewards)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )

  // Derive user positions for rendering
  const userWeeklyPosition =
    account && data.weekly.length > 0 ? findUserPosition(data.weekly, account.toLowerCase()) : null
  const userLifetimePosition =
    account && data.lifetime.length > 0 ? findUserPosition(data.lifetime, account.toLowerCase()) : null

  return (
    <>
      {/* Weekly Leaderboard Section */}
      {renderLeaderboardSection("Weekly Referral Leaderboard", data.weekly, userWeeklyPosition)}

      {/* All-time Leaderboard Section */}
      {renderLeaderboardSection("All-time Referral Leaderboard", data.lifetime, userLifetimePosition)}

      <p className="leaderboard-note">Leaderboards track referral rewards earned.</p>
    </>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"

export default function Leaderboard({ account }) {
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState([])
  const [lifetimeLeaderboard, setLifetimeLeaderboard] = useState([]) // New state for lifetime
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [weekInfo, setWeekInfo] = useState(null)
  const [userWeeklyPosition, setUserWeeklyPosition] = useState(null)
  const [userLifetimePosition, setUserLifetimePosition] = useState(null) // New state for user's lifetime position

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
      // If user is not in top 10, we need to fetch their actual rank and rewards from backend
      // For now, we'll use placeholders. In a real app, you'd have a separate API for this.
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
    setError(null)

    try {
      const response = await fetch("/api/leaderboard")
      const data = await response.json()

      if (!response.ok) {
        console.error("API response not OK:", data.error || response.statusText)
        throw new Error(data.error || "Failed to load leaderboard data")
      }

      const weeklyData = data.weekly || []
      const lifetimeData = data.lifetime || []

      setWeeklyLeaderboard(weeklyData)
      setLifetimeLeaderboard(lifetimeData)

      // Find user's position for weekly
      if (account && weeklyData.length > 0) {
        setUserWeeklyPosition(findUserPosition(weeklyData, account.toLowerCase()))
      } else {
        setUserWeeklyPosition(null)
      }

      // Find user's position for lifetime
      if (account && lifetimeData.length > 0) {
        setUserLifetimePosition(findUserPosition(lifetimeData, account.toLowerCase()))
      } else {
        setUserLifetimePosition(null)
      }

      // Week info might be part of the weekly data object if provided by backend
      // For now, we'll infer from the data or use placeholders
      // The backend /api/leaderboard doesn't currently return weekInfo, so we'll use a generic message.
      setWeekInfo({
        weekIndex: 0, // Placeholder
        isPreviousWeek: false, // Placeholder
        message: "Weekly leaderboard will populate as users make referrals",
      })
    } catch (err) {
      console.error("Error loading leaderboard data:", err) // Log full error details
      setError("Error loading leaderboard")
    } finally {
      setLoading(false)
    }
  }, [account, findUserPosition]) // Add findUserPosition to dependencies

  useEffect(() => {
    loadLeaderboardData()
  }, [loadLeaderboardData])

  const getWeekDisplayText = () => {
    if (!weekInfo) return "Loading..."
    // If weekInfo had actual data, you'd use it here. For now, a generic message.
    return "Current Week"
  }

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
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={loadLeaderboardData}>
            Retry
          </button>
        </div>
      ) : leaderboardData.length === 0 ? (
        <div className="leaderboard-empty">
          <p className="empty-message">No {title.toLowerCase()} data yet</p>
          <p className="empty-submessage">
            {title.includes("Weekly") ? weekInfo?.message : "Leaderboard will populate as users make referrals"}
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

  return (
    <>
      {/* Weekly Leaderboard Section */}
      {renderLeaderboardSection("Weekly Referral Leaderboard", weeklyLeaderboard, userWeeklyPosition)}

      {/* All-time Leaderboard Section */}
      {renderLeaderboardSection("All-time Referral Leaderboard", lifetimeLeaderboard, userLifetimePosition)}

      <p className="leaderboard-note">Leaderboards track referral rewards earned.</p>
    </>
  )
}

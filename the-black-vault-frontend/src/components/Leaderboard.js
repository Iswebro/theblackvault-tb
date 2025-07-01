"use client"

import { useState, useEffect } from "react"
import LifetimeLeaderboardModal from "./LifetimeLeaderboardModal"

export default function Leaderboard() {
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [weekInfo, setWeekInfo] = useState(null)
  const [showLifetimeModal, setShowLifetimeModal] = useState(false)

  useEffect(() => {
    loadWeeklyLeaderboard()
  }, [])

  const loadWeeklyLeaderboard = async () => {
    setLoading(true)
    setError(null)

    try {
      // Use relative path for Vercel API routes
      const response = await fetch("/api/leaderboard/weekly")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load weekly leaderboard")
      }

      setWeeklyLeaderboard(data.leaderboard || [])
      setWeekInfo({
        weekIndex: data.weekIndex,
        isPreviousWeek: data.isPreviousWeek,
        message: data.message,
      })
    } catch (error) {
      console.error("Error loading weekly leaderboard:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatAddress = (addr) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatAmount = (amount) => {
    const num = Number.parseFloat(amount) / 1e18 // Convert from wei to USDT
    if (num === 0) return "0"
    if (num < 0.0001) return "< 0.0001"
    return num.toFixed(2)
  }

  const getWeekDisplayText = () => {
    if (!weekInfo) return "Loading..."

    if (weekInfo.isPreviousWeek) {
      return `Week ${weekInfo.weekIndex + 1} (Previous Week)`
    }

    return `Week ${weekInfo.weekIndex + 1} (Current)`
  }

  return (
    <>
      <div className="vault-card premium-card">
        <h3 className="card-title">
          <span className="card-icon">🏆</span>
          Weekly Referral Leaderboard
        </h3>

        <div className="leaderboard-info">
          <p className="week-display">{getWeekDisplayText()}</p>
          <p className="reset-info">Resets every Monday @ 7 AM AEST</p>
        </div>

        {loading ? (
          <div className="leaderboard-loading">
            <div className="loading-spinner"></div>
            <p>Loading weekly leaderboard...</p>
          </div>
        ) : error ? (
          <div className="leaderboard-error">
            <p className="error-message">Error: {error}</p>
            <button className="retry-button" onClick={loadWeeklyLeaderboard}>
              Retry
            </button>
          </div>
        ) : weeklyLeaderboard.length === 0 ? (
          <div className="leaderboard-empty">
            <p className="empty-message">No weekly data yet</p>
            <p className="empty-submessage">
              {weekInfo?.message || "Weekly leaderboard will populate as users make referrals"}
            </p>
          </div>
        ) : (
          <div className="leaderboard-list">
            <div className="leaderboard-header">
              <span className="leaderboard-rank">Rank</span>
              <span className="leaderboard-address">Address</span>
              <span className="leaderboard-metric">Weekly Rewards (USDT)</span>
            </div>
            {weeklyLeaderboard.map((entry) => (
              <div key={entry.rank} className="leaderboard-item">
                <span className="leaderboard-rank">#{entry.rank}</span>
                <span className="leaderboard-address">{formatAddress(entry.address)}</span>
                <span className="leaderboard-metric">{formatAmount(entry.totalRewards)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="leaderboard-actions">
          <button className="lifetime-leaderboard-button" onClick={() => setShowLifetimeModal(true)}>
            See Lifetime Leaderboard
          </button>
        </div>

        <p className="leaderboard-note">Weekly leaderboard tracks referral rewards earned within each 7-day period.</p>
      </div>

      <LifetimeLeaderboardModal
        isOpen={showLifetimeModal}
        onClose={() => setShowLifetimeModal(false)}
        formatAddress={formatAddress}
        formatAmount={formatAmount}
      />
    </>
  )
}

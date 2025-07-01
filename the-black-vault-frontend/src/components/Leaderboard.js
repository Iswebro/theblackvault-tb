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
      // Try to fetch from API first, but fallback to local calculation if it fails
      let data
      try {
        const response = await fetch("/api/leaderboard/weekly")
        if (response.ok) {
          data = await response.json()
        } else {
          throw new Error("API not available")
        }
      } catch (apiError) {
        console.log("API not available, using local calculation")
        // Fallback to local calculation
        data = getLocalWeeklyData()
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

  // Local fallback calculation
  const getLocalWeeklyData = () => {
    // Calculate weeks since your contract deployment
    const CONTRACT_DEPLOY_TIME = Math.floor(Date.now() / 1000) // Current time as deployment time
    const WEEK_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds
    const currentTime = Math.floor(Date.now() / 1000)

    const weekIndex = Math.floor((currentTime - CONTRACT_DEPLOY_TIME) / WEEK_DURATION)

    return {
      weekIndex: weekIndex,
      leaderboard: [], // Empty until real data is available
      message: "No referral data yet - Leaderboard will populate as users make referrals",
      generatedAt: currentTime,
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
            <p className="error-message">Leaderboard will be available after launch</p>
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

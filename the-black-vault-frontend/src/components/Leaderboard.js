"use client"

import { useState, useEffect } from "react"
import LifetimeLeaderboardModal from "./LifetimeLeaderboardModal"

// --- Central Launch Configuration ---
// IMPORTANT: Update this timestamp to your actual launch date/time in UTC.
// You can use https://www.epochconverter.com/ to get the timestamp.
// Current placeholder is January 1, 2025 00:00:00 UTC
const LAUNCH_TIMESTAMP = 1735689600
const WEEK_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds

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
      // In a production environment, you would fetch this from a reliable API.
      // For local dev, we fall back to a local calculation.
      const response = await fetch("/api/leaderboard/weekly")
      if (!response.ok) {
        // This will happen in local dev, which is expected.
        console.warn("Weekly leaderboard API failed, using local fallback.")
        throw new Error("API not available")
      }
      const data = await response.json()
      setWeeklyLeaderboard(data.leaderboard || [])
      setWeekInfo({
        weekIndex: data.weekIndex,
        message: data.message,
      })
    } catch (error) {
      // Fallback for local development or API failure
      const localData = getLocalWeeklyData()
      setWeeklyLeaderboard(localData.leaderboard)
      setWeekInfo({
        weekIndex: localData.weekIndex,
        message: localData.message,
      })
    } finally {
      setLoading(false)
    }
  }

  // Local fallback calculation for development
  const getLocalWeeklyData = () => {
    const nowTs = Math.floor(Date.now() / 1000)
    const hasLaunched = nowTs >= LAUNCH_TIMESTAMP

    if (!hasLaunched) {
      return {
        weekIndex: 0,
        leaderboard: [],
        message: `Leaderboard starts on ${new Date(LAUNCH_TIMESTAMP * 1000).toLocaleDateString()}`,
      }
    }

    const weekIndex = Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION)
    return {
      weekIndex: weekIndex,
      leaderboard: [],
      message: "No referral data yet - Leaderboard will populate as users make referrals",
    }
  }

  const formatAddress = (addr) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatAmount = (amount) => {
    const num = Number.parseFloat(amount) / 1e18 // Convert from wei
    if (num === 0) return "0"
    if (num < 0.0001) return "< 0.0001"
    return num.toFixed(2)
  }

  const getWeekDisplayText = () => {
    if (!weekInfo) return "Loading..."
    const nowTs = Math.floor(Date.now() / 1000)
    const hasLaunched = nowTs >= LAUNCH_TIMESTAMP

    if (!hasLaunched) {
      return "Week 1 (Upcoming)"
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
            <p className="error-message">Could not load leaderboard data.</p>
            <button className="retry-button" onClick={loadWeeklyLeaderboard}>
              Retry
            </button>
          </div>
        ) : weeklyLeaderboard.length === 0 ? (
          <div className="leaderboard-empty">
            <p className="empty-message">No weekly data yet</p>
            <p className="empty-submessage">{weekInfo?.message || "Leaderboard will populate after launch."}</p>
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

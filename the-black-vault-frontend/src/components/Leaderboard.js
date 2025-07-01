"use client"

import { useState, useEffect } from "react"
import LifetimeLeaderboardModal from "./LifetimeLeaderboardModal"

// Define LAUNCH_TIMESTAMP directly here
const LAUNCH_TIMESTAMP = 1717804800000 // June 8, 2024 00:00:00 GMT

export default function Leaderboard() {
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showLifetimeModal, setShowLifetimeModal] = useState(false)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/leaderboard/weekly")
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        setWeeklyLeaderboard(data.leaderboard || [])
      } catch (e) {
        console.error("Failed to fetch weekly leaderboard:", e)
        setError("Failed to load weekly leaderboard. Please try again later.")
        setWeeklyLeaderboard([]) // Set to empty array on error
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const getCountdown = () => {
    const now = Date.now()
    const oneWeek = 7 * 24 * 60 * 60 * 1000
    const timeSinceLaunch = now - LAUNCH_TIMESTAMP
    const weeksSinceLaunch = Math.floor(timeSinceLaunch / oneWeek)
    const nextResetTime = LAUNCH_TIMESTAMP + (weeksSinceLaunch + 1) * oneWeek

    const timeLeft = nextResetTime - now

    if (timeLeft <= 0) {
      return "Resetting soon..."
    }

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24))
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000)

    return `${days}d ${hours}h ${minutes}m ${seconds}s`
  }

  return (
    <div className="vault-card premium-card">
      <h3 className="card-title">
        <span className="card-icon">🏆</span>
        Weekly Leaderboard
      </h3>
      <div className="leaderboard-countdown">Next Reset: {getCountdown()}</div>
      {loading ? (
        <div className="loading-spinner" style={{ margin: "20px auto" }}></div>
      ) : error ? (
        <p className="text-red-500 text-center">{error}</p>
      ) : weeklyLeaderboard.length === 0 ? (
        <div className="empty-state">
          <p className="empty-message">No participants yet</p>
          <p className="empty-submessage">Be the first to make a deposit!</p>
        </div>
      ) : (
        <div className="leaderboard-list">
          {weeklyLeaderboard.map((entry, index) => (
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
      <button className="vault-button premium-button secondary mt-4" onClick={() => setShowLifetimeModal(true)}>
        View Lifetime Leaderboard
      </button>
      <LifetimeLeaderboardModal isOpen={showLifetimeModal} onClose={() => setShowLifetimeModal(false)} />
    </div>
  )
}

// For now, we'll use a simple in-memory store
// In production, you'd use Vercel KV, Upstash, or another database

const weeklyLeaderboardData = null

function getCurrentWeekIndex() {
  // Set this to your actual launch timestamp when you go live
  const LAUNCH_TIMESTAMP = 1735689600 // Jan 1, 2025 00:00:00 UTC
  const WEEK_DURATION = 7 * 24 * 60 * 60
  const nowTs = Math.floor(Date.now() / 1000)

  // If current time is before launch, return 0
  if (nowTs < LAUNCH_TIMESTAMP) {
    return 0
  }

  return Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION)
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const currentWeekIndex = getCurrentWeekIndex()

    // Return empty leaderboard until real data is generated
    return res.status(200).json({
      weekIndex: currentWeekIndex,
      leaderboard: [], // Empty array instead of mock data
      message: "No referral data yet - Leaderboard will populate as users make referrals",
      generatedAt: Math.floor(Date.now() / 1000),
    })
  } catch (error) {
    console.error("Error reading weekly leaderboard:", error)
    res.status(500).json({ error: "Failed to load weekly leaderboard" })
  }
}

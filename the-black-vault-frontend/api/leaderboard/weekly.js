// For now, we'll use a simple in-memory store
// In production, you'd use Vercel KV, Upstash, or another database

const weeklyLeaderboardData = null

function getCurrentWeekIndex() {
  const LAUNCH_TIMESTAMP = 1718668800
  const WEEK_DURATION = 7 * 24 * 60 * 60
  const nowTs = Math.floor(Date.now() / 1000)
  return Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION)
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const currentWeekIndex = getCurrentWeekIndex()

    // For demo purposes, return mock data if no real data exists
    if (!weeklyLeaderboardData) {
      return res.status(200).json({
        weekIndex: currentWeekIndex,
        leaderboard: [
          {
            rank: 1,
            address: "0xabc123...def456",
            totalRewards: "1250000000000000000000", // 1250 USDT in wei
          },
          {
            rank: 2,
            address: "0x789xyz...123abc",
            totalRewards: "950000000000000000000", // 950 USDT in wei
          },
          {
            rank: 3,
            address: "0x456def...789xyz",
            totalRewards: "750000000000000000000", // 750 USDT in wei
          },
        ],
        message: "Demo data - Run cron job to generate real leaderboard data",
        generatedAt: Math.floor(Date.now() / 1000),
      })
    }

    res.status(200).json(weeklyLeaderboardData)
  } catch (error) {
    console.error("Error reading weekly leaderboard:", error)
    res.status(500).json({ error: "Failed to load weekly leaderboard" })
  }
}

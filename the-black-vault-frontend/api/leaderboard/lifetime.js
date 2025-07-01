// For now, we'll use a simple in-memory store
// In production, you'd use Vercel KV, Upstash, or another database

const lifetimeLeaderboardData = null

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // Return empty leaderboard until real data is generated
    return res.status(200).json({
      leaderboard: [], // Empty array instead of mock data
      message: "No referral data yet - Leaderboard will populate as users make referrals",
      generatedAt: Math.floor(Date.now() / 1000),
    })
  } catch (error) {
    console.error("Error reading lifetime leaderboard:", error)
    res.status(500).json({ error: "Failed to load lifetime leaderboard" })
  }
}

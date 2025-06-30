// For now, we'll use a simple in-memory store
// In production, you'd use Vercel KV, Upstash, or another database

const lifetimeLeaderboardData = null

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // For demo purposes, return mock data if no real data exists
    if (!lifetimeLeaderboardData) {
      return res.status(200).json({
        leaderboard: [
          {
            rank: 1,
            address: "0xabc123...def456",
            totalRewards: "5750000000000000000000", // 5750 USDT in wei
          },
          {
            rank: 2,
            address: "0x789xyz...123abc",
            totalRewards: "4200000000000000000000", // 4200 USDT in wei
          },
          {
            rank: 3,
            address: "0x456def...789xyz",
            totalRewards: "3100000000000000000000", // 3100 USDT in wei
          },
          {
            rank: 4,
            address: "0x111aaa...222bbb",
            totalRewards: "2800000000000000000000", // 2800 USDT in wei
          },
          {
            rank: 5,
            address: "0x333ccc...444ddd",
            totalRewards: "2400000000000000000000", // 2400 USDT in wei
          },
        ],
        message: "Demo data - Run cron job to generate real leaderboard data",
        generatedAt: Math.floor(Date.now() / 1000),
      })
    }

    res.status(200).json(lifetimeLeaderboardData)
  } catch (error) {
    console.error("Error reading lifetime leaderboard:", error)
    res.status(500).json({ error: "Failed to load lifetime leaderboard" })
  }
}

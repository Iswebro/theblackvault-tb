import { kv } from "@vercel/kv"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    console.log("Fetching leaderboard data from Vercel KV...")

    // Fetch both weekly and lifetime data from KV
    const [weeklyData, lifetimeData] = await Promise.all([kv.get("WeekLeaderboard"), kv.get("LifetimeLeaderboard")])

    return res.status(200).json({
      success: true,
      weekly: weeklyData || {
        leaderboard: [],
        message: "No weekly data available yet",
        weekIndex: -1,
        generatedAt: null,
      },
      lifetime: lifetimeData || {
        leaderboard: [],
        message: "No lifetime data available yet",
        generatedAt: null,
      },
      lastUpdated: weeklyData?.generatedAt || lifetimeData?.generatedAt || null,
    })
  } catch (error) {
    console.error("Error fetching leaderboard data:", error)
    return res.status(500).json({
      success: false,
      error: "Failed to fetch leaderboard data",
      timestamp: new Date().toISOString(),
    })
  }
}

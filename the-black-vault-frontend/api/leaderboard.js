import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.REDIS_REST_URL,
  token: process.env.REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    console.log("Fetching leaderboard data from Upstash Redis...")

    // Fetch both weekly and lifetime data from Redis
    const weeklyRaw = await redis.get("WeekLeaderboard")
    const lifetimeRaw = await redis.get("LifetimeLeaderboard")
    const weekly = weeklyRaw ? JSON.parse(weeklyRaw) : []
    const lifetime = lifetimeRaw ? JSON.parse(lifetimeRaw) : []

    return res.status(200).json({
      weekly,
      lifetime,
    })
  } catch (error) {
    console.error("Upstash Redis error:", error) // Added this line for better debugging
    console.error("Error fetching leaderboard data:", error)
    return res.status(500).json({
      success: false,
      error: "Failed to fetch leaderboard data",
      timestamp: new Date().toISOString(),
    })
  }
}

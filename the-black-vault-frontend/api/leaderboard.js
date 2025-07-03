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

    // Parse the data, defaulting to an empty array if null
    const weekly = weeklyRaw ? JSON.parse(weeklyRaw) : []
    const lifetime = lifetimeRaw ? JSON.parse(lifetimeRaw) : []

    console.log("Leaderboard data fetched successfully.")

    return res.status(200).json({
      weekly,
      lifetime,
    })
  } catch (error) {
    console.error("Error fetching leaderboard data from Upstash Redis:", error)
    return res.status(500).json({
      success: false,
      error: "Failed to fetch leaderboard data",
      timestamp: new Date().toISOString(),
    })
  }
}

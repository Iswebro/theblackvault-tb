import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.REDIS_REST_URL,
  token: process.env.REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
  console.log("Leaderboard API called")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    console.log("Fetching leaderboard data from Upstash Redis...")

    let weeklyRaw = null
    let lifetimeRaw = null

    try {
      weeklyRaw = await redis.get("WeekLeaderboard")
      lifetimeRaw = await redis.get("LifetimeLeaderboard")
    } catch (redisError) {
      console.error("Error reading from Upstash Redis:", redisError)
      return res.status(500).json({ error: "Redis read failed" })
    }

    // Parse the data, defaulting to an empty array if null
    const weekly = weeklyRaw ? JSON.parse(weeklyRaw) : []
    const lifetime = lifetimeRaw ? JSON.parse(lifetimeRaw) : []

    console.log("Leaderboard data fetched successfully.")

    return res.status(200).json({
      weekly,
      lifetime,
    })
  } catch (error) {
    console.error("Error in leaderboard API handler:", error) // More general error for other issues
    return res.status(500).json({
      success: false,
      error: "Failed to fetch leaderboard data",
      timestamp: new Date().toISOString(),
    })
  }
}

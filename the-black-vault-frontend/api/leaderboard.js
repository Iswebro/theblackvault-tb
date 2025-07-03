import { Redis } from "@upstash/redis"

export default async function handler(req, res) {
  // Immediately log invocation and environment variable presence
  console.log("🟢 /api/leaderboard called, method:", req.method)
  console.log("REDIS_REST_URL:", process.env.REDIS_REST_URL ? "present" : "missing")
  console.log("REDIS_REST_TOKEN:", process.env.REDIS_REST_TOKEN ? "present" : "missing")

  // Validate request method
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ error: "Method not allowed" })
  }

  // Check for required Redis environment variables
  if (!process.env.REDIS_REST_URL || !process.env.REDIS_REST_TOKEN) {
    console.error("Missing Redis environment variables: REDIS_REST_URL or REDIS_REST_TOKEN.")
    return res.status(500).json({ error: "Missing Redis credentials" })
  }

  // Initialize Upstash Redis client
  const redis = new Redis({
    url: process.env.REDIS_REST_URL,
    token: process.env.REDIS_REST_TOKEN,
  })

  try {
    // Fetch data from Redis
    const weeklyRaw = await redis.get("WeekLeaderboard")
    const lifetimeRaw = await redis.get("LifetimeLeaderboard")

    // Log raw values before parsing
    console.log("Raw weeklyRaw:", weeklyRaw)
    console.log("Raw lifetimeRaw:", lifetimeRaw)

    // Parse JSON data or default to empty arrays if data is null
    const weekly = weeklyRaw ? JSON.parse(weeklyRaw) : []
    const lifetime = lifetimeRaw ? JSON.parse(lifetimeRaw) : []

    // Respond with success
    return res.status(200).json({ weekly, lifetime })
  } catch (err) {
    // Log specific Redis errors and return a generic error message to the client
    console.error("Redis error:", err)
    return res.status(500).json({ error: "Redis read failed" })
  }
}

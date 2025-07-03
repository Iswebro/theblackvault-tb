import { Redis } from "@upstash/redis"
import { req } from "some-request-library" // Placeholder for declaring req variable

console.log("🔍 /api/leaderboard invoked, method:", req.method)

const redis = new Redis({
  url: process.env.REDIS_REST_URL,
  token: process.env.REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
  console.log("Leaderboard API called")
  res.setHeader("Content-Type", "application/json")

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const weeklyRaw = await redis.get("WeekLeaderboard")
    const lifetimeRaw = await redis.get("LifetimeLeaderboard")

    const weekly = weeklyRaw ? JSON.parse(weeklyRaw) : []
    const lifetime = lifetimeRaw ? JSON.parse(lifetimeRaw) : []

    return res.status(200).json({ weekly, lifetime })
  } catch (err) {
    console.error("Redis read failed", err)
    return res.status(500).json({ error: "Internal Server Error" })
  }
}

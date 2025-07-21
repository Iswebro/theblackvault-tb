
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Key: leaderboard:lifetime
    const leaderboard = (await redis.get('leaderboard:lifetime')) || [];

    return res.status(200).json({
      leaderboard,
      message: leaderboard.length === 0 ? "No referral data yet - Leaderboard will populate as users make referrals" : undefined,
      generatedAt: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    console.error("Error reading lifetime leaderboard:", error);
    res.status(500).json({ error: "Failed to load lifetime leaderboard" });
  }
}

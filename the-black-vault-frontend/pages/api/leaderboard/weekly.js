
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

function getCurrentWeekIndex() {
  const LAUNCH_TIMESTAMP = 1751490000; // 3 July 2025 07:00 AEST (UTC+10)
  const WEEK_DURATION = 7 * 24 * 60 * 60;
  const nowTs = Math.floor(Date.now() / 1000);
  return Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Support ?week=<index> to fetch any week, default to current
    const weekIndex = req.query.week ? Number(req.query.week) : getCurrentWeekIndex();
    const key = `leaderboard:weekly:${weekIndex}`;
    let leaderboard = await redis.get(key);
    if (!leaderboard) {
      leaderboard = [];
      await redis.set(key, leaderboard);
    }

    return res.status(200).json({
      weekIndex,
      leaderboard,
      message: leaderboard.length === 0 ? "No referral data yet - Leaderboard will populate as users make referrals" : undefined,
      generatedAt: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    console.error("Error reading weekly leaderboard:", error);
    res.status(500).json({ error: "Failed to load weekly leaderboard" });
  }
}

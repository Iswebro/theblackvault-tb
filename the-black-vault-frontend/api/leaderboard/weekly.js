
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

function getCurrentWeekIndex() {
  const LAUNCH_TIMESTAMP = 1751500800; // 7am Brisbane time 3 July 2025
  const WEEK_DURATION = 7 * 24 * 60 * 60;
  const nowTs = Math.floor(Date.now() / 1000);
  return Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const currentWeekIndex = getCurrentWeekIndex();
    // Key format: leaderboard:weekly:<weekIndex>
    const key = `leaderboard:weekly:${currentWeekIndex}`;
    const leaderboard = (await redis.get(key)) || [];

    return res.status(200).json({
      weekIndex: currentWeekIndex,
      leaderboard,
      message: leaderboard.length === 0 ? "No referral data yet - Leaderboard will populate as users make referrals" : undefined,
      generatedAt: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    console.error("Error reading weekly leaderboard:", error);
    res.status(500).json({ error: "Failed to load weekly leaderboard" });
  }
}

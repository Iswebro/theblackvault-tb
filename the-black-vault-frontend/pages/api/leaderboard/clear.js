import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function getCurrentWeekIndex() {
  const LAUNCH_TIMESTAMP = 1751490000; // 3 July 2025 07:00 AEST (UTC+10)
  const WEEK_DURATION = 7 * 24 * 60 * 60;
  const nowTs = Math.floor(Date.now() / 1000);
  return Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const currentWeek = getCurrentWeekIndex();
    const key = `leaderboard:weekly:${currentWeek}`;
    
    // Clear the current week's leaderboard
    await redis.del(key);
    
    return res.status(200).json({
      success: true,
      message: `Cleared leaderboard for week ${currentWeek}`,
      weekIndex: currentWeek
    });
  } catch (error) {
    console.error("Error clearing leaderboard:", error);
    return res.status(500).json({ 
      error: "Failed to clear leaderboard",
      details: error.message 
    });
  }
}
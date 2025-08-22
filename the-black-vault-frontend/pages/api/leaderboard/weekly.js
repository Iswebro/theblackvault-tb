import { Redis } from '@upstash/redis';

// Competition specific constants (separate from project launch)
const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST - Weekly Challenge Competition Launch
const WEEK_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function getCurrentWeekIndex() {
  const nowTs = Math.floor(Date.now() / 1000);
  return Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Support ?week=<index> to fetch any week, default to current
    const weekIndex = req.query.week ? Number(req.query.week) : getCurrentWeekIndex();
    const key = `leaderboard:weekly:${weekIndex}`;
    
    let weeklyData = await redis.get(key);
    
    if (!weeklyData || !weeklyData.leaderboard) {
      // Return empty structure matching frontend expectations
      return res.status(200).json({
        success: true,
        data: {
          weekIndex,
          leaderboard: [],
          totalEntries: 0,
          message: "No referral data yet - Leaderboard will populate as users make referrals"
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        weekIndex,
        leaderboard: weeklyData.leaderboard || [],
        totalEntries: weeklyData.totalEntries || 0,
        generatedAt: weeklyData.generatedAt || Math.floor(Date.now() / 1000)
      }
    });
  } catch (error) {
    console.error("Error reading weekly leaderboard:", error);
    return res.status(500).json({ 
      success: false,
      error: "Failed to load weekly leaderboard",
      details: error.message 
    });
  }
}


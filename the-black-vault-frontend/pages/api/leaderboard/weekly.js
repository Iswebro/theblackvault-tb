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

// CRON JOB CODE MOVED HERE FROM api/cron/weekly-leaderboard.js

// This function will be called by the cron job
export async function updateWeeklyLeaderboard() {
  const currentWeekIndex = getCurrentWeekIndex();
  const previousWeekIndex = currentWeekIndex - 1;

  try {
    // Get the leaderboard for the previous week
    const key = `leaderboard:weekly:${previousWeekIndex}`;
    let leaderboard = await redis.get(key);
    if (!leaderboard) {
      leaderboard = [];
    }

    // Sort the leaderboard by the number of referrals (assuming higher is better)
    leaderboard.sort((a, b) => b.referrals - a.referrals);

    // Get the top 10 referrers
    const topReferrers = leaderboard.slice(0, 10);

    // Prepare the data for the new week
    const newWeekData = {
      weekIndex: currentWeekIndex,
      referrers: topReferrers,
      generatedAt: Math.floor(Date.now() / 1000),
    };

    // Save the new week's data to Redis
    await redis.set(`leaderboard:weekly:${currentWeekIndex}`, newWeekData);

    console.log(`Weekly leaderboard updated for week ${currentWeekIndex}`);
  } catch (error) {
    console.error("Error updating weekly leaderboard:", error);
  }
}

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Helper to get current week index
function getCurrentWeekIndex() {
  const PROJECT_LAUNCH_TIMESTAMP = 1751490000; // July 3, 2025 07:00 AEST - Original Project Launch (for general leaderboards)
  const WEEK_DURATION = 7 * 24 * 60 * 60;
  const nowTs = Math.floor(Date.now() / 1000);
  return Math.floor((nowTs - PROJECT_LAUNCH_TIMESTAMP) / WEEK_DURATION);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { referrer, amount } = req.body;
    if (!referrer || !amount) {
      return res.status(400).json({ error: 'Missing referrer or amount' });
    }
    const refAddr = referrer.toLowerCase();
    const amt = BigInt(amount);

    // --- Update Lifetime Leaderboard ---
    let lifetime = (await redis.get('leaderboard:lifetime')) || [];
    let found = false;
    lifetime = lifetime.map((entry) => {
      if (entry.address.toLowerCase() === refAddr) {
        found = true;
        return {
          ...entry,
          totalRewards: (BigInt(entry.totalRewards) + amt).toString(),
        };
      }
      return entry;
    });
    if (!found) {
      lifetime.push({
        rank: 0, // Will be recalculated on read
        address: refAddr,
        totalRewards: amt.toString(),
      });
    }
    // Sort and re-rank - properly handle BigInt comparison
    lifetime.sort((a, b) => {
      const aRewards = BigInt(a.totalRewards);
      const bRewards = BigInt(b.totalRewards);
      if (bRewards > aRewards) return 1;
      if (bRewards < aRewards) return -1;
      return 0;
    });
    lifetime.forEach((entry, i) => (entry.rank = i + 1));
    await redis.set('leaderboard:lifetime', lifetime);

    // --- Update Weekly Leaderboard ---
    const weekIdx = getCurrentWeekIndex();
    const weekKey = `leaderboard:weekly:${weekIdx}`;
    let weekly = (await redis.get(weekKey)) || [];
    found = false;
    weekly = weekly.map((entry) => {
      if (entry.address.toLowerCase() === refAddr) {
        found = true;
        return {
          ...entry,
          totalRewards: (BigInt(entry.totalRewards) + amt).toString(),
        };
      }
      return entry;
    });
    if (!found) {
      weekly.push({
        rank: 0,
        address: refAddr,
        totalRewards: amt.toString(),
      });
    }
    // Sort and re-rank - properly handle BigInt comparison
    weekly.sort((a, b) => {
      const aRewards = BigInt(a.totalRewards);
      const bRewards = BigInt(b.totalRewards);
      if (bRewards > aRewards) return 1;
      if (bRewards < aRewards) return -1;
      return 0;
    });
    weekly.forEach((entry, i) => (entry.rank = i + 1));
    await redis.set(weekKey, weekly);

    return res.status(200).json({ success: true, message: 'Leaderboard updated', weekIdx });
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
}

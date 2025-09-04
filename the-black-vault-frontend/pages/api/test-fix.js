import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    console.log('🔍 Testing referral fix status...');
    
    // Calculate current week
    const COMPETITION_LAUNCH_TIMESTAMP = 1755118800;
    const WEEK_DURATION = 7 * 24 * 60 * 60;
    const nowTs = Math.floor(Date.now() / 1000);
    const weekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    
    // Check data for current week and previous weeks
    const weeklyData = await redis.get(`leaderboard:weekly:${weekIndex}`);
    const lifetimeData = await redis.get('leaderboard:lifetime');
    
    // Check for target referrer
    const targetReferrer = '0xB98e82C611BFc1b852412268fd300E28fAEE4D48';
    const foundInWeekly = weeklyData?.leaderboard?.find(entry => 
      entry.referrer?.toLowerCase() === targetReferrer.toLowerCase()
    );
    const foundInLifetime = lifetimeData?.leaderboard?.find(entry => 
      entry.referrer?.toLowerCase() === targetReferrer.toLowerCase()
    );
    
    // Check previous weeks too
    const previousWeeksData = {};
    for (let i = 0; i < weekIndex; i++) {
      const data = await redis.get(`leaderboard:weekly:${i}`);
      previousWeeksData[i] = data?.leaderboard?.length || 0;
    }
    
    res.status(200).json({
      success: true,
      currentWeek: weekIndex,
      timestamp: new Date().toISOString(),
      currentWeeklyEntries: weeklyData?.leaderboard?.length || 0,
      lifetimeEntries: lifetimeData?.leaderboard?.length || 0,
      targetReferrer: {
        address: targetReferrer,
        foundInWeekly: !!foundInWeekly,
        foundInLifetime: !!foundInLifetime,
        weeklyData: foundInWeekly || null,
        lifetimeData: foundInLifetime || null
      },
      previousWeeks: previousWeeksData,
      sampleWeeklyEntries: weeklyData?.leaderboard?.slice(0, 3) || [],
      sampleLifetimeEntries: lifetimeData?.leaderboard?.slice(0, 3) || []
    });
    
  } catch (error) {
    console.error('❌ Fix test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

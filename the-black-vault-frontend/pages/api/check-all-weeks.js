// Check status across all weeks
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    const COMPETITION_LAUNCH_TIMESTAMP = 1755118800;
    const WEEK_DURATION = 7 * 24 * 60 * 60;
    const nowTs = Math.floor(Date.now() / 1000);
    const currentWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    
    const targetReferrer = '0xB98e82C611BFc1b852412268fd300E28fAEE4D48';
    const weeklyStatus = {};
    
    // Check all weeks
    for (let weekIndex = 0; weekIndex <= currentWeekIndex; weekIndex++) {
      const weeklyData = await redis.get(`leaderboard:weekly:${weekIndex}`);
      const foundTarget = weeklyData?.leaderboard?.find(entry => 
        entry.referrer?.toLowerCase() === targetReferrer.toLowerCase()
      );
      
      weeklyStatus[weekIndex] = {
        totalEntries: weeklyData?.leaderboard?.length || 0,
        targetFound: !!foundTarget,
        targetReferrals: foundTarget?.totalReferrals || 0,
        weekStart: new Date((COMPETITION_LAUNCH_TIMESTAMP + weekIndex * WEEK_DURATION) * 1000).toISOString(),
        weekEnd: new Date((COMPETITION_LAUNCH_TIMESTAMP + (weekIndex + 1) * WEEK_DURATION) * 1000).toISOString()
      };
    }
    
    // Check lifetime
    const lifetimeData = await redis.get('leaderboard:lifetime');
    const foundInLifetime = lifetimeData?.leaderboard?.find(entry => 
      entry.referrer?.toLowerCase() === targetReferrer.toLowerCase()
    );
    
    return res.status(200).json({
      success: true,
      currentWeek: currentWeekIndex,
      targetReferrer: targetReferrer,
      weeklyStatus: weeklyStatus,
      lifetime: {
        totalEntries: lifetimeData?.leaderboard?.length || 0,
        targetFound: !!foundInLifetime,
        targetReferrals: foundInLifetime?.totalReferrals || 0
      },
      summary: {
        weeksWithTarget: Object.entries(weeklyStatus).filter(([_, data]) => data.targetFound).map(([week, _]) => parseInt(week)),
        totalWeeksChecked: currentWeekIndex + 1,
        targetFoundInLifetime: !!foundInLifetime
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

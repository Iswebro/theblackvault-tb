// Comprehensive fix for ALL weeks - past, present, and future
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    console.log('🔄 COMPREHENSIVE FIX: Rebuilding ALL weekly leaderboards...');
    
    // Import the weekly leaderboard aggregation function
    const { aggregateWeeklyLeaderboard, aggregateLifetimeLeaderboard } = await import('./cron/weeklyleaderboard.js');
    
    // Calculate current week and all previous weeks
    const COMPETITION_LAUNCH_TIMESTAMP = 1755118800;
    const WEEK_DURATION = 7 * 24 * 60 * 60;
    const nowTs = Math.floor(Date.now() / 1000);
    const currentWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    
    console.log(`📅 Current week: ${currentWeekIndex}`);
    console.log(`🔄 Will rebuild weeks 0 through ${currentWeekIndex}`);
    
    const results = {};
    const errors = [];
    
    // Rebuild ALL weeks from 0 to current
    for (let weekIndex = 0; weekIndex <= currentWeekIndex; weekIndex++) {
      try {
        console.log(`\n🔄 Rebuilding week ${weekIndex}...`);
        
        const weeklyData = await aggregateWeeklyLeaderboard(weekIndex);
        
        // Store the rebuilt data
        await redis.set(`leaderboard:weekly:${weekIndex}`, weeklyData);
        
        results[weekIndex] = {
          success: true,
          entries: weeklyData.leaderboard.length,
          topReferrers: weeklyData.leaderboard.slice(0, 3).map(r => ({
            referrer: r.referrer,
            referrals: r.totalReferrals
          }))
        };
        
        // Check if our target referrer is in this week
        const targetReferrer = '0xB98e82C611BFc1b852412268fd300E28fAEE4D48';
        const foundTarget = weeklyData.leaderboard.find(entry => 
          entry.referrer?.toLowerCase() === targetReferrer.toLowerCase()
        );
        
        if (foundTarget) {
          console.log(`✅ TARGET FOUND in week ${weekIndex}:`, foundTarget.totalReferrals, 'referrals');
          results[weekIndex].targetFound = true;
          results[weekIndex].targetData = foundTarget;
        }
        
        console.log(`✅ Week ${weekIndex} rebuilt: ${weeklyData.leaderboard.length} entries`);
        
      } catch (error) {
        console.error(`❌ Error rebuilding week ${weekIndex}:`, error.message);
        errors.push({
          week: weekIndex,
          error: error.message
        });
        results[weekIndex] = {
          success: false,
          error: error.message
        };
      }
    }
    
    // Rebuild lifetime leaderboard with all the new data
    console.log('\n🔄 Rebuilding lifetime leaderboard...');
    try {
      const lifetimeData = await aggregateLifetimeLeaderboard();
      await redis.set('leaderboard:lifetime', lifetimeData);
      
      // Check for target in lifetime
      const targetReferrer = '0xB98e82C611BFc1b852412268fd300E28fAEE4D48';
      const foundInLifetime = lifetimeData.leaderboard.find(entry => 
        entry.referrer?.toLowerCase() === targetReferrer.toLowerCase()
      );
      
      console.log(`✅ Lifetime leaderboard rebuilt: ${lifetimeData.leaderboard.length} entries`);
      if (foundInLifetime) {
        console.log(`✅ TARGET FOUND in lifetime:`, foundInLifetime.totalReferrals, 'total referrals');
      }
      
    } catch (error) {
      console.error('❌ Error rebuilding lifetime:', error.message);
      errors.push({
        scope: 'lifetime',
        error: error.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Comprehensive rebuild completed',
      weeksRebuilt: currentWeekIndex + 1,
      results: results,
      errors: errors,
      summary: {
        totalWeeks: currentWeekIndex + 1,
        successfulWeeks: Object.values(results).filter(r => r.success).length,
        failedWeeks: errors.filter(e => e.week !== undefined).length,
        weeksWithTarget: Object.entries(results).filter(([_, data]) => data.targetFound).map(([week, _]) => parseInt(week))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Comprehensive rebuild failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}

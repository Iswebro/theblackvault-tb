// pages/api/trigger-weekly-update.js
// Manual trigger to force update weekly leaderboard data

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    console.log('🔄 Manual trigger: Starting weekly leaderboard update...');
    
    // Import the weekly leaderboard aggregation function
    const { aggregateWeeklyLeaderboard } = await import('./cron/weeklyleaderboard.js');
    
    // Calculate current week index
    const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST - Weekly Challenge Competition Launch
    const WEEK_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds
    const nowTs = Math.floor(Date.now() / 1000);
    const weekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    
    console.log(`🔄 Aggregating data for week ${weekIndex}...`);
    
    // Run the aggregation
    const result = await aggregateWeeklyLeaderboard();
    
    return res.status(200).json({
      success: true,
      message: 'Weekly leaderboard update triggered successfully',
      currentWeek: weekIndex,
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in manual trigger:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

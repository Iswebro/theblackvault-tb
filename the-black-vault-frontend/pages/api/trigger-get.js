// GET version of trigger for testing in browser
export default async function handler(req, res) {
  try {
    console.log('🔄 GET trigger: Starting weekly leaderboard update...');
    
    // Import the weekly leaderboard aggregation function
    const { aggregateWeeklyLeaderboard } = await import('./cron/weeklyleaderboard.js');
    
    // Calculate current week index
    const COMPETITION_LAUNCH_TIMESTAMP = 1755118800;
    const WEEK_DURATION = 7 * 24 * 60 * 60;
    const nowTs = Math.floor(Date.now() / 1000);
    const weekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    
    console.log(`🔄 Aggregating data for week ${weekIndex}...`);
    
    // Run the aggregation
    const result = await aggregateWeeklyLeaderboard(weekIndex);
    
    return res.status(200).json({
      success: true,
      message: 'Weekly leaderboard update triggered successfully',
      currentWeek: weekIndex,
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in GET trigger:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}

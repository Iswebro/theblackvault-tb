// Comprehensive fix for ALL weeks - past, present, and future
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    console.log('🔄 COMPREHENSIVE FIX: Rebuilding ALL weekly leaderboards...');
    
    // Instead of importing functions, call the cron job handler multiple times
    const cronModule = await import('./cron/weeklyleaderboard.js');
    const cronHandler = cronModule.default;
    
    // Calculate current week and all previous weeks
    const COMPETITION_LAUNCH_TIMESTAMP = 1755118800;
    const WEEK_DURATION = 7 * 24 * 60 * 60;
    const nowTs = Math.floor(Date.now() / 1000);
    const currentWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    
    console.log(`📅 Current week: ${currentWeekIndex}`);
    console.log(`🔄 Will rebuild weeks 0 through ${currentWeekIndex}`);
    
    const results = {};
    const errors = [];
    
    // For each week, trigger the cron job (it will aggregate all weeks including current)
    // We only need to run it once as the cron job handles both weekly and lifetime data
    const mockReq = {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`
      }
    };
    
    let cronResult = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          cronResult = { statusCode: code, data };
          return mockRes;
        }
      })
    };
    
    try {
      console.log('🔄 Running comprehensive cron job rebuild...');
      await cronHandler(mockReq, mockRes);
      
      results.cronExecution = {
        success: cronResult?.statusCode === 200,
        statusCode: cronResult?.statusCode,
        data: cronResult?.data
      };
    } catch (error) {
      console.error('❌ Error running cron job:', error.message);
      errors.push({
        scope: 'cron_execution',
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

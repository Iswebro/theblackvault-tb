// pages/api/cron/health.js
// Health check endpoint to monitor cron job status and cache

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    // Get the last cron job summary
    const summary = await redis.get('referral-stats:summary');
    
    // Get sample cache data to verify it's working
    const defaultStats = await redis.get('referral-stats:default');
    const sampleUserKey = 'user-referrals:0xdee2027d2d42f11822f8bf448ed9e41556f360b3';
    const sampleUserData = await redis.get(sampleUserKey);
    
    const health = {
      timestamp: new Date().toISOString(),
      redis: {
        connected: true,
        summary: summary ? 'available' : 'missing',
        defaultStats: defaultStats ? 'available' : 'missing',
        sampleUserData: sampleUserData ? 'available' : 'missing'
      },
      lastCronRun: summary ? {
        timestamp: summary.lastRun,
        success: summary.defaultReferrerSuccess && summary.userStatsSuccess,
        executionTime: summary.executionTime,
        processedUsers: summary.processedUsers,
        totalReferrers: summary.totalReferrers
      } : null,
      cacheStatus: {
        hasDefaultStats: !!defaultStats,
        hasSampleUserData: !!sampleUserData,
        summaryAge: summary ? 
          Math.floor((Date.now() - new Date(summary.lastRun).getTime()) / 1000 / 60) + ' minutes' :
          'no data'
      }
    };
    
    // Determine overall health
    const isHealthy = summary && 
                     summary.defaultReferrerSuccess && 
                     summary.userStatsSuccess &&
                     defaultStats && 
                     sampleUserData;
    
    return res.status(isHealthy ? 200 : 503).json({
      healthy: isHealthy,
      ...health
    });
    
  } catch (error) {
    return res.status(500).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

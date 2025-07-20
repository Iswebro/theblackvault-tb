// pages/api/referral-stats.js
// Fast API endpoint to serve pre-computed referral stats from Upstash
// No expensive RPC calls - data is updated by background cron job

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { method, query } = req;
  
  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, type } = query;

  try {
    // Get default referrer stats
    if (type === 'default' || !user) {
      const defaultStats = await redis.get('referral-stats:default');
      if (!defaultStats) {
        return res.status(404).json({ 
          error: 'Default referrer stats not found',
          hint: 'Background job may not have run yet'
        });
      }
      
      return res.status(200).json({
        result: {
          stats: {
            totalReferrals: defaultStats.totalReferrals,
            uniqueReferrals: defaultStats.uniqueReferrals,
            totalRewards: defaultStats.totalRewards,
            availableRewards: defaultStats.availableRewards
          },
          lastUpdated: defaultStats.lastUpdated,
          contractAddress: defaultStats.contractAddress
        },
        cached: true,
        dataSource: 'background-job'
      });
    }
    
    // Get specific user stats
    if (user) {
      const allUserStats = await redis.get('referral-stats:users');
      if (!allUserStats || !allUserStats[user.toLowerCase()]) {
        return res.status(404).json({ 
          error: 'User stats not found',
          hint: 'User may not have referrals or background job may not have processed this user yet'
        });
      }
      
      const userStats = allUserStats[user.toLowerCase()];
      
      return res.status(200).json({
        result: userStats,
        cached: true,
        dataSource: 'background-job'
      });
    }
    
    // Get summary stats
    const summary = await redis.get('referral-stats:summary');
    
    return res.status(200).json({
      result: {
        summary: summary || { error: 'No summary available' },
        hasDefaultStats: !!(await redis.get('referral-stats:default')),
        hasUserStats: !!(await redis.get('referral-stats:users'))
      },
      cached: true,
      dataSource: 'background-job'
    });
    
  } catch (error) {
    console.error("❌ REFERRAL-STATS: Error fetching stats:", error);
    return res.status(500).json({
      error: 'Failed to fetch referral stats',
      details: error.message
    });
  }
}

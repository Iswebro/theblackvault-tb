// pages/api/debug-redis.js
// Debug endpoint to see what's stored in Redis

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed - use GET' });
  }

  try {
    console.log("🔍 DEBUG: Checking Redis contents...");
    
    // Get all keys
    const allKeys = await redis.keys('*');
    console.log("🔍 DEBUG: All Redis keys:", allKeys);
    
    const redisData = {};
    
    // Get all data
    for (const key of allKeys) {
      try {
        const data = await redis.get(key);
        redisData[key] = data;
        console.log(`🔍 DEBUG: Key "${key}":`, data);
      } catch (error) {
        redisData[key] = { error: error.message };
        console.error(`❌ DEBUG: Error getting key "${key}":`, error);
      }
    }
    
    // Check specific keys we expect
    const expectedKeys = [
      'referral-stats:default',
      'referral-stats:users', 
      'leaderboard:lifetime',
      'leaderboard:weekly:1'
    ];
    
    const expectedData = {};
    for (const key of expectedKeys) {
      try {
        expectedData[key] = await redis.get(key);
      } catch (error) {
        expectedData[key] = { error: error.message };
      }
    }
    
    return res.status(200).json({
      success: true,
      totalKeys: allKeys.length,
      allKeys,
      allData: redisData,
      expectedKeys,
      expectedData,
      hasDefaultStats: !!redisData['referral-stats:default'],
      hasUserStats: !!redisData['referral-stats:users'],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ DEBUG: Error checking Redis:", error);
    return res.status(500).json({
      error: 'Debug failed',
      details: error.message
    });
  }
}

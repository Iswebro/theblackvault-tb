// pages/api/inspect-upstash.js
// API endpoint to inspect what referral data is already stored in Upstash

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

  const { account, pattern } = query;

  try {
    const results = {};

    if (account) {
      // Check specific account data
      const keys = [
        `referrals:${account.toLowerCase()}`,
        `referrals:${account}`,
        `referee:${account.toLowerCase()}`,
        `referee:${account}`
      ];

      for (const key of keys) {
        try {
          const data = await redis.get(key);
          if (data) {
            results[key] = data;
          }
        } catch (e) {
          results[key] = `Error: ${e.message}`;
        }
      }
    } else {
      // Get all keys matching pattern
      const searchPattern = pattern || 'referrals:*';
      try {
        const keys = await redis.keys(searchPattern);
        console.log(`Found ${keys.length} keys matching pattern: ${searchPattern}`);
        
        // Limit to first 10 keys to avoid overwhelming response
        const limitedKeys = keys.slice(0, 10);
        
        for (const key of limitedKeys) {
          try {
            const data = await redis.get(key);
            results[key] = data;
          } catch (e) {
            results[key] = `Error: ${e.message}`;
          }
        }
        
        results._meta = {
          totalKeys: keys.length,
          showing: limitedKeys.length,
          pattern: searchPattern
        };
      } catch (e) {
        results._error = `Keys query failed: ${e.message}`;
      }
    }

    return res.status(200).json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ INSPECT: Error inspecting Upstash:", error);
    return res.status(500).json({
      error: 'Failed to inspect Upstash data',
      details: error.message
    });
  }
}

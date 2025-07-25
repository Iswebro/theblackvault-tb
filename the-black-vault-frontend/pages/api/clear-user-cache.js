// pages/api/clear-user-cache.js
// API endpoint to clear cached user data after transactions

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { method, query } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account } = query;
  
  if (!account || !ethers.isAddress(account)) {
    return res.status(400).json({ error: 'Valid account address required' });
  }

  try {
    // Clear both cache key variations (original case and lowercase)
    const cacheKeyLower = `user-referrals:${account.toLowerCase()}`;
    const cacheKeyOriginal = `user-referrals:${account}`;
    
    await Promise.all([
      redis.del(cacheKeyLower),
      redis.del(cacheKeyOriginal)
    ]);
    
    console.log(`🗑️ CACHE: Cleared user referral cache for ${account}`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ CACHE: Error clearing user cache:", error);
    return res.status(500).json({ 
      error: 'Failed to clear cache', 
      details: error.message 
    });
  }
}

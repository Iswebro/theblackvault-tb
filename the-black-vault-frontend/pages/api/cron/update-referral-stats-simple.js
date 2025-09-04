// pages/api/cron/update-referral-stats-simple.js
// Simple referral stats updater that works without complex blockchain scanning

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const RPC_URL = process.env.BSC_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';
const DEFAULT_REFERRER = '0x706961C676FE743C34A867437661D13E16ADCbEc';

const BLACK_VAULT_ABI = [
  "function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)",
  "function getReferralBonusInfo(address referrer, address referee) view returns (uint256 used, uint256 remaining)"
];

// Known active referrers (add more as needed)
const KNOWN_REFERRERS = [
  '0xB98e82C611BFc1b852412268fd300E28fAEE4D48', // The user who was missing
  '0xdee2027d2d42f11822f8bf448ed9e41556f360b3',
  DEFAULT_REFERRER
];

export default async function handler(req, res) {
  const { method } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log("🚀 SIMPLE CRON: Starting simple referral stats update...");
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
    
    // Test connection
    const network = await provider.getNetwork();
    console.log(`✅ SIMPLE CRON: Connected to ${network.name}`);
    
    const userStats = {};
    
    // Process known referrers
    for (const referrer of KNOWN_REFERRERS) {
      try {
        console.log(`🔍 SIMPLE CRON: Processing ${referrer}...`);
        
        const referralData = await contract.getUserReferralData(referrer);
        const totalReferrals = parseInt(referralData[2].toString());
        
        if (totalReferrals > 0) {
          console.log(`✅ SIMPLE CRON: ${referrer} has ${totalReferrals} referrals`);
          
          const stats = {
            contractAddress: referrer,
            totalRewards: ethers.formatEther(referralData[0] || 0),
            availableRewards: ethers.formatEther(referralData[1] || 0),
            totalReferrals: totalReferrals.toString(),
            uniqueReferrals: totalReferrals, // Use contract data
            totalVolume: ethers.formatEther(referralData[3] || 0),
            totalWithdrawn: ethers.formatEther(referralData[4] || 0),
            referrals: [], // Empty for now - would need blockchain scanning to fill
            lastUpdated: new Date().toISOString()
          };
          
          // Store in Redis
          const keyOriginal = `user-referrals:${referrer}`;
          const keyLower = `user-referrals:${referrer.toLowerCase()}`;
          await redis.set(keyOriginal, stats, { ex: 90000 });
          await redis.set(keyLower, stats, { ex: 90000 });
          
          userStats[referrer] = stats;
        }
        
        // Small delay between calls
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`⚠️ SIMPLE CRON: Error processing ${referrer}:`, error.message);
      }
    }
    
    // Store summary
    const summary = {
      processedUsers: Object.keys(userStats).length,
      knownReferrers: KNOWN_REFERRERS.length,
      lastRun: new Date().toISOString(),
      simple: true
    };
    
    await redis.set('referral-stats:summary', summary, { ex: 7200 });
    
    console.log(`✅ SIMPLE CRON: Updated ${Object.keys(userStats).length} referrers`);
    
    return res.status(200).json({
      success: true,
      summary,
      userStats
    });
    
  } catch (error) {
    console.error("❌ SIMPLE CRON: Error:", error);
    return res.status(500).json({
      error: 'Failed to update referral stats',
      details: error.message
    });
  }
}

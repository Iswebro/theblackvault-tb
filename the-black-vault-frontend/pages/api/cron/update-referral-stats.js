// pages/api/cron/update-referral-stats.js
// Background cron job to update referral statistics in Upstash
// This prevents expensive RPC calls on the frontend

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// RPC configuration
const RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';
const DEFAULT_REFERRER = '0x706961C676FE743C34A867437661D13E16ADCbEc';

// BlackVault ABI - only the parts we need
const BLACK_VAULT_ABI = [
  "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)",
  "function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)",
  "function getReferralBonusInfo(address referrer, address referee) view returns (uint256 used, uint256 remaining)"
];

// Helper function to query events with aggressive rate limiting
const queryEventsWithRetry = async (contract, filter, blockRanges = [-50000, -30000, -15000, -8000, -3000]) => {
  for (let i = 0; i < blockRanges.length; i++) {
    const blockRange = blockRanges[i];
    try {
      console.log(`🔍 CRON: Trying event query with ${Math.abs(blockRange)} block range...`);
      if (i > 0) {
        // Add longer delays between retries for background processing
        await new Promise(resolve => setTimeout(resolve, 2000 * i));
      }
      const events = await contract.queryFilter(filter, blockRange);
      console.log(`🔍 CRON: Successfully found ${events.length} events with ${Math.abs(blockRange)} range`);
      return events;
    } catch (error) {
      console.warn(`⚠️ CRON: Event query failed with ${Math.abs(blockRange)} range:`, error.message);
      if (i === blockRanges.length - 1) {
        console.error("❌ CRON: All event query attempts failed");
        return [];
      }
    }
  }
  return [];
};

// Get active users from recent deposit events (last 100k blocks)
const getActiveUsers = async (contract) => {
  try {
    console.log("🔍 CRON: Getting active users from recent deposits...");
    const depositFilter = contract.filters.Deposited();
    const depositEvents = await queryEventsWithRetry(contract, depositFilter, [-100000, -50000, -25000]);
    
    // Get unique users who have made deposits
    const uniqueUsers = [...new Set(depositEvents.map(event => event.args.user.toLowerCase()))];
    console.log(`🔍 CRON: Found ${uniqueUsers.length} unique active users`);
    
    // Also get unique referrers
    const uniqueReferrers = [...new Set(
      depositEvents
        .map(event => event.args.referrer.toLowerCase())
        .filter(referrer => referrer !== ethers.ZeroAddress.toLowerCase())
    )];
    console.log(`🔍 CRON: Found ${uniqueReferrers.length} unique referrers`);
    
    return { users: uniqueUsers.slice(0, 200), referrers: uniqueReferrers.slice(0, 100) }; // Limit to prevent excessive processing
  } catch (error) {
    console.error("❌ CRON: Error getting active users:", error);
    return { users: [], referrers: [] };
  }
};

// Update default referrer stats
const updateDefaultReferrerStats = async (contract) => {
  try {
    console.log("🔍 CRON: Updating default referrer stats...");
    
    // Get default referrer's contract data
    const defaultReferralData = await contract.getUserReferralData(DEFAULT_REFERRER);
    
    // Get deposit events for default referrer
    const defaultDepositFilter = contract.filters.Deposited(null, null, DEFAULT_REFERRER);
    const defaultDepositEvents = await queryEventsWithRetry(contract, defaultDepositFilter, [-100000, -50000, -25000]);
    
    const uniqueDefaultReferees = [...new Set(defaultDepositEvents.map(event => event.args.user.toLowerCase()))];
    
    const stats = {
      contractAddress: DEFAULT_REFERRER,
      totalRewards: ethers.formatEther(defaultReferralData[0] || 0),
      availableRewards: ethers.formatEther(defaultReferralData[1] || 0),
      totalReferrals: defaultReferralData[2]?.toString() || "0",
      uniqueReferrals: uniqueDefaultReferees.length,
      totalVolume: ethers.formatEther(defaultReferralData[3] || 0),
      totalWithdrawn: ethers.formatEther(defaultReferralData[4] || 0),
      lastUpdated: new Date().toISOString(),
      eventCount: defaultDepositEvents.length
    };
    
    // Store in Redis with 1 hour expiry
    await redis.set('referral-stats:default', stats, { ex: 3600 });
    console.log("✅ CRON: Default referrer stats updated");
    
    return stats;
  } catch (error) {
    console.error("❌ CRON: Error updating default referrer stats:", error);
    return null;
  }
};

// Update individual user stats
const updateUserStats = async (contract, users) => {
  const userStats = {};
  const batchSize = 10; // Process users in batches to avoid overwhelming RPC
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    console.log(`🔍 CRON: Processing user batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(users.length/batchSize)}`);
    
    await Promise.all(batch.map(async (user) => {
      try {
        // Get user's referral data from contract
        const referralData = await contract.getUserReferralData(user);
        
        // Only process users who have referrals
        if (parseInt(referralData[2].toString()) > 0) {
          // Get deposit events where this user is the referrer
          const depositFilter = contract.filters.Deposited(null, null, user);
          const depositEvents = await queryEventsWithRetry(contract, depositFilter, [-50000, -25000, -10000]);
          
          const uniqueReferees = [...new Set(depositEvents.map(event => event.args.user.toLowerCase()))];
          
          userStats[user] = {
            contractData: {
              totalRewards: ethers.formatEther(referralData[0] || 0),
              availableRewards: ethers.formatEther(referralData[1] || 0),
              referredCount: referralData[2]?.toString() || "0",
              totalVolume: ethers.formatEther(referralData[3] || 0),
              totalWithdrawn: ethers.formatEther(referralData[4] || 0),
            },
            events: {
              totalEvents: depositEvents.length,
              uniqueReferees: uniqueReferees.length,
            },
            stats: {
              totalReferralCount: referralData[2]?.toString() || "0",
              uniqueReferrals: uniqueReferees.length,
            },
            lastUpdated: new Date().toISOString()
          };
        }
        
        // Small delay between users to be gentle on RPC
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`⚠️ CRON: Error processing user ${user}:`, error.message);
      }
    }));
    
    // Delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Store all user stats in Redis with 30 minutes expiry
  if (Object.keys(userStats).length > 0) {
    await redis.set('referral-stats:users', userStats, { ex: 1800 });
    console.log(`✅ CRON: Updated stats for ${Object.keys(userStats).length} users`);
  }
  
  return userStats;
};

export default async function handler(req, res) {
  const { method } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (optional security)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log("🚀 CRON: Starting referral stats update job...");
    const startTime = Date.now();
    
    // Initialize provider and contract
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
    
    // Get active users and referrers
    const { users, referrers } = await getActiveUsers(contract);
    
    // Update default referrer stats
    const defaultStats = await updateDefaultReferrerStats(contract);
    
    // Update user stats for active referrers
    const userStats = await updateUserStats(contract, referrers);
    
    // Store summary stats
    const summary = {
      totalUsers: users.length,
      totalReferrers: referrers.length,
      processedUsers: Object.keys(userStats).length,
      defaultReferrerProcessed: !!defaultStats,
      lastRun: new Date().toISOString(),
      executionTime: Date.now() - startTime
    };
    
    await redis.set('referral-stats:summary', summary, { ex: 7200 }); // 2 hours
    
    console.log("✅ CRON: Referral stats update completed");
    console.log(`📊 CRON: Summary:`, summary);
    
    return res.status(200).json({
      success: true,
      summary,
      message: 'Referral stats updated successfully'
    });
    
  } catch (error) {
    console.error("❌ CRON: Error in referral stats update:", error);
    return res.status(500).json({
      error: 'Failed to update referral stats',
      details: error.message
    });
  }
}

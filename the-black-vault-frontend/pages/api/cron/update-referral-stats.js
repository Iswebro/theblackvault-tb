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
  "event DepositWithReferrer(address indexed user, uint256 amount, address indexed referrer)", // Alternative event name
  "function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)",
  "function getReferralBonusInfo(address referrer, address referee) view returns (uint256 used, uint256 remaining)"
];

// Helper function to query events with aggressive rate limiting - focusing on recent blocks
const queryEventsWithRetry = async (contract, filter, blockRanges = [-10000, -25000, -50000, -100000, -200000]) => {
  for (let i = 0; i < blockRanges.length; i++) {
    const blockRange = blockRanges[i];
    try {
      console.log(`🔍 CRON: Trying event query with ${Math.abs(blockRange)} block range...`);
      if (i > 0) {
        // Add longer delays between retries for background processing
        await new Promise(resolve => setTimeout(resolve, 1000 * i));
      }
      const events = await contract.queryFilter(filter, blockRange);
      console.log(`🔍 CRON: Successfully found ${events.length} events with ${Math.abs(blockRange)} range`);
      if (events.length > 0) {
        // Log some sample events for debugging
        console.log(`🔍 CRON: Sample event data:`, events.slice(0, 2).map(e => ({
          blockNumber: e.blockNumber,
          transactionHash: e.transactionHash,
          args: e.args ? {
            user: e.args.user,
            amount: e.args.amount?.toString(),
            referrer: e.args.referrer,
            cycle: e.args.cycle?.toString()
          } : 'No args'
        })));
      }
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

// Get active users from recent deposit events (last 25k blocks - about 20 hours on BSC)
const getActiveUsers = async (contract) => {
  try {
    console.log("🔍 CRON: Getting active users from recent deposits...");
    const depositFilter = contract.filters.Deposited();
    const depositEvents = await queryEventsWithRetry(contract, depositFilter, [-10000, -25000, -50000]);
    
    // Get unique users who have made deposits
    const uniqueUsers = [...new Set(depositEvents.map(event => event.args.user.toLowerCase()))];
    console.log(`🔍 CRON: Found ${uniqueUsers.length} unique active users from ${depositEvents.length} deposit events`);
    
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
    
    // Get ALL deposit events to analyze which ones used default referrer
    console.log("🔍 CRON: Getting all deposit events to analyze default referrer usage...");
    console.log("🔍 CRON: Contract address:", CONTRACT_ADDRESS);
    console.log("🔍 CRON: Default referrer:", DEFAULT_REFERRER);
    
    // First test - get current block number to verify connection
    const provider = contract.provider;
    const currentBlock = await provider.getBlockNumber();
    console.log("🔍 CRON: Current block number:", currentBlock);
    console.log("🔍 CRON: Network:", await provider.getNetwork());
    
    // Test contract connection by calling a simple view function
    try {
      const testCall = await contract.getUserReferralData(DEFAULT_REFERRER);
      console.log("🔍 CRON: Contract connection test successful - default referrer data:", {
        totalRewards: ethers.formatEther(testCall[0]),
        totalReferrals: testCall[2].toString()
      });
    } catch (contractError) {
      console.error("❌ CRON: Contract connection test failed:", contractError.message);
    }
    
    // Query both Deposited and DepositWithReferrer events, merge results
    const depositedFilter = contract.filters.Deposited();
    const depositWithRefFilter = contract.filters.DepositWithReferrer();
    console.log("🔍 CRON: Deposit filter created:", depositedFilter);
    console.log("🔍 CRON: DepositWithReferrer filter created:", depositWithRefFilter);
    console.log("🔍 CRON: Contract interface events:", Object.keys(contract.interface.events));

    // Query both event types in recent blocks
    let depositedEvents = await queryEventsWithRetry(contract, depositedFilter, [-10000, -25000, -50000, -100000]);
    let depositWithRefEvents = await queryEventsWithRetry(contract, depositWithRefFilter, [-10000, -25000, -50000, -100000]);

    // Merge all events
    let allDepositEvents = [...depositedEvents, ...depositWithRefEvents];
    console.log(`🔍 CRON: Found ${depositedEvents.length} Deposited events, ${depositWithRefEvents.length} DepositWithReferrer events, merged total: ${allDepositEvents.length}`);

    // If still no events, try broader range from deployment block
    if (allDepositEvents.length === 0) {
      console.log("🔍 CRON: Trying broader range from block 42296467 (approximate contract deployment)...");
      try {
        const fromBlock = 42296467; // Approximate deployment block
        depositedEvents = await contract.queryFilter(depositedFilter, fromBlock);
        depositWithRefEvents = await contract.queryFilter(depositWithRefFilter, fromBlock);
        allDepositEvents = [...depositedEvents, ...depositWithRefEvents];
        console.log(`🔍 CRON: Found ${allDepositEvents.length} events from deployment block`);
      } catch (broadError) {
        console.warn("⚠️ CRON: Broad range query also failed:", broadError.message);
      }
    }

    // If STILL no events, try even more recent blocks (last 10000 blocks)
    if (allDepositEvents.length === 0) {
      console.log("🔍 CRON: Trying very recent blocks (last 10000 - about 8 hours on BSC)...");
      try {
        depositedEvents = await contract.queryFilter(depositedFilter, -10000);
        depositWithRefEvents = await contract.queryFilter(depositWithRefFilter, -10000);
        allDepositEvents = [...depositedEvents, ...depositWithRefEvents];
        console.log(`🔍 CRON: Found ${allDepositEvents.length} events in last 10000 blocks`);
      } catch (recentError) {
        console.warn("⚠️ CRON: Recent blocks query also failed:", recentError.message);
      }
    }

    // Last resort: try to get ALL events without block filtering
    if (allDepositEvents.length === 0) {
      console.log("🔍 CRON: Last resort - trying to get ALL deposit events (no block limit)...");
      try {
        depositedEvents = await contract.queryFilter(depositedFilter);
        depositWithRefEvents = await contract.queryFilter(depositWithRefFilter);
        allDepositEvents = [...depositedEvents, ...depositWithRefEvents];
        console.log(`🔍 CRON: Found ${allDepositEvents.length} events with no block limit`);
      } catch (allEventsError) {
        console.warn("⚠️ CRON: All events query failed:", allEventsError.message);
      }
    }

    // Filter events where the referrer is the DEFAULT_REFERRER
    // This includes both explicit referrals AND automatic default assignments
    const defaultReferrerEvents = allDepositEvents.filter(event => 
      event.args.referrer && event.args.referrer.toLowerCase() === DEFAULT_REFERRER.toLowerCase()
    );

    // Get unique users who used default referrer (either explicitly or automatically)
    const uniqueDefaultReferees = [...new Set(defaultReferrerEvents.map(event => event.args.user.toLowerCase()))];

    console.log(`🔍 CRON: Found ${allDepositEvents.length} total deposit events (merged)`);
    console.log(`🔍 CRON: Found ${defaultReferrerEvents.length} events using default referrer`);
    console.log(`🔍 CRON: Found ${uniqueDefaultReferees.length} unique users using default referrer`);

    const stats = {
      contractAddress: DEFAULT_REFERRER,
      totalRewards: ethers.formatEther(defaultReferralData[0] || 0),
      availableRewards: ethers.formatEther(defaultReferralData[1] || 0),
      totalReferrals: defaultReferralData[2]?.toString() || "0",
      uniqueReferrals: uniqueDefaultReferees.length,
      totalVolume: ethers.formatEther(defaultReferralData[3] || 0),
      totalWithdrawn: ethers.formatEther(defaultReferralData[4] || 0),
      lastUpdated: new Date().toISOString(),
      eventCount: defaultReferrerEvents.length,
      debugInfo: {
        totalEvents: allDepositEvents.length,
        defaultReferrerEvents: defaultReferrerEvents.length,
        uniqueUsers: uniqueDefaultReferees.length
      }
    };

    // Store in Redis with 25 hour expiry (longer than daily cron interval)
    await redis.set('referral-stats:default', stats, { ex: 90000 });
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
  
  // Store all user stats in Redis with 25 hour expiry (longer than daily cron interval)
  if (Object.keys(userStats).length > 0) {
    await redis.set('referral-stats:users', userStats, { ex: 90000 });
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

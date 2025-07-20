// pages/api/user-referrals.js
// API endpoint to cache and serve user referral event data
// This helps reduce RPC rate limiting for the ReferralsModal

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// RPC configuration
const RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';

// BlackVault ABI - only the parts we need
const BLACK_VAULT_ABI = [
  "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)",
  "function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)",
  "function getReferralBonusInfo(address referrer, address referee) view returns (uint256 used, uint256 remaining)"
];

// Helper function to query events with rate limiting and retry logic
const queryEventsWithRetry = async (contract, filter, blockRanges = [-20000, -8000, -3000]) => {
  for (let i = 0; i < blockRanges.length; i++) {
    const blockRange = blockRanges[i];
    try {
      console.log(`🔍 USER-API: Trying event query with ${Math.abs(blockRange)}k block range...`);
      if (i > 0) {
        // Add delay between retries to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000 * i));
      }
      const events = await contract.queryFilter(filter, blockRange);
      console.log(`🔍 USER-API: Successfully found ${events.length} events with ${Math.abs(blockRange)}k range`);
      return events;
    } catch (error) {
      console.warn(`⚠️ USER-API: Event query failed with ${Math.abs(blockRange)}k range:`, error.message);
      if (i === blockRanges.length - 1) {
        console.error("❌ USER-API: All event query attempts failed");
        return [];
      }
    }
  }
  return [];
};

export default async function handler(req, res) {
  const { method, query } = req;
  
  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account } = query;
  
  if (!account || !ethers.isAddress(account)) {
    return res.status(400).json({ error: 'Valid account address required' });
  }

  // Cache key for user referral data
  const cacheKey = `user-referrals:${account.toLowerCase()}`;
  
  try {
    // Try to get cached result first (shorter cache time for user data)
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("🔍 USER-API: Returning cached user referral data for", account);
      return res.status(200).json({ 
        result: cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn("⚠️ USER-API: Cache read error:", e.message);
    // Continue to fetch fresh data
  }

  // Initialize provider and contract
  let provider, contract;
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
  } catch (error) {
    console.error("❌ USER-API: Failed to initialize provider/contract:", error);
    return res.status(500).json({ error: 'Failed to initialize blockchain connection' });
  }

  try {
    console.log("🔍 USER-API: Fetching fresh user referral data for:", account);
    
    // Get user's referral data from contract
    const referralData = await contract.getUserReferralData(account);
    console.log("🔍 USER-API: User referral contract data:", {
      totalRewards: referralData[0]?.toString(),
      availableRewards: referralData[1]?.toString(),
      referredCount: referralData[2]?.toString(),
      totalVolume: referralData[3]?.toString(),
      totalWithdrawn: referralData[4]?.toString(),
    });

    // Get deposit events where this user is the referrer
    const depositFilter = contract.filters.Deposited(null, null, account);
    const depositEvents = await queryEventsWithRetry(contract, depositFilter, [-20000, -8000, -3000]);
    
    console.log("🔍 USER-API: User deposit events found:", depositEvents.length);

    // Extract unique referee addresses
    const uniqueReferees = [...new Set(depositEvents.map((event) => event.args.user.toLowerCase()))];
    console.log("🔍 USER-API: Unique referees for user:", uniqueReferees.length);

    // Get bonus info for each referee (but limit to prevent too many RPC calls)
    const maxRefereesToProcess = 20; // Limit to prevent excessive RPC calls
    const refereesToProcess = uniqueReferees.slice(0, maxRefereesToProcess);
    
    const refereeData = await Promise.all(
      refereesToProcess.map(async (refereeAddress) => {
        try {
          const bonusInfo = await contract.getReferralBonusInfo(account, refereeAddress);
          return {
            address: refereeAddress,
            bonusesUsed: parseInt(bonusInfo.used.toString()),
            bonusesRemaining: parseInt(bonusInfo.remaining.toString()),
          };
        } catch (error) {
          console.warn(`⚠️ USER-API: Error getting bonus info for ${refereeAddress}:`, error.message);
          return {
            address: refereeAddress,
            bonusesUsed: 0,
            bonusesRemaining: 3,
          };
        }
      })
    );

    // Prepare result data
    const resultData = {
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
        processedReferees: refereesToProcess.length,
        truncated: uniqueReferees.length > maxRefereesToProcess
      },
      referrals: refereeData,
      stats: {
        totalReferralCount: referralData[2]?.toString() || "0",
        uniqueReferrals: uniqueReferees.length,
      },
      lastUpdated: new Date().toISOString()
    };

    // Cache the result for 3 minutes (180 seconds)
    try {
      await redis.set(cacheKey, resultData, { ex: 180 });
      console.log("🔍 USER-API: Cached user referral data for 3 minutes");
    } catch (e) {
      console.warn("⚠️ USER-API: Cache write error:", e.message);
      // Continue anyway
    }

    return res.status(200).json({ 
      result: resultData,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ USER-API: Error fetching user referral data:", error);
    return res.status(500).json({ 
      error: 'Failed to fetch user referral data', 
      details: error.message 
    });
  }
}

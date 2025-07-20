// pages/api/referrer-events.js
// API endpoint to cache and serve default referrer event data
// This helps reduce RPC rate limiting by caching expensive event queries

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
  "function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)"
];

// Helper function to query events with rate limiting and retry logic
const queryEventsWithRetry = async (contract, filter, blockRanges = [-20000, -8000, -3000]) => {
  for (let i = 0; i < blockRanges.length; i++) {
    const blockRange = blockRanges[i];
    try {
      console.log(`🔍 API: Trying event query with ${Math.abs(blockRange)}k block range...`);
      if (i > 0) {
        // Add delay between retries to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000 * i));
      }
      const events = await contract.queryFilter(filter, blockRange);
      console.log(`🔍 API: Successfully found ${events.length} events with ${Math.abs(blockRange)}k range`);
      return events;
    } catch (error) {
      console.warn(`⚠️ API: Event query failed with ${Math.abs(blockRange)}k range:`, error.message);
      if (i === blockRanges.length - 1) {
        console.error("❌ API: All event query attempts failed");
        return [];
      }
    }
  }
  return [];
};

export default async function handler(req, res) {
  const { method } = req;
  
  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Cache key for default referrer data
  const cacheKey = `default-referrer-events:${DEFAULT_REFERRER.toLowerCase()}`;
  
  try {
    // Try to get cached result first
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("🔍 API: Returning cached default referrer data");
      return res.status(200).json({ 
        result: cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn("⚠️ API: Cache read error:", e.message);
    // Continue to fetch fresh data
  }

  // Initialize provider and contract
  let provider, contract;
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
  } catch (error) {
    console.error("❌ API: Failed to initialize provider/contract:", error);
    return res.status(500).json({ error: 'Failed to initialize blockchain connection' });
  }

  try {
    console.log("🔍 API: Fetching fresh default referrer data...");
    
    // Get default referrer's referral data from contract
    const defaultReferralData = await contract.getUserReferralData(DEFAULT_REFERRER);
    console.log("🔍 API: Default referrer contract data:", {
      totalRewards: defaultReferralData[0]?.toString(),
      availableRewards: defaultReferralData[1]?.toString(),
      referredCount: defaultReferralData[2]?.toString(),
      totalVolume: defaultReferralData[3]?.toString(),
      totalWithdrawn: defaultReferralData[4]?.toString(),
    });

    // Get deposit events where default referrer is the referrer
    const defaultDepositFilter = contract.filters.Deposited(null, null, DEFAULT_REFERRER);
    const defaultDepositEvents = await queryEventsWithRetry(contract, defaultDepositFilter, [-20000, -8000, -3000]);
    
    console.log("🔍 API: Default referrer deposit events found:", defaultDepositEvents.length);

    // Extract unique referee addresses
    const uniqueDefaultReferees = [...new Set(defaultDepositEvents.map((event) => event.args.user.toLowerCase()))];
    console.log("🔍 API: Unique users referred by default referrer:", uniqueDefaultReferees.length);

    // Prepare result data
    const resultData = {
      contractData: {
        totalRewards: ethers.formatEther(defaultReferralData[0] || 0),
        availableRewards: ethers.formatEther(defaultReferralData[1] || 0),
        totalReferrals: defaultReferralData[2]?.toString() || "0",
        totalVolume: ethers.formatEther(defaultReferralData[3] || 0),
        totalWithdrawn: ethers.formatEther(defaultReferralData[4] || 0),
      },
      events: {
        totalEvents: defaultDepositEvents.length,
        uniqueReferees: uniqueDefaultReferees.length,
        uniqueAddresses: uniqueDefaultReferees,
      },
      stats: {
        totalReferrals: defaultReferralData[2]?.toString() || "0",
        uniqueReferrals: uniqueDefaultReferees.length,
        totalRewards: ethers.formatEther(defaultReferralData[0] || 0),
        availableRewards: ethers.formatEther(defaultReferralData[1] || 0)
      },
      lastUpdated: new Date().toISOString()
    };

    // Cache the result for 5 minutes (300 seconds) since this is expensive to compute
    try {
      await redis.set(cacheKey, resultData, { ex: 300 });
      console.log("🔍 API: Cached default referrer data for 5 minutes");
    } catch (e) {
      console.warn("⚠️ API: Cache write error:", e.message);
      // Continue anyway
    }

    return res.status(200).json({ 
      result: resultData,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ API: Error fetching default referrer data:", error);
    return res.status(500).json({ 
      error: 'Failed to fetch default referrer data', 
      details: error.message 
    });
  }
}

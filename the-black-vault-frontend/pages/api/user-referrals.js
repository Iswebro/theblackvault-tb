// pages/api/user-referrals.js
// API endpoint to cache and serve user referral event data
// This helps reduce RPC rate limiting for the ReferralsModal

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// RPC configuration with fallbacks for better reliability
const RPC_URLS = [
  process.env.BSC_RPC_URL || 'https://rpc.ankr.com/bsc/d074aa9b547a0e06b9e9b1bb3c78f25b6a9cf86b24c96f13b67bccb42c19fa22',
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
  'https://bsc-dataseed1.ninicoin.io/',
  'https://rpc.ankr.com/bsc'
];
const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';

// BlackVault ABI - only the parts we need
const BLACK_VAULT_ABI = [
  "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)",
  "function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)",
  "function getReferralBonusInfo(address referrer, address referee) view returns (uint256 used, uint256 remaining)"
];

// Helper function to query events with rate limiting and retry logic
const queryEventsWithRetry = async (contract, filter, blockRanges = [-50000, -30000, -15000, -8000, -3000]) => {
  for (let i = 0; i < blockRanges.length; i++) {
    const blockRange = blockRanges[i];
    try {
      console.log(`🔍 USER-API: Trying event query with ${Math.abs(blockRange)}k block range...`);
      if (i > 0) {
        // Add delay between retries to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500 * i));
      }
      const events = await contract.queryFilter(filter, blockRange);
      console.log(`🔍 USER-API: Successfully found ${events.length} events with ${Math.abs(blockRange)}k range`);
      return events;
    } catch (error) {
      console.warn(`⚠️ USER-API: Event query failed with ${Math.abs(blockRange)}k range:`, error.message);
      if (i === blockRanges.length - 1) {
        console.error("❌ USER-API: All event query attempts failed");
        // Try with even smaller range as last resort
        try {
          console.log("🔍 USER-API: Last resort - trying with 1000 block range...");
          const lastResortEvents = await contract.queryFilter(filter, -1000);
          console.log(`🔍 USER-API: Last resort found ${lastResortEvents.length} events`);
          return lastResortEvents;
        } catch (lastError) {
          console.error("❌ USER-API: Even last resort failed:", lastError.message);
          return [];
        }
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

  // Cache keys for user referral data (both cases)
  const cacheKeyLower = `user-referrals:${account.toLowerCase()}`;
  const cacheKeyOriginal = `user-referrals:${account}`;

  try {
    // Try to get cached result from both keys (prefer original-case if both exist and are different)
    const [cachedLower, cachedOriginal] = await Promise.all([
      redis.get(cacheKeyLower),
      redis.get(cacheKeyOriginal)
    ]);
    if (cachedOriginal) {
      console.log("🔍 USER-API: Returning cached user referral data for (original-case)", account);
      return res.status(200).json({ 
        result: cachedOriginal,
        cached: true,
        timestamp: new Date().toISOString()
      });
    } else if (cachedLower) {
      console.log("🔍 USER-API: Returning cached user referral data for (lowercase)", account);
      return res.status(200).json({ 
        result: cachedLower,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn("⚠️ USER-API: Cache read error:", e.message);
    // Continue to fetch fresh data
  }

  // Initialize provider and contract with fallback RPC URLs
  let provider, contract;
  let providerInitialized = false;
  
  for (let i = 0; i < RPC_URLS.length && !providerInitialized; i++) {
    try {
      console.log(`🔍 USER-API: Trying RPC ${i + 1}/${RPC_URLS.length}: ${RPC_URLS[i]}`);
      provider = new ethers.JsonRpcProvider(RPC_URLS[i]);
      
      // Test the connection
      await provider.getBlockNumber();
      
      contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
      providerInitialized = true;
      console.log(`✅ USER-API: Successfully connected to RPC ${i + 1}`);
    } catch (error) {
      console.warn(`⚠️ USER-API: RPC ${i + 1} failed:`, error.message);
      if (i === RPC_URLS.length - 1) {
        console.error("❌ USER-API: All RPC providers failed");
        return res.status(500).json({ error: 'Failed to initialize blockchain connection' });
      }
    }
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
    console.log("🔍 USER-API: Querying deposit events for referrer:", account);
    const depositFilter = contract.filters.Deposited(null, null, account);
    
    // Try multiple strategies to get events
    let depositEvents = [];
    
    // Strategy 1: Try with extended block ranges
    depositEvents = await queryEventsWithRetry(contract, depositFilter, [-50000, -30000, -15000, -8000, -3000]);
    
    // Strategy 2: If we found fewer events than the contract says, try querying much further back
    if (depositEvents.length < parseInt(referralData[2].toString()) / 3) { // If we found less than 1/3 of expected referrals
      console.log(`🔍 USER-API: Found only ${depositEvents.length} events but contract shows ${referralData[2].toString()} referrals`);
      console.log("🔍 USER-API: Trying extended historical search...");
      
      try {
        const currentBlock = await provider.getBlockNumber();
        const chunkSize = 10000;
        const maxBlocks = 500000; // Go back up to 500k blocks (several months of history)
        let foundInExtendedSearch = 0;
        
        for (let startBlock = currentBlock - chunkSize; startBlock > currentBlock - maxBlocks; startBlock -= chunkSize) {
          try {
            const endBlock = startBlock + chunkSize;
            const chunkEvents = await contract.queryFilter(depositFilter, startBlock, endBlock);
            if (chunkEvents.length > 0) {
              // Add new events (avoid duplicates)
              const existingTxHashes = new Set(depositEvents.map(e => e.transactionHash));
              const newEvents = chunkEvents.filter(e => !existingTxHashes.has(e.transactionHash));
              depositEvents.push(...newEvents);
              foundInExtendedSearch += newEvents.length;
              console.log(`✅ USER-API: Found ${newEvents.length} new events in chunk (total: ${depositEvents.length})`);
            }
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Stop if we found most of the expected referrals
            if (depositEvents.length >= parseInt(referralData[2].toString()) * 0.8) {
              console.log("🔍 USER-API: Found sufficient events, stopping extended search");
              break;
            }
          } catch (chunkError) {
            console.warn(`⚠️ USER-API: Extended chunk query failed:`, chunkError.message);
            // Continue with next chunk
          }
        }
        
        console.log(`🔍 USER-API: Extended search found ${foundInExtendedSearch} additional events`);
      } catch (extendedError) {
        console.warn("⚠️ USER-API: Extended search failed:", extendedError.message);
      }
    }
    
    console.log("🔍 USER-API: Total deposit events found:", depositEvents.length);

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

    // Cache the result for 3 minutes (180 seconds) to both keys
    try {
      await Promise.all([
        redis.set(cacheKeyLower, resultData, { ex: 180 }),
        redis.set(cacheKeyOriginal, resultData, { ex: 180 })
      ]);
      console.log("🔍 USER-API: Cached user referral data for 3 minutes to both keys");
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

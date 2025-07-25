// pages/api/user-referrals-v2.js
// Enhanced API endpoint that prioritizes Upstash stored referral data
// Falls back to blockchain queries only if needed

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// RPC configuration with fallbacks
const RPC_URLS = [
  process.env.BSC_RPC_URL || 'https://rpc.ankr.com/bsc/d074aa9b547a0e06b9e9b1bb3c78f25b6a9cf86b24c96f13b67bccb42c19fa22',
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
  'https://rpc.ankr.com/bsc'
];

const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';
const BLACK_VAULT_ABI = [
  "function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)",
  "function getReferralBonusInfo(address referrer, address referee) view returns (uint256 used, uint256 remaining)"
];

export default async function handler(req, res) {
  const { method, query } = req;
  
  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account } = query;
  
  if (!account || !ethers.isAddress(account)) {
    return res.status(400).json({ error: 'Valid account address required' });
  }

  // Cache keys for processed user referral data
  const cacheKeyLower = `user-referrals-v2:${account.toLowerCase()}`;
  const cacheKeyOriginal = `user-referrals-v2:${account}`;

  try {
    // Try to get cached result
    const [cachedLower, cachedOriginal] = await Promise.all([
      redis.get(cacheKeyLower).catch(() => null),
      redis.get(cacheKeyOriginal).catch(() => null)
    ]);
    
    if (cachedOriginal) {
      console.log("🔍 USER-API-V2: Returning cached user referral data (original-case)", account);
      return res.status(200).json({ 
        result: cachedOriginal,
        cached: true,
        timestamp: new Date().toISOString()
      });
    } else if (cachedLower) {
      console.log("🔍 USER-API-V2: Returning cached user referral data (lowercase)", account);
      return res.status(200).json({ 
        result: cachedLower,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn("⚠️ USER-API-V2: Cache read error:", e.message);
  }

  // Initialize provider and contract
  let provider, contract;
  let providerInitialized = false;
  
  for (let i = 0; i < RPC_URLS.length && !providerInitialized; i++) {
    try {
      provider = new ethers.JsonRpcProvider(RPC_URLS[i]);
      await provider.getBlockNumber(); // Test connection
      contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
      providerInitialized = true;
      console.log(`✅ USER-API-V2: Connected to RPC ${i + 1}`);
    } catch (error) {
      console.warn(`⚠️ USER-API-V2: RPC ${i + 1} failed:`, error.message);
      if (i === RPC_URLS.length - 1) {
        return res.status(500).json({ error: 'Failed to initialize blockchain connection' });
      }
    }
  }

  try {
    console.log("🔍 USER-API-V2: Fetching fresh user referral data for:", account);
    
    // Get user's referral data from contract
    const referralData = await contract.getUserReferralData(account);
    console.log("🔍 USER-API-V2: Contract referral data:", {
      totalRewards: referralData[0]?.toString(),
      availableRewards: referralData[1]?.toString(),
      referredCount: referralData[2]?.toString(),
      totalVolume: referralData[3]?.toString(),
      totalWithdrawn: referralData[4]?.toString(),
    });

    // Get stored referrals from Upstash
    let storedReferrals = [];
    let uniqueReferees = [];
    let referralDetails = [];

    try {
      const referrerKey = `referrals:${account.toLowerCase()}`;
      storedReferrals = await redis.get(referrerKey) || [];
      console.log(`🔍 USER-API-V2: Found ${storedReferrals.length} stored referrals in Upstash`);

      if (storedReferrals.length > 0) {
        // Extract unique referees
        uniqueReferees = [...new Set(storedReferrals.map(ref => ref.referee.toLowerCase()))];
        console.log(`🔍 USER-API-V2: Unique referees from Upstash: ${uniqueReferees.length}`);

        // Get bonus info for each referee
        referralDetails = await Promise.all(
          uniqueReferees.slice(0, 25).map(async (refereeAddress) => { // Limit to 25 to avoid RPC overload
            try {
              const bonusInfo = await contract.getReferralBonusInfo(account, refereeAddress);
              
              // Find all deposits from this referee
              const refereeDeposits = storedReferrals.filter(ref => ref.referee.toLowerCase() === refereeAddress);
              
              return {
                address: refereeAddress,
                bonusesUsed: parseInt(bonusInfo.used.toString()),
                bonusesRemaining: parseInt(bonusInfo.remaining.toString()),
                depositCount: refereeDeposits.length,
                totalDeposited: refereeDeposits.reduce((sum, dep) => sum + parseFloat(dep.depositAmount || 0), 0),
                firstDeposit: refereeDeposits[0]?.timestamp,
                lastDeposit: refereeDeposits[refereeDeposits.length - 1]?.timestamp
              };
            } catch (error) {
              console.warn(`⚠️ USER-API-V2: Error getting bonus info for ${refereeAddress}:`, error.message);
              return {
                address: refereeAddress,
                bonusesUsed: 0,
                bonusesRemaining: 3,
                depositCount: storedReferrals.filter(ref => ref.referee.toLowerCase() === refereeAddress).length,
                totalDeposited: 0,
                firstDeposit: null,
                lastDeposit: null
              };
            }
          })
        );
      }
    } catch (upstashError) {
      console.warn("⚠️ USER-API-V2: Error fetching from Upstash:", upstashError.message);
      // Continue with empty data
    }

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
        totalEvents: storedReferrals.length,
        uniqueReferees: uniqueReferees.length,
        processedReferees: referralDetails.length,
        truncated: uniqueReferees.length > 25,
        source: "upstash"
      },
      referrals: referralDetails,
      stats: {
        totalReferralCount: referralData[2]?.toString() || "0",
        uniqueReferrals: uniqueReferees.length,
        storedReferrals: storedReferrals.length
      },
      lastUpdated: new Date().toISOString()
    };

    // Cache the result for 2 minutes (120 seconds)
    try {
      await Promise.all([
        redis.set(cacheKeyLower, resultData, { ex: 120 }),
        redis.set(cacheKeyOriginal, resultData, { ex: 120 })
      ]);
      console.log("🔍 USER-API-V2: Cached user referral data for 2 minutes");
    } catch (e) {
      console.warn("⚠️ USER-API-V2: Cache write error:", e.message);
    }

    return res.status(200).json({ 
      result: resultData,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ USER-API-V2: Error fetching user referral data:", error);
    return res.status(500).json({ 
      error: 'Failed to fetch user referral data', 
      details: error.message 
    });
  }
}

// pages/api/test-referral-job.js
// Manual test endpoint to trigger background job and debug data storage

import { ethers } from 'ethers';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
const DEFAULT_REFERRER = "0x706961C676FE743C34A867437661D13E16ADCbEc";

const ABI = [
  "function getUserReferralData(address user) external view returns (uint256 totalEarnings, uint256 availableEarnings, uint256 referralCount, uint256 totalVolume, uint256 totalWithdrawn)",
  "event Deposited(address indexed user, uint256 amount, address referredBy, bool referralBonus, uint256 vaultTotal)",
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed - use POST' });
  }

  try {
    console.log("🧪 TEST: Starting manual referral job test");
    
    // Set up provider and contract
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    console.log("🧪 TEST: Getting default referrer data...");
    
    // Get default referrer data
    const defaultReferralData = await contract.getUserReferralData(DEFAULT_REFERRER);
    console.log("🧪 TEST: Default referrer raw data:", defaultReferralData);
    
    // Get a few recent deposit events for testing
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(currentBlock - 1000, 42296467); // Last 1000 blocks or since launch
    
    console.log(`🧪 TEST: Querying events from block ${fromBlock} to ${currentBlock}`);
    
    const events = await contract.queryFilter(
      contract.filters.Deposited(),
      fromBlock,
      currentBlock
    );
    
    console.log(`🧪 TEST: Found ${events.length} deposit events`);
    
    // Filter events with default referrer
    const defaultReferrerEvents = events.filter(event => 
      event.args.referredBy.toLowerCase() === DEFAULT_REFERRER.toLowerCase()
    );
    
    console.log(`🧪 TEST: Found ${defaultReferrerEvents.length} events for default referrer`);
    
    // Get unique referees
    const uniqueReferees = [...new Set(defaultReferrerEvents.map(event => 
      event.args.user.toLowerCase()
    ))];
    
    console.log(`🧪 TEST: Unique referees: ${uniqueReferees.length}`);
    
    // Create stats object
    const stats = {
      totalReferrals: defaultReferralData[2]?.toString() || "0",
      uniqueReferrals: uniqueReferees.length,
      totalRewards: ethers.formatEther(defaultReferralData[0] || 0),
      availableRewards: ethers.formatEther(defaultReferralData[1] || 0),
      totalVolume: ethers.formatEther(defaultReferralData[3] || 0),
      totalWithdrawn: ethers.formatEther(defaultReferralData[4] || 0),
      lastUpdated: new Date().toISOString(),
      eventCount: defaultReferrerEvents.length
    };
    
    console.log("🧪 TEST: Computed stats:", stats);
    
    // Store in Redis
    console.log("🧪 TEST: Storing in Redis...");
    await redis.set('referral-stats:default', stats, { ex: 90000 });
    
    // Verify storage
    const stored = await redis.get('referral-stats:default');
    console.log("🧪 TEST: Verified stored data:", stored);
    
    // List all keys in Redis to see what's there
    const allKeys = await redis.keys('*');
    console.log("🧪 TEST: All Redis keys:", allKeys);
    
    return res.status(200).json({
      success: true,
      stats,
      storedData: stored,
      eventsFound: events.length,
      defaultReferrerEvents: defaultReferrerEvents.length,
      uniqueReferees: uniqueReferees.length,
      allRedisKeys: allKeys,
      message: 'Test completed successfully'
    });
    
  } catch (error) {
    console.error("❌ TEST: Error:", error);
    return res.status(500).json({
      error: 'Test failed',
      details: error.message,
      stack: error.stack
    });
  }
}

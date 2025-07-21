// pages/api/leaderboard/populate.js
// Populate leaderboard from blockchain historical data using Ankr
// Usage: POST /api/leaderboard/populate

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Contract addresses and configuration
const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
const ANKR_RPC_URL = "https://rpc.ankr.com/bsc/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4";

// Helper to get current week index
function getCurrentWeekIndex() {
  const LAUNCH_TIMESTAMP = 1751490000; // 3 July 2025 07:00 AEST (UTC+10)
  const WEEK_DURATION = 7 * 24 * 60 * 60;
  const nowTs = Math.floor(Date.now() / 1000);
  return Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION);
}

function getWeekIndexFromTimestamp(timestamp) {
  const LAUNCH_TIMESTAMP = 1751490000;
  const WEEK_DURATION = 7 * 24 * 60 * 60;
  return Math.floor((timestamp - LAUNCH_TIMESTAMP) / WEEK_DURATION);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log("🔍 Starting leaderboard population from blockchain data...");

    // Initialize provider using Ankr
    const provider = new ethers.JsonRpcProvider(ANKR_RPC_URL);
    
    // Get current block for range limiting
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000); // Last ~500k blocks for full history

    console.log("📊 Scanning blocks:", fromBlock, "to", currentBlock);

    // Create contract interface for event filtering
    const contractInterface = new ethers.Interface([
      "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)"
    ]);

    // Query all Deposited events to calculate referral rewards
    const depositFilter = {
      address: CONTRACT_ADDRESS,
      topics: [
        contractInterface.getEvent('Deposited').topicHash,
        null, // user address (any)
        null  // referrer address (any, will filter out zero address)
      ],
      fromBlock: fromBlock,
      toBlock: 'latest'
    };

    const depositLogs = await provider.getLogs(depositFilter);
    console.log(`📊 Found ${depositLogs.length} deposit events`);

    // Initialize leaderboard data structures
    const lifetimeLeaderboard = new Map();
    const weeklyLeaderboards = new Map();

    // Process deposits to calculate referral rewards
    for (const log of depositLogs) {
      try {
        const decoded = contractInterface.parseLog(log);
        const block = await provider.getBlock(log.blockNumber);
        
        const referrer = decoded.args.referrer;
        const depositAmount = decoded.args.amount;
        const timestamp = block.timestamp;
        
        // Skip if no referrer or referrer is zero address
        if (!referrer || referrer === ethers.ZeroAddress) {
          continue;
        }
        
        // Calculate referral reward (10% of deposit)
        const referralReward = (depositAmount * BigInt(10)) / BigInt(100);
        const referrerAddr = referrer.toLowerCase();
        
        // Update lifetime leaderboard
        if (lifetimeLeaderboard.has(referrerAddr)) {
          const current = lifetimeLeaderboard.get(referrerAddr);
          lifetimeLeaderboard.set(referrerAddr, {
            address: referrerAddr,
            totalRewards: (BigInt(current.totalRewards) + referralReward).toString()
          });
        } else {
          lifetimeLeaderboard.set(referrerAddr, {
            address: referrerAddr,
            totalRewards: referralReward.toString()
          });
        }
        
        // Update weekly leaderboard
        const weekIndex = getWeekIndexFromTimestamp(timestamp);
        if (weekIndex >= 0) { // Only process weeks after launch
          const weekKey = `week_${weekIndex}`;
          
          if (!weeklyLeaderboards.has(weekKey)) {
            weeklyLeaderboards.set(weekKey, new Map());
          }
          
          const weeklyBoard = weeklyLeaderboards.get(weekKey);
          if (weeklyBoard.has(referrerAddr)) {
            const current = weeklyBoard.get(referrerAddr);
            weeklyBoard.set(referrerAddr, {
              address: referrerAddr,
              totalRewards: (BigInt(current.totalRewards) + referralReward).toString()
            });
          } else {
            weeklyBoard.set(referrerAddr, {
              address: referrerAddr,
              totalRewards: referralReward.toString()
            });
          }
        }
      } catch (e) {
        console.warn("⚠️ Error processing deposit log:", e.message);
      }
    }

    // Convert lifetime leaderboard to sorted array
    const lifetimeArray = Array.from(lifetimeLeaderboard.values());
    lifetimeArray.sort((a, b) => {
      const aRewards = BigInt(a.totalRewards);
      const bRewards = BigInt(b.totalRewards);
      if (bRewards > aRewards) return 1;
      if (bRewards < aRewards) return -1;
      return 0;
    });
    lifetimeArray.forEach((entry, i) => (entry.rank = i + 1));

    // Save lifetime leaderboard
    await redis.set('leaderboard:lifetime', lifetimeArray);
    console.log(`💾 Saved lifetime leaderboard with ${lifetimeArray.length} entries`);

    // Convert and save weekly leaderboards
    let weeksSaved = 0;
    for (const [weekKey, weeklyBoard] of weeklyLeaderboards.entries()) {
      const weekIndex = parseInt(weekKey.split('_')[1]);
      const weeklyArray = Array.from(weeklyBoard.values());
      
      weeklyArray.sort((a, b) => {
        const aRewards = BigInt(a.totalRewards);
        const bRewards = BigInt(b.totalRewards);
        if (bRewards > aRewards) return 1;
        if (bRewards < aRewards) return -1;
        return 0;
      });
      weeklyArray.forEach((entry, i) => (entry.rank = i + 1));
      
      await redis.set(`leaderboard:weekly:${weekIndex}`, weeklyArray);
      weeksSaved++;
    }
    
    console.log(`💾 Saved ${weeksSaved} weekly leaderboards`);

    return res.status(200).json({ 
      success: true,
      message: 'Leaderboard populated from blockchain data',
      lifetimeEntries: lifetimeArray.length,
      weeksSaved: weeksSaved,
      blocksScanned: currentBlock - fromBlock
    });

  } catch (error) {
    console.error("❌ Error populating leaderboard:", error);
    return res.status(500).json({ error: 'Failed to populate leaderboard' });
  }
}

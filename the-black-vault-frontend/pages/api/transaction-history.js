// pages/api/transaction-history.js
// Reliable transaction history API using Ankr for blockchain data
// Usage: /api/transaction-history?wallet=0x...

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Contract addresses and configuration
const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const ANKR_RPC_URL = "https://rpc.ankr.com/bsc/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4"; // BSC-specific endpoint with API key

export default async function handler(req, res) {
  const { wallet } = req.query;

  if (!wallet) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }

  if (!ethers.isAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  // Create cache key for this wallet
  const cacheKey = `tx-history:${wallet.toLowerCase()}`;
  
  // Try to get cached result (cache for 2 minutes for real-time feeling)
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("📋 Returning cached transaction history for:", wallet);
      return res.status(200).json({ 
        result: cached,
        source: 'cache'
      });
    }
  } catch (e) {
    console.warn("⚠️ Cache read error:", e.message);
    // Continue to fetch fresh data
  }

  try {
    console.log("🔍 Fetching fresh transaction history using Ankr for wallet:", wallet);

    // Initialize provider using Ankr
    const provider = new ethers.JsonRpcProvider(ANKR_RPC_URL);

    // Get current block for range limiting
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 200000); // Last ~200k blocks (about 7 days on BSC)

    console.log("📊 Searching blocks:", fromBlock, "to", currentBlock);

    // Create contract instance for event filtering
    // Note: Both deposit() and depositWithReferrer() emit the same "Deposited" event
    const contractInterface = new ethers.Interface([
      "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)",
      "event RewardsWithdrawn(address indexed user, uint256 amount, uint256 cycle)",
      "event ReferralRewardsWithdrawn(address indexed user, uint256 amount)"
    ]);

    // Query contract events for this user
    const depositFilter = {
      address: CONTRACT_ADDRESS,
      topics: [
        contractInterface.getEvent('Deposited').topicHash,
        ethers.zeroPadValue(wallet, 32) // user address in topic[1]
      ],
      fromBlock: fromBlock,
      toBlock: 'latest'
    };

    const withdrawRewardsFilter = {
      address: CONTRACT_ADDRESS,
      topics: [
        contractInterface.getEvent('RewardsWithdrawn').topicHash,
        ethers.zeroPadValue(wallet, 32) // user address in topic[1]
      ],
      fromBlock: fromBlock,
      toBlock: 'latest'
    };

    const withdrawReferralFilter = {
      address: CONTRACT_ADDRESS,
      topics: [
        contractInterface.getEvent('ReferralRewardsWithdrawn').topicHash,
        ethers.zeroPadValue(wallet, 32) // user address in topic[1]
      ],
      fromBlock: fromBlock,
      toBlock: 'latest'
    };

    // Fetch all relevant events
    const [depositLogs, withdrawRewardsLogs, withdrawReferralLogs] = await Promise.all([
      provider.getLogs(depositFilter),
      provider.getLogs(withdrawRewardsFilter),
      provider.getLogs(withdrawReferralFilter)
    ]);

    console.log(`📊 Found events: ${depositLogs.length} deposits, ${withdrawRewardsLogs.length} reward withdrawals, ${withdrawReferralLogs.length} referral withdrawals`);

    // Process and format transactions
    const transactions = [];

    // Process deposits
    for (const log of depositLogs) {
      try {
        const decoded = contractInterface.parseLog(log);
        const block = await provider.getBlock(log.blockNumber);
        
        transactions.push({
          type: 'Deposit',
          amount: ethers.formatEther(decoded.args.amount),
          time: new Date(block.timestamp * 1000),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          referrer: decoded.args.referrer,
          cycle: Number(decoded.args.cycle)
        });
      } catch (e) {
        console.warn("⚠️ Error processing deposit log:", e.message);
      }
    }

    // Process reward withdrawals
    for (const log of withdrawRewardsLogs) {
      try {
        const decoded = contractInterface.parseLog(log);
        const block = await provider.getBlock(log.blockNumber);
        
        transactions.push({
          type: 'Withdraw Rewards',
          amount: ethers.formatEther(decoded.args.amount),
          time: new Date(block.timestamp * 1000),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          cycle: Number(decoded.args.cycle)
        });
      } catch (e) {
        console.warn("⚠️ Error processing withdraw rewards log:", e.message);
      }
    }

    // Process referral withdrawals
    for (const log of withdrawReferralLogs) {
      try {
        const decoded = contractInterface.parseLog(log);
        const block = await provider.getBlock(log.blockNumber);
        
        transactions.push({
          type: 'Withdraw Referral',
          amount: ethers.formatEther(decoded.args.amount),
          time: new Date(block.timestamp * 1000),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber
        });
      } catch (e) {
        console.warn("⚠️ Error processing withdraw referral log:", e.message);
      }
    }

    // Sort by time (newest first)
    transactions.sort((a, b) => b.time.getTime() - a.time.getTime());

    console.log(`✅ Processed ${transactions.length} total transactions`);

    // Cache the result (cache for 2 minutes)
    try {
      await redis.set(cacheKey, transactions, { ex: 120 });
      console.log("💾 Cached transaction history for 2 minutes");
    } catch (e) {
      console.warn("⚠️ Cache write error:", e.message);
      // Continue without caching
    }

    return res.status(200).json({ 
      result: transactions,
      source: 'live',
      blockRange: `${fromBlock}-${currentBlock}`
    });

  } catch (error) {
    console.error("❌ Error fetching transaction history:", error);
    
    // Return empty result on error instead of failing completely
    return res.status(200).json({ 
      result: [],
      error: error.message,
      source: 'error'
    });
  }
}

// pages/api/transaction-history.js
// Reliable transaction history API using Ankr for blockchain data
// Usage: /api/transaction-history?wallet=0x...&page=1&limit=20

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
  const { wallet, page = '1', limit = '20' } = req.query;

  if (!wallet) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }

  if (!ethers.isAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page

  // Create cache key for ALL transactions (not paginated cache)
  const cacheKey = `tx-history-all:${wallet.toLowerCase()}`;
  
  // Try to get cached result (cache for 5 minutes)
  let allTransactions = null;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("📋 Using cached transaction history for:", wallet);
      allTransactions = cached;
    }
  } catch (e) {
    console.warn("⚠️ Cache read error:", e.message);
    // Continue to fetch fresh data
  }

  // If not cached, fetch from blockchain
  if (!allTransactions) {
    allTransactions = []; // Initialize empty array
    try {
      console.log("🔍 Fetching fresh transaction history using Ankr for wallet:", wallet);

      // Initialize provider using Ankr
      // Initialize provider using Ankr
      const provider = new ethers.JsonRpcProvider(ANKR_RPC_URL);

      // Get current block for range limiting
      const currentBlock = await provider.getBlockNumber();
      // Increase range to cover more history (about 2-3 months on BSC)
      const fromBlock = Math.max(0, currentBlock - 2000000); // Last ~2M blocks

      console.log("📊 Searching blocks:", fromBlock, "to", currentBlock, "(~2-3 months)");

      // Create contract instance for event filtering
      const contractInterface = new ethers.Interface([
        "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)",
        "event RewardsWithdrawn(address indexed user, uint256 amount, uint256 cycle)",
        "event ReferralRewardsWithdrawn(address indexed user, uint256 amount)"
      ]);

      // Query contract events for this user in smaller chunks to avoid timeouts
      const chunkSize = 500000; // 500k blocks per chunk
      const allTransactionsSet = new Set(); // Use Set to avoid duplicates
      
      for (let start = fromBlock; start <= currentBlock; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, currentBlock);
        console.log(`📊 Searching chunk: ${start} to ${end}`);
        
        try {
          const depositFilter = {
            address: CONTRACT_ADDRESS,
            topics: [
              contractInterface.getEvent('Deposited').topicHash,
              ethers.zeroPadValue(wallet, 32)
            ],
            fromBlock: start,
            toBlock: end
          };

          const withdrawRewardsFilter = {
            address: CONTRACT_ADDRESS,
            topics: [
              contractInterface.getEvent('RewardsWithdrawn').topicHash,
              ethers.zeroPadValue(wallet, 32)
            ],
            fromBlock: start,
            toBlock: end
          };

          const withdrawReferralFilter = {
            address: CONTRACT_ADDRESS,
            topics: [
              contractInterface.getEvent('ReferralRewardsWithdrawn').topicHash,
              ethers.zeroPadValue(wallet, 32)
            ],
            fromBlock: start,
            toBlock: end
          };

          // Fetch chunk events
          const [depositLogs, withdrawRewardsLogs, withdrawReferralLogs] = await Promise.all([
            provider.getLogs(depositFilter),
            provider.getLogs(withdrawRewardsFilter),
            provider.getLogs(withdrawReferralFilter)
          ]);

          // Process deposits
          for (const log of depositLogs) {
            try {
              const decoded = contractInterface.parseLog(log);
              const block = await provider.getBlock(log.blockNumber);
              
              const txKey = `${log.transactionHash}-deposit`;
              if (!allTransactionsSet.has(txKey)) {
                allTransactionsSet.add(txKey);
                allTransactions.push({
                  type: 'Deposit',
                  amount: ethers.formatEther(decoded.args.amount),
                  time: new Date(block.timestamp * 1000),
                  txHash: log.transactionHash,
                  blockNumber: log.blockNumber,
                  referrer: decoded.args.referrer,
                  cycle: Number(decoded.args.cycle)
                });
              }
            } catch (e) {
              console.warn("⚠️ Error processing deposit log:", e.message);
            }
          }

          // Process reward withdrawals
          for (const log of withdrawRewardsLogs) {
            try {
              const decoded = contractInterface.parseLog(log);
              const block = await provider.getBlock(log.blockNumber);
              
              const txKey = `${log.transactionHash}-withdraw`;
              if (!allTransactionsSet.has(txKey)) {
                allTransactionsSet.add(txKey);
                allTransactions.push({
                  type: 'Withdraw Rewards',
                  amount: ethers.formatEther(decoded.args.amount),
                  time: new Date(block.timestamp * 1000),
                  txHash: log.transactionHash,
                  blockNumber: log.blockNumber,
                  cycle: Number(decoded.args.cycle)
                });
              }
            } catch (e) {
              console.warn("⚠️ Error processing withdraw rewards log:", e.message);
            }
          }

          // Process referral withdrawals
          for (const log of withdrawReferralLogs) {
            try {
              const decoded = contractInterface.parseLog(log);
              const block = await provider.getBlock(log.blockNumber);
              
              const txKey = `${log.transactionHash}-referral`;
              if (!allTransactionsSet.has(txKey)) {
                allTransactionsSet.add(txKey);
                allTransactions.push({
                  type: 'Withdraw Referral',
                  amount: ethers.formatEther(decoded.args.amount),
                  time: new Date(block.timestamp * 1000),
                  txHash: log.transactionHash,
                  blockNumber: log.blockNumber
                });
              }
            } catch (e) {
              console.warn("⚠️ Error processing withdraw referral log:", e.message);
            }
          }
          
        } catch (chunkError) {
          console.warn(`⚠️ Error processing chunk ${start}-${end}:`, chunkError.message);
          // Continue with next chunk
        }
      }

      // Sort by time (newest first)
      allTransactions.sort((a, b) => b.time.getTime() - a.time.getTime());

      console.log(`✅ Processed ${allTransactions.length} total transactions`);

      // Cache the result (cache for 5 minutes)
      try {
        await redis.set(cacheKey, allTransactions, { ex: 300 });
        console.log("💾 Cached transaction history for 5 minutes");
      } catch (e) {
        console.warn("⚠️ Cache write error:", e.message);
      }

    } catch (error) {
      console.error("❌ Error fetching transaction history:", error);
      allTransactions = [];
    }
  }

  // Implement pagination
  const totalTransactions = allTransactions.length;
  const totalPages = Math.ceil(totalTransactions / limitNum);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedTransactions = allTransactions.slice(startIndex, endIndex);

  return res.status(200).json({
    result: paginatedTransactions,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalTransactions,
      totalPages: totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    },
    source: allTransactions === cached ? 'cache' : 'live'
  });
}

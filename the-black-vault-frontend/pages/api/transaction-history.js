// pages/api/transaction-history.js
// Weekly-based transaction history API (similar to leaderboard approach)
// Usage: /api/transaction-history?wallet=0x...&week=1

import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

// Use Ankr API directly since environment variable loading is inconsistent
const BSC_RPC_URL = process.env.BSC_RPC_URL || "https://rpc.ankr.com/bsc/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4";
const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";

console.log('🔧 Transaction API initialized with Ankr RPC:', BSC_RPC_URL.substring(0, 50) + '...');

// Week calculation functions (same as leaderboard)
function getCurrentWeekIndex() {
  const now = Math.floor(Date.now() / 1000);
  const EPOCH_START = 1751490000; // Monday, March 3, 2025, 7:00 AM AEST
  return Math.floor((now - EPOCH_START) / 604800); // 604800 seconds in a week
}

function getWeekTimestamps(weekIndex) {
  const EPOCH_START = 1751490000;
  const weekStart = EPOCH_START + (weekIndex * 604800);
  const weekEnd = weekStart + 604800;
  return { weekStart, weekEnd };
}

async function estimateBlockFromTimestamp(timestamp) {
  try {
    console.log('🔍 Estimating block for timestamp:', timestamp, new Date(timestamp * 1000).toISOString());
    
    const response = await fetch(BSC_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }
    
    const currentBlock = parseInt(data.result, 16);
    console.log('📊 Current block number:', currentBlock);
    
    const blockResponse = await fetch(BSC_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [data.result, false],
        id: 1
      })
    });

    const blockData = await blockResponse.json();
    const currentTimestamp = parseInt(blockData.result.timestamp, 16);
    console.log('⏰ Current block timestamp:', new Date(currentTimestamp * 1000).toISOString());
    
    // Estimate blocks (BSC ~3 second block time)
    const blockDiff = Math.floor((currentTimestamp - timestamp) / 3);
    const estimatedBlock = Math.max(0, currentBlock - blockDiff);
    
    console.log('🎯 Estimated block for timestamp:', estimatedBlock);
    return estimatedBlock;
  } catch (error) {
    console.error('❌ Error estimating block:', error.message);
    return 0;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet, week, fresh } = req.query;

  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  try {
    const currentWeekIndex = getCurrentWeekIndex();
    const requestedWeek = week ? parseInt(week) : currentWeekIndex;
    
    // Validate week range (can't request future weeks, limit to reasonable past)
    if (requestedWeek > currentWeekIndex || requestedWeek < 0) {
      return res.status(400).json({ error: 'Invalid week index' });
    }

    const cacheKey = `transactions:${wallet.toLowerCase()}:week:${requestedWeek}`;
    
    // Try to get from cache first (unless fresh=true parameter is provided)
    if (fresh !== 'true') {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`📋 Serving cached transactions for ${wallet} week ${requestedWeek}`);
        return res.status(200).json({
          ...cached,
          source: 'cache'
        });
      }
    } else {
      console.log(`🔄 Fresh lookup requested for ${wallet} week ${requestedWeek}`);
    }

    console.log(`🔍 Loading transactions for ${wallet} week ${requestedWeek}`);
    
    const { weekStart, weekEnd } = getWeekTimestamps(requestedWeek);
    const fromBlock = await estimateBlockFromTimestamp(weekStart);
    const toBlock = await estimateBlockFromTimestamp(weekEnd);
    
    console.log(`Week ${requestedWeek}: ${new Date(weekStart * 1000).toISOString()} to ${new Date(weekEnd * 1000).toISOString()}`);
    console.log(`Scanning blocks ${fromBlock} to ${toBlock}`);

    const allTransactions = [];
    
    // Events to track (correct signatures from contract ABI)
    const events = [
      { 
        name: 'Deposited',
        signature: '0xc490a74c1058132dffb93944d555ddd1817ae53b7367ea1126ff123b1b1344a58',
        decode: (log) => {
          const user = '0x' + log.topics[1].slice(26);
          const referrer = '0x' + log.topics[2].slice(26);
          // amount and cycle are in data (first 32 bytes = amount, second 32 bytes = cycle)
          const amount = parseInt(log.data.slice(0, 66), 16);
          return { user, amount, referrer, type: 'Deposit' };
        }
      },
      {
        name: 'RewardsWithdrawn',
        signature: '0xfa73d3ab3a92ed3f2b6947757d8e4b2f3c293654b11b9c79111f8971f861b22b2',
        decode: (log) => {
          const user = '0x' + log.topics[1].slice(26);
          // amount and cycle are in data (first 32 bytes = amount, second 32 bytes = cycle)
          const amount = parseInt(log.data.slice(0, 66), 16);
          return { user, amount, type: 'Rewards Withdrawal' };
        }
      },
      {
        name: 'ReferralRewardsWithdrawn',
        signature: '0x996ae2281234577779bb0d7cd6daa18e54006fe2f6dc172f12197d8266b08dabcd',
        decode: (log) => {
          const user = '0x' + log.topics[1].slice(26);
          // amount is in data
          const amount = parseInt(log.data.slice(0, 66), 16);
          return { user, amount, type: 'Referral Withdrawal' };
        }
      }
    ];

    // Process each event type
    for (const event of events) {
      try {
        console.log(`🔍 Fetching ${event.name} events...`);
        const response = await fetch(BSC_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getLogs',
            params: [{
              fromBlock: `0x${fromBlock.toString(16)}`,
              toBlock: `0x${toBlock.toString(16)}`,
              address: CONTRACT_ADDRESS,
              topics: [event.signature]
            }],
            id: 1
          })
        });

        const data = await response.json();
        
        if (data.result) {
          console.log(`📊 Found ${data.result.length} ${event.name} events`);
          for (const log of data.result) {
            try {
              const decoded = event.decode(log);
              console.log(`🔍 Decoded ${event.name}:`, {
                user: decoded.user,
                amount: decoded.amount,
                requestedWallet: wallet.toLowerCase(),
                matches: decoded.user.toLowerCase() === wallet.toLowerCase()
              });

              // Only include transactions for the requested wallet
              if (decoded.user.toLowerCase() === wallet.toLowerCase()) {
                // Get block timestamp
                const blockResponse = await fetch(BSC_RPC_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getBlockByNumber',
                    params: [log.blockNumber, false],
                    id: 1
                  })
                });

                const blockData = await blockResponse.json();
                const timestamp = parseInt(blockData.result.timestamp, 16);

                allTransactions.push({
                  txHash: log.transactionHash,
                  type: decoded.type,
                  amount: (decoded.amount / 1e6).toFixed(6), // Convert from wei to USDT
                  time: new Date(timestamp * 1000).toISOString(),
                  blockNumber: parseInt(log.blockNumber, 16)
                });
              }
            } catch (decodeError) {
              console.error(`Error decoding log:`, decodeError);
            }
          }
        }
      } catch (eventError) {
        console.error(`Error fetching ${event.name} events:`, eventError);
      }
    }

    // Sort by timestamp descending
    allTransactions.sort((a, b) => new Date(b.time) - new Date(a.time));

    const result = {
      result: allTransactions,
      weekIndex: requestedWeek,
      weekStart,
      weekEnd,
      isCurrentWeek: requestedWeek === currentWeekIndex,
      totalTransactions: allTransactions.length,
      generatedAt: new Date().toISOString()
    };

    // Cache for 5 minutes (current week) or 1 hour (past weeks)
    const cacheTime = requestedWeek === currentWeekIndex ? 300 : 3600;
    await redis.setex(cacheKey, cacheTime, result);

    console.log(`✅ Found ${allTransactions.length} transactions for week ${requestedWeek}`);
    
    return res.status(200).json({
      ...result,
      source: 'live'
    });

  } catch (error) {
    console.error('Error in transaction history API:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch transaction history',
      details: error.message 
    });
  }
}

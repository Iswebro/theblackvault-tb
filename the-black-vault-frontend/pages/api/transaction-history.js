// pages/api/transaction-history.js
// Weekly-based transaction history API (similar to leaderboard approach)
// Usage: /api/transaction-history?wallet=0x...&week=1

import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const BSC_RPC_URL = process.env.BSC_RPC_URL;
const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";

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

    const data = await response.json();
    const currentBlock = parseInt(data.result, 16);
    
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
    
    // Estimate blocks (BSC ~3 second block time)
    const blockDiff = Math.floor((currentTimestamp - timestamp) / 3);
    return Math.max(0, currentBlock - blockDiff);
  } catch (error) {
    console.error('Error estimating block:', error);
    return 0;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet, week } = req.query;

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
    
    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`📋 Serving cached transactions for ${wallet} week ${requestedWeek}`);
      return res.status(200).json({
        ...cached,
        source: 'cache'
      });
    }

    console.log(`🔍 Loading transactions for ${wallet} week ${requestedWeek}`);
    
    const { weekStart, weekEnd } = getWeekTimestamps(requestedWeek);
    const fromBlock = await estimateBlockFromTimestamp(weekStart);
    const toBlock = await estimateBlockFromTimestamp(weekEnd);
    
    console.log(`Week ${requestedWeek}: ${new Date(weekStart * 1000).toISOString()} to ${new Date(weekEnd * 1000).toISOString()}`);
    console.log(`Scanning blocks ${fromBlock} to ${toBlock}`);

    const allTransactions = [];
    
    // Events to track
    const events = [
      { 
        name: 'Deposited',
        signature: '0x2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c4',
        decode: (log) => {
          const user = '0x' + log.topics[1].slice(26);
          const amount = parseInt(log.data.slice(0, 66), 16);
          const referrer = '0x' + log.topics[2].slice(26);
          return { user, amount, referrer, type: 'Deposit' };
        }
      },
      {
        name: 'Withdrawn',
        signature: '0x884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364',
        decode: (log) => {
          const user = '0x' + log.topics[1].slice(26);
          const amount = parseInt(log.data.slice(0, 66), 16);
          return { user, amount, type: 'Withdrawal' };
        }
      },
      {
        name: 'ReferralRewardPaid',
        signature: '0x091e83c71e1e3ed5885d67b5c5a3e2a0f4ee4b34b7b0e9e9c4e7c6e4c3a6e7f8',
        decode: (log) => {
          const referrer = '0x' + log.topics[1].slice(26);
          const amount = parseInt(log.data.slice(0, 66), 16);
          return { user: referrer, amount, type: 'Referral Reward' };
        }
      }
    ];

    // Process each event type
    for (const event of events) {
      try {
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
          for (const log of data.result) {
            try {
              const decoded = event.decode(log);
              
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

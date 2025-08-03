// pages/api/transaction-history.js
// Weekly-based transaction history API with simplified approach
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
    console.log(`🔍 DEBUG: Starting transaction history for wallet: ${wallet}`);
    
    const currentWeekIndex = getCurrentWeekIndex();
    const requestedWeek = week ? parseInt(week) : currentWeekIndex;
    
    console.log(`🔍 DEBUG: Current week: ${currentWeekIndex}, Requested week: ${requestedWeek}`);
    
    // Validate week range (can't request future weeks, limit to reasonable past)
    if (requestedWeek > currentWeekIndex || requestedWeek < 0) {
      return res.status(400).json({ error: 'Invalid week index' });
    }

    const cacheKey = `transactions:${wallet.toLowerCase()}:week:${requestedWeek}`;
    
    // Skip cache for debugging - always fetch fresh
    console.log(`� DEBUG: Forcing fresh lookup for ${wallet} week ${requestedWeek}`);

    const { weekStart, weekEnd } = getWeekTimestamps(requestedWeek);
    const fromBlock = await estimateBlockFromTimestamp(weekStart);
    const toBlock = await estimateBlockFromTimestamp(weekEnd);
    
    console.log(`🔍 DEBUG: Week ${requestedWeek}: ${new Date(weekStart * 1000).toISOString()} to ${new Date(weekEnd * 1000).toISOString()}`);
    console.log(`🔍 DEBUG: Scanning blocks ${fromBlock} to ${toBlock}`);

    // First, let's try a simpler approach - get ALL events for this contract in the time range
    console.log(`🔍 DEBUG: Fetching ALL events for contract ${CONTRACT_ADDRESS}...`);
    
    const allEventsResponse = await fetch(BSC_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${Math.max(0, fromBlock - 1000).toString(16)}`, // Wider range for debugging
          toBlock: `0x${(toBlock + 1000).toString(16)}`,
          address: CONTRACT_ADDRESS
        }],
        id: 1
      })
    });

    const allEventsData = await allEventsResponse.json();
    console.log(`🔍 DEBUG: Found ${allEventsData.result?.length || 0} total events for contract`);
    
    if (allEventsData.result && allEventsData.result.length > 0) {
      console.log(`🔍 DEBUG: Sample events:`, allEventsData.result.slice(0, 3).map(log => ({
        topics: log.topics,
        data: log.data,
        blockNumber: parseInt(log.blockNumber, 16)
      })));
    }

    const allTransactions = [];
    
    // Let's manually check for our known event signatures
    const eventSignatures = {
      'Deposited': '0xc490a74c1058132dffb93944d555ddd1817ae53b7367ea1126ff123b1b134a58',
      'RewardsWithdrawn': '0xfa73d3ab3a92ed3f2b6947757d8e4b2f3c293654b11b9c79111f8971f861b22b2',
      'ReferralRewardsWithdrawn': '0x996ae228123457779bb0d7cd6daa18e54006fe2f6dc172f12197d826b08dabcd'
    };

    if (allEventsData.result) {
      for (const log of allEventsData.result) {
        const eventSig = log.topics[0];
        console.log(`🔍 DEBUG: Checking event signature: ${eventSig}`);
        
        // Check if this is one of our events
        const eventName = Object.keys(eventSignatures).find(name => eventSignatures[name] === eventSig);
        if (eventName) {
          console.log(`🔍 DEBUG: Found ${eventName} event!`);
          
          try {
            // Extract user address from topics[1]
            const user = '0x' + log.topics[1].slice(26);
            console.log(`� DEBUG: Event user: ${user}, Target wallet: ${wallet.toLowerCase()}`);
            
            // Check if this event is for our target wallet
            if (user.toLowerCase() === wallet.toLowerCase()) {
              console.log(`🔍 DEBUG: ✅ Found matching transaction for wallet!`);
              
              // Simple amount extraction from data
              const amountHex = log.data.slice(2, 66);
              const amount = BigInt('0x' + amountHex);
              
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
                type: eventName === 'Deposited' ? 'Deposit' : 
                      eventName === 'RewardsWithdrawn' ? 'Rewards Withdrawal' : 'Referral Withdrawal',
                amount: (Number(amount) / 1000000000000000000).toFixed(6), // Convert from wei units (18 decimals)
                time: new Date(timestamp * 1000).toISOString(),
                blockNumber: parseInt(log.blockNumber, 16)
              });
            }
          } catch (eventError) {
            console.error(`🔍 DEBUG: Error processing ${eventName} event:`, eventError);
          }
        }
      }
    }

    console.log(`🔍 DEBUG: Final transactions found: ${allTransactions.length}`);
    console.log(`🔍 DEBUG: Transactions:`, allTransactions);

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

    console.log(`✅ DEBUG: Returning ${allTransactions.length} transactions for week ${requestedWeek}`);
    
    return res.status(200).json({
      ...result,
      source: 'debug'
    });

  } catch (error) {
    console.error('Error in transaction history API:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch transaction history',
      details: error.message 
    });
  }
}

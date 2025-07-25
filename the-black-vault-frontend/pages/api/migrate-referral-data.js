// pages/api/migrate-referral-data.js
// One-time migration script to populate Upstash with existing referral data from blockchain

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const RPC_URLS = [
  process.env.BSC_RPC_URL || 'https://rpc.ankr.com/bsc/d074aa9b547a0e06b9e9b1bb3c78f25b6a9cf86b24c96f13b67bccb42c19fa22',
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/'
];

const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';
const BLACK_VAULT_ABI = [
  "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)"
];

// Helper function for aggressive event searching
const aggressiveEventSearch = async (contract, provider, referrer) => {
  const depositFilter = contract.filters.Deposited(null, null, referrer);
  let allEvents = [];
  const currentBlock = await provider.getBlockNumber();
  
  console.log(`🔍 MIGRATE: Starting aggressive search for ${referrer}`);
  console.log(`🔍 MIGRATE: Current block: ${currentBlock}`);
  
  // Strategy 1: Try large ranges first
  const largeRanges = [-100000, -200000, -300000, -500000];
  for (const range of largeRanges) {
    try {
      console.log(`🔍 MIGRATE: Trying range ${range} (${Math.abs(range/1000)}k blocks)`);
      const events = await contract.queryFilter(depositFilter, range);
      if (events.length > 0) {
        allEvents.push(...events);
        console.log(`✅ MIGRATE: Found ${events.length} events in ${range} range`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    } catch (error) {
      console.warn(`⚠️ MIGRATE: Range ${range} failed: ${error.message}`);
    }
  }
  
  // Strategy 2: If still not enough, try chunked search
  if (allEvents.length < 10) { // If we found less than 10, try harder
    console.log(`🔍 MIGRATE: Found only ${allEvents.length} events, trying chunked search...`);
    
    const chunkSize = 50000;
    const maxBlocks = 1000000; // Go back 1M blocks (several months)
    
    for (let startBlock = currentBlock - chunkSize; startBlock > currentBlock - maxBlocks; startBlock -= chunkSize) {
      try {
        const endBlock = Math.min(startBlock + chunkSize, currentBlock);
        const chunkEvents = await contract.queryFilter(depositFilter, startBlock, endBlock);
        
        if (chunkEvents.length > 0) {
          // Avoid duplicates
          const existingTxHashes = new Set(allEvents.map(e => e.transactionHash));
          const newEvents = chunkEvents.filter(e => !existingTxHashes.has(e.transactionHash));
          allEvents.push(...newEvents);
          console.log(`✅ MIGRATE: Found ${newEvents.length} new events in chunk ${startBlock}-${endBlock}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
        
        // Stop if we found enough
        if (allEvents.length >= 15) {
          console.log(`🔍 MIGRATE: Found sufficient events (${allEvents.length}), stopping search`);
          break;
        }
      } catch (chunkError) {
        console.warn(`⚠️ MIGRATE: Chunk ${startBlock} failed: ${chunkError.message}`);
      }
    }
  }
  
  console.log(`🔍 MIGRATE: Total events found: ${allEvents.length}`);
  return allEvents;
};

export default async function handler(req, res) {
  const { method, query } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account } = query;
  
  if (!account || !ethers.isAddress(account)) {
    return res.status(400).json({ error: 'Valid account address required' });
  }

  try {
    console.log(`🔍 MIGRATE: Starting migration for ${account}`);
    
    // Initialize provider and contract
    let provider, contract;
    for (const rpcUrl of RPC_URLS) {
      try {
        provider = new ethers.JsonRpcProvider(rpcUrl);
        await provider.getBlockNumber(); // Test connection
        contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
        console.log(`✅ MIGRATE: Connected to RPC: ${rpcUrl}`);
        break;
      } catch (error) {
        console.warn(`⚠️ MIGRATE: RPC failed: ${rpcUrl}`);
      }
    }
    
    if (!provider || !contract) {
      throw new Error('Failed to connect to any RPC provider');
    }
    
    // Get all deposit events for this referrer
    const events = await aggressiveEventSearch(contract, provider, account);
    
    if (events.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No referral events found to migrate',
        eventsFound: 0
      });
    }
    
    // Process events into referral records
    const referralRecords = [];
    for (const event of events) {
      try {
        const block = await provider.getBlock(event.blockNumber);
        const referralRecord = {
          referee: event.args.user.toLowerCase(),
          referrer: account.toLowerCase(),
          depositAmount: ethers.formatEther(event.args.amount),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          addedAt: new Date().toISOString(),
          migrated: true
        };
        referralRecords.push(referralRecord);
        console.log(`✅ MIGRATE: Processed event for referee ${referralRecord.referee}`);
      } catch (eventError) {
        console.warn(`⚠️ MIGRATE: Failed to process event ${event.transactionHash}:`, eventError.message);
      }
    }
    
    if (referralRecords.length === 0) {
      throw new Error('Failed to process any events');
    }
    
    // Store in Upstash
    const referrerKey = `referrals:${account.toLowerCase()}`;
    await redis.set(referrerKey, referralRecords);
    
    // Also store individual mappings
    for (const record of referralRecords) {
      const refereeKey = `referee:${record.referee}`;
      const txKey = `referral-tx:${record.transactionHash}`;
      await redis.set(refereeKey, record);
      await redis.set(txKey, record);
    }
    
    // Clear any cached data to force refresh
    const cacheKeys = [
      `user-referrals:${account.toLowerCase()}`,
      `user-referrals:${account}`,
      `user-referrals-v2:${account.toLowerCase()}`,
      `user-referrals-v2:${account}`
    ];
    
    await Promise.all(cacheKeys.map(key => redis.del(key).catch(() => {})));
    
    console.log(`✅ MIGRATE: Successfully migrated ${referralRecords.length} referral records for ${account}`);
    
    return res.status(200).json({
      success: true,
      message: 'Referral data migration completed successfully',
      eventsFound: events.length,
      recordsCreated: referralRecords.length,
      uniqueReferees: [...new Set(referralRecords.map(r => r.referee))].length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ MIGRATE: Migration failed:", error);
    return res.status(500).json({
      error: 'Migration failed',
      details: error.message
    });
  }
}

import { ethers } from "ethers"

// Load ABI (we'll need to import this differently for Vercel)
const BlackVaultABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "referrer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "cycle",
        type: "uint256",
      },
    ],
    name: "Deposited",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "referrer",
        type: "address",
      },
      {
        internalType: "address",
        name: "referee",
        type: "address",
      },
    ],
    name: "getReferralBonusInfo",
    outputs: [
      {
        internalType: "uint256",
        name: "bonusesUsed",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "bonusesRemaining",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
]

// Configuration
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS
const RPC_URL = process.env.REACT_APP_RPC_URL || "https://bsc-dataseed.binance.org/"
const LAUNCH_TIMESTAMP = 1751500800 // 7am Brisbane time 3 July 2025
const WEEK_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds

// New constants for chunking and delay
const BLOCK_CHUNK_SIZE = 50000 // Process 50,000 blocks at a time
const REQUEST_DELAY_MS = 100 // Delay 100ms between requests to avoid rate limits

// Ethers.js setup
const provider = new ethers.JsonRpcProvider(RPC_URL)
const blackVaultContract = new ethers.Contract(CONTRACT_ADDRESS, BlackVaultABI, provider)

/**
 * Get current week index based on Brisbane time
 */
function getCurrentWeekIndex() {
  const nowTs = Math.floor(Date.now() / 1000)
  return Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION)
}

/**
 * Get week start and end timestamps
 */
function getWeekBounds(weekIndex) {
  const weekStart = LAUNCH_TIMESTAMP + weekIndex * WEEK_DURATION
  const weekEnd = weekStart + WEEK_DURATION
  return { weekStart, weekEnd }
}

/**
 * Convert timestamp to block number (approximate)
 */
async function getBlockByTimestamp(timestamp) {
  try {
    const currentBlock = await provider.getBlockNumber()
    const currentBlockData = await provider.getBlock(currentBlock)
    const currentTimestamp = currentBlockData.timestamp

    // BSC has ~3 second block time
    const avgBlockTime = 3
    const blockDiff = Math.floor((currentTimestamp - timestamp) / avgBlockTime)
    const estimatedBlock = Math.max(0, currentBlock - blockDiff)

    return estimatedBlock
  } catch (error) {
    console.error("Error estimating block:", error)
    return 0
  }
}

/**
 * Calculate referral rewards for a deposit amount
 */
function calculateReferralReward(depositAmount) {
  // 10% referral bonus
  return (BigInt(depositAmount) * BigInt(10)) / BigInt(100)
}

/**
 * Helper function to fetch events in chunks
 */
async function fetchEventsInChunks(contract, filter, fromBlock, toBlock) {
  let allEvents = []
  let currentFromBlock = fromBlock

  while (currentFromBlock <= toBlock) {
    const currentToBlock = Math.min(currentFromBlock + BLOCK_CHUNK_SIZE - 1, toBlock)
    console.log(`Fetching events from block ${currentFromBlock} to ${currentToBlock}`)
    try {
      const chunkEvents = await contract.queryFilter(filter, currentFromBlock, currentToBlock)
      allEvents = allEvents.concat(chunkEvents)
      console.log(`Fetched ${chunkEvents.length} events in this chunk. Total: ${allEvents.length}`)
    } catch (error) {
      console.error(`Error fetching events for chunk ${currentFromBlock}-${currentToBlock}:`, error)
      throw error // Re-throw to stop aggregation if a chunk fails
    }

    currentFromBlock = currentToBlock + 1
    if (currentFromBlock <= toBlock) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS)) // Delay between chunks
    }
  }
  return allEvents
}

/**
 * Aggregate weekly leaderboard data
 */
async function aggregateWeeklyLeaderboard(weekIndex) {
  console.log(`Aggregating weekly leaderboard for week ${weekIndex}...`)

  const { weekStart, weekEnd } = getWeekBounds(weekIndex)
  const fromBlock = await getBlockByTimestamp(weekStart)
  const toBlock = await getBlockByTimestamp(weekEnd)

  console.log(
    `Week ${weekIndex}: ${new Date(weekStart * 1000).toISOString()} to ${new Date(weekEnd * 1000).toISOString()}`,
  )
  console.log(`Scanning blocks ${fromBlock} to ${toBlock}`)

  try {
    // Get all deposit events for this week using chunking
    const depositFilter = blackVaultContract.filters.Deposited()
    const depositEvents = await fetchEventsInChunks(blackVaultContract, depositFilter, fromBlock, toBlock)

    console.log(`Found ${depositEvents.length} total deposit events in week ${weekIndex}`)

    // Aggregate referral rewards by referrer
    const referrerRewards = {}

    for (const event of depositEvents) {
      const referrer = event.args.referrer.toLowerCase()
      const referee = event.args.user.toLowerCase()
      const amount = event.args.amount.toString()

      // Skip if no referrer (zero address)
      if (referrer === ethers.ZeroAddress.toLowerCase()) {
        continue
      }

      // Check if this referrer-referee pair is eligible for bonus
      try {
        const bonusInfo = await blackVaultContract.getReferralBonusInfo(referrer, referee)
        const bonusesUsed = Number.parseInt(bonusInfo.bonusesUsed.toString())

        // Only count if this would be within the first 3 bonuses
        if (bonusesUsed <= 3) {
          const rewardAmount = calculateReferralReward(amount)

          if (!referrerRewards[referrer]) {
            referrerRewards[referrer] = BigInt(0)
          }

          referrerRewards[referrer] += rewardAmount
        }
      } catch (error) {
        console.error(`Error checking bonus info for ${referrer} -> ${referee}:`, error)
      }
    }

    // Convert to array and sort
    const leaderboard = Object.entries(referrerRewards)
      .map(([address, totalRewards]) => ({
        address,
        totalRewards: totalRewards.toString(),
      }))
      .sort((a, b) => BigInt(b.totalRewards) - BigInt(a.totalRewards))
      .slice(0, 10) // Top 10
      .map((entry, index) => ({
        rank: index + 1,
        address: entry.address,
        totalRewards: entry.totalRewards,
      }))

    console.log(`Week ${weekIndex} top referrers:`, leaderboard.length)

    // Create the weekly data object
    const weeklyData = {
      weekIndex,
      weekStart,
      weekEnd,
      generatedAt: Math.floor(Date.now() / 1000),
      leaderboard,
    }

    return weeklyData
  } catch (error) {
    console.error(`Error aggregating week ${weekIndex}:`, error)
    throw error
  }
}

/**
 * Aggregate lifetime leaderboard data
 */
async function aggregateLifetimeLeaderboard() {
  console.log("Aggregating lifetime leaderboard...")

  try {
    // Get all deposit events from genesis using chunking
    const depositFilter = blackVaultContract.filters.Deposited()
    const latestBlock = await provider.getBlockNumber()
    const depositEvents = await fetchEventsInChunks(blackVaultContract, depositFilter, 0, latestBlock)

    console.log(`Found ${depositEvents.length} total deposit events`)

    // Aggregate referral rewards by referrer
    const referrerRewards = {}

    for (const event of depositEvents) {
      const referrer = event.args.referrer.toLowerCase()
      const referee = event.args.user.toLowerCase()
      const amount = event.args.amount.toString()

      // Skip if no referrer (zero address)
      if (referrer === ethers.ZeroAddress.toLowerCase()) {
        continue
      }

      // Check if this referrer-referee pair is eligible for bonus
      try {
        const bonusInfo = await blackVaultContract.getReferralBonusInfo(referrer, referee)
        const bonusesUsed = Number.parseInt(bonusInfo.bonusesUsed.toString())

        // Only count if this would be within the first 3 bonuses
        if (bonusesUsed <= 3) {
          const rewardAmount = calculateReferralReward(amount)

          if (!referrerRewards[referrer]) {
            referrerRewards[referrer] = BigInt(0)
          }

          referrerRewards[referrer] += rewardAmount
        }
      } catch (error) {
        console.error(`Error checking bonus info for ${referrer} -> ${referee}:`, error)
      }
    }

    // Convert to array and sort
    const leaderboard = Object.entries(referrerRewards)
      .map(([address, totalRewards]) => ({
        address,
        totalRewards: totalRewards.toString(),
      }))
      .sort((a, b) => BigInt(b.totalRewards) - BigInt(a.totalRewards))
      .slice(0, 10) // Top 10
      .map((entry, index) => ({
        rank: index + 1,
        address: entry.address,
        totalRewards: entry.totalRewards,
      }))

    console.log(`Lifetime top referrers:`, leaderboard.length)

    // Create the lifetime data object
    const lifetimeData = {
      generatedAt: Math.floor(Date.now() / 1000),
      leaderboard,
    }

    return lifetimeData
  } catch (error) {
    console.error("Error aggregating lifetime leaderboard:", error)
    throw error
  }
}

export default async function handler(req, res) {
  // Verify this is a cron request (optional security measure)
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  try {
    console.log("Starting weekly leaderboard cron job...")

    const currentWeekIndex = getCurrentWeekIndex()
    console.log(`Current week index: ${currentWeekIndex}`)

    // Generate current week leaderboard
    const weeklyData = await aggregateWeeklyLeaderboard(currentWeekIndex)

    // Generate lifetime leaderboard
    const lifetimeData = await aggregateLifetimeLeaderboard()

    // In a real implementation, you'd save this to a database or persistent storage
    // For now, we'll return the data and log it
    console.log("Weekly leaderboard generated:", weeklyData.leaderboard.length, "entries")
    console.log("Lifetime leaderboard generated:", lifetimeData.leaderboard.length, "entries")

    // Store in Vercel KV or your preferred database here
    // await storeLeaderboardData(weeklyData, lifetimeData)

    res.status(200).json({
      success: true,
      message: "Leaderboard data generated successfully",
      weekIndex: currentWeekIndex,
      weeklyEntries: weeklyData.leaderboard.length,
      lifetimeEntries: lifetimeData.leaderboard.length,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in weekly leaderboard cron:", error)
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}

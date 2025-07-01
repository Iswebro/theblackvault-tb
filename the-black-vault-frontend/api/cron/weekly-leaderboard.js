import { ethers } from "ethers"
import BlackVaultAbi from "../../src/contract/BlackVaultABI.json"
import { kv } from "@vercel/kv"

// Load ABI (we'll need to import this differently for Vercel)
const BlackVaultABI = BlackVaultAbi

// Configuration
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "0x08b7fCcb9c92cB3C6A3279Bc377F461fD6fD97A1"
const RPC_URL = process.env.REACT_APP_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545"
const LAUNCH_TIMESTAMP = 1717804800000 // June 8, 2024 00:00:00 GMT
const WEEK_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

// Vercel's /tmp directory for temporary storage
const DATA_DIR = "/tmp/leaderboard-data"

// Ethers.js setup
const provider = new ethers.JsonRpcProvider(RPC_URL)
const blackVaultContract = new ethers.Contract(CONTRACT_ADDRESS, BlackVaultABI, provider)

/**
 * Get current week index based on GMT time
 */
function getCurrentWeekIndex() {
  const nowTs = Date.now()
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
    const currentTimestamp = currentBlockData.timestamp * 1000 // Convert to milliseconds

    // BSC has ~3 second block time
    const avgBlockTime = 3000 // Convert to milliseconds
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
  return (depositAmount * 10) / 100
}

/**
 * Aggregate weekly leaderboard data
 */
async function aggregateWeeklyLeaderboard(weekIndex) {
  console.log(`Aggregating weekly leaderboard for week ${weekIndex}...`)

  const { weekStart, weekEnd } = getWeekBounds(weekIndex)
  const fromBlock = await getBlockByTimestamp(weekStart)
  const toBlock = await getBlockByTimestamp(weekEnd)

  console.log(`Week ${weekIndex}: ${new Date(weekStart).toISOString()} to ${new Date(weekEnd).toISOString()}`)
  console.log(`Scanning blocks ${fromBlock} to ${toBlock}`)

  try {
    // Get all deposit events for this week
    const depositFilter = blackVaultContract.filters.Deposited()
    const depositEvents = await blackVaultContract.queryFilter(depositFilter, fromBlock, toBlock)

    console.log(`Found ${depositEvents.length} deposit events in week ${weekIndex}`)

    // Aggregate referral rewards by referrer
    const referrerRewards = {}

    for (const event of depositEvents) {
      const referrer = event.args.referrer.toLowerCase()
      const referee = event.args.user.toLowerCase()
      const amount = Number.parseFloat(ethers.formatEther(event.args.amount))

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
            referrerRewards[referrer] = 0
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
        totalRewards,
      }))
      .sort((a, b) => b.totalRewards - a.totalRewards)
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
      generatedAt: Date.now(),
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
    // Get all deposit events from genesis
    const depositFilter = blackVaultContract.filters.Deposited()
    const depositEvents = await blackVaultContract.queryFilter(depositFilter, 0)

    console.log(`Found ${depositEvents.length} total deposit events`)

    // Aggregate referral rewards by referrer
    const referrerRewards = {}

    for (const event of depositEvents) {
      const referrer = event.args.referrer.toLowerCase()
      const referee = event.args.user.toLowerCase()
      const amount = Number.parseFloat(ethers.formatEther(event.args.amount))

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
            referrerRewards[referrer] = 0
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
        totalRewards,
      }))
      .sort((a, b) => b.totalRewards - a.totalRewards)
      .slice(0, 10) // Top 10
      .map((entry, index) => ({
        rank: index + 1,
        address: entry.address,
        totalRewards: entry.totalRewards,
      }))

    console.log(`Lifetime top referrers:`, leaderboard.length)

    // Create the lifetime data object
    const lifetimeData = {
      generatedAt: Date.now(),
      leaderboard,
    }

    return lifetimeData
  } catch (error) {
    console.error("Error aggregating lifetime leaderboard:", error)
    throw error
  }
}

export default async function handler(req, res) {
  // Ensure this endpoint is only accessible via a secure cron job
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" })
  }

  try {
    const now = Date.now()
    const oneWeek = 7 * 24 * 60 * 60 * 1000
    const timeSinceLaunch = now - LAUNCH_TIMESTAMP
    const weeksSinceLaunch = Math.floor(timeSinceLaunch / oneWeek)
    const currentWeekStartTime = LAUNCH_TIMESTAMP + weeksSinceLaunch * oneWeek

    // Fetch all Deposit events
    const filter = blackVaultContract.filters.Deposited()
    const events = await blackVaultContract.queryFilter(filter)

    const weeklyDeposits = {}

    for (const event of events) {
      const block = await provider.getBlock(event.blockNumber)
      const eventTimestamp = block.timestamp * 1000 // Convert to milliseconds

      if (eventTimestamp >= currentWeekStartTime && eventTimestamp < currentWeekStartTime + oneWeek) {
        const userAddress = event.args.user
        const amount = Number.parseFloat(ethers.formatEther(event.args.amount))

        if (!weeklyDeposits[userAddress]) {
          weeklyDeposits[userAddress] = 0
        }
        weeklyDeposits[userAddress] += amount
      }
    }

    const leaderboard = Object.entries(weeklyDeposits)
      .map(([address, volume]) => ({ address, volume }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10) // Top 10 for weekly

    // Store in Vercel KV
    await kv.set("weeklyLeaderboard", JSON.stringify(leaderboard))

    res.status(200).json({ message: "Weekly leaderboard updated successfully", leaderboard })
  } catch (error) {
    console.error("Error updating weekly leaderboard:", error)
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}

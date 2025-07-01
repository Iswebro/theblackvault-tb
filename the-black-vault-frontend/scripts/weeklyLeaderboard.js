import { ethers } from "ethers"
import fs from "fs"
import path from "path"

// Load ABIs
import BlackVaultABI from "../src/contract/BlackVaultABI.json" with { type: "json" }

// Configuration
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
const RPC_URL = process.env.REACT_APP_RPC_URL || "https://bsc-dataseed.binance.org/"
const LAUNCH_TIMESTAMP = 1718668800 // 7am Brisbane time 17 June 2024 (same as CYCLE_START_TIME)
const WEEK_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds
const DATA_DIR = path.resolve("./leaderboard-data")

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

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
    // Get all deposit events for this week
    const depositFilter = blackVaultContract.filters.Deposited()
    const depositEvents = await blackVaultContract.queryFilter(depositFilter, fromBlock, toBlock)

    console.log(`Found ${depositEvents.length} deposit events in week ${weekIndex}`)

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

    // Save to file
    const weeklyFile = path.join(DATA_DIR, `week-${weekIndex}.json`)
    const weeklyData = {
      weekIndex,
      weekStart,
      weekEnd,
      generatedAt: Math.floor(Date.now() / 1000),
      leaderboard,
    }

    fs.writeFileSync(weeklyFile, JSON.stringify(weeklyData, null, 2))
    console.log(`Saved weekly leaderboard to ${weeklyFile}`)

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

    // Save to file
    const lifetimeFile = path.join(DATA_DIR, "lifetime.json")
    const lifetimeData = {
      generatedAt: Math.floor(Date.now() / 1000),
      leaderboard,
    }

    fs.writeFileSync(lifetimeFile, JSON.stringify(lifetimeData, null, 2))
    console.log(`Saved lifetime leaderboard to ${lifetimeFile}`)

    return lifetimeData
  } catch (error) {
    console.error("Error aggregating lifetime leaderboard:", error)
    throw error
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    const currentWeekIndex = getCurrentWeekIndex()
    console.log(`Current week index: ${currentWeekIndex}`)

    // Generate current week leaderboard
    await aggregateWeeklyLeaderboard(currentWeekIndex)

    // Generate lifetime leaderboard
    await aggregateLifetimeLeaderboard()

    console.log("Leaderboard aggregation completed successfully!")
  } catch (error) {
    console.error("Error in main execution:", error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { aggregateWeeklyLeaderboard, aggregateLifetimeLeaderboard, getCurrentWeekIndex, getWeekBounds }

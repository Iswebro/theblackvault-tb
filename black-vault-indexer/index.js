import { ethers } from "ethers"
import express from "express"
import cors from "cors"
import fs from "fs"
import path from "path"

// Load ABIs
// Ensure these paths are correct relative to where index.js will be run
// CORRECTED: Changed 'assert' to 'with'
import BlackVaultABI from "./src/contract/BlackVaultABI.json" with { type: "json" }
import ERC20Abi from "./src/contract/ERC20Abi.json" with { type: "json" }

// Configuration (replace with your actual values or use environment variables)
// For a production setup, use a dedicated .env file and a library like 'dotenv'
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "0xde58f2cb3bc62dfb9963f422d0db079b2407a719" // Your deployed BlackVault contract address
const USDT_ADDRESS = process.env.REACT_APP_USDT_ADDRESS || "0x55d398326f99059fF775485246999027B3197955" // Official USDT (BEP-20) on BSC Mainnet
const RPC_URL = process.env.REACT_APP_RPC_URL || "https://bsc-dataseed.binance.org/" // BSC Mainnet RPC endpoint
const START_BLOCK = 0 // The block number from which to start indexing (0 for all history)

const PORT = process.env.PORT || 3001
const DATA_FILE = path.resolve("./data.json") // File to persist indexed data

// In-memory data store (will be loaded from/saved to DATA_FILE)
let userData = {} // { [userAddress]: { deposits: [{ amount: string, timestamp: number }], totalDeposited30Days: string, lastDepositTime: number } }
let referrerData = {} // { [referrerAddress]: { totalRewards: string, availableRewards: string, referredCount: number, totalReferredVolume: string, totalWithdrawn: string, referredUsers: { [referredAddress]: { lastDepositTime: number, totalDeposited: string } } } }
let leaderboard = [] // Array of { address: string, totalRewards: string, activeReferees: number }
let serviceState = { lastProcessedBlock: START_BLOCK } // Tracks the last block processed

// Ethers.js setup
const provider = new ethers.JsonRpcProvider(RPC_URL)
const blackVaultContract = new ethers.Contract(CONTRACT_ADDRESS, BlackVaultABI, provider)
const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20Abi, provider) // Not directly used for indexing, but good to have

// --- Persistence Functions (Simple JSON file) ---
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const rawData = fs.readFileSync(DATA_FILE)
      const data = JSON.parse(rawData)
      userData = data.userData || {}
      referrerData = data.referrerData || {}
      leaderboard = data.leaderboard || []
      serviceState = data.serviceState || { lastProcessedBlock: START_BLOCK }
      console.log("Data loaded from file.")
    }
  } catch (error) {
    console.error("Error loading data from file:", error)
  }
}

function saveData() {
  try {
    const data = { userData, referrerData, leaderboard, serviceState }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
    console.log("Data saved to file.")
  } catch (error) {
    console.error("Error saving data to file:", error)
  }
}

// --- Core Indexing Logic ---

async function fetchAndProcessEvents() {
  console.log("Starting event indexing...")
  const currentBlock = await provider.getBlockNumber()
  const fromBlock = serviceState.lastProcessedBlock + 1
  const toBlock = currentBlock

  if (fromBlock > toBlock) {
    console.log("No new blocks to process.")
    return
  }

  console.log(`Fetching events from block ${fromBlock} to ${toBlock}`)

  try {
    // Fetch all relevant events within the block range
    const depositFilter = blackVaultContract.filters.Deposited()
    const depositedEvents = await blackVaultContract.queryFilter(depositFilter, fromBlock, toBlock)

    const rewardsWithdrawFilter = blackVaultContract.filters.RewardsWithdrawn()
    const rewardsWithdrawnEvents = await blackVaultContract.queryFilter(rewardsWithdrawFilter, fromBlock, toBlock)

    const referralWithdrawFilter = blackVaultContract.filters.ReferralRewardsWithdrawn()
    const referralRewardsWithdrawnEvents = await blackVaultContract.queryFilter(
      referralWithdrawFilter,
      fromBlock,
      toBlock,
    )

    console.log(`Found ${depositedEvents.length} deposit events.`)
    console.log(`Found ${rewardsWithdrawnEvents.length} rewards withdrawal events.`)
    console.log(`Found ${referralRewardsWithdrawnEvents.length} referral withdrawal events.`)

    // Process Deposited events
    for (const event of depositedEvents) {
      const userAddress = event.args.user.toLowerCase()
      const amount = event.args.amount.toString() // Keep as string for BigNumber compatibility
      const referrerAddress = event.args.referrer.toLowerCase() // Referrer for this deposit
      const block = await provider.getBlock(event.blockNumber)
      const timestamp = block.timestamp * 1000 // Convert to milliseconds

      // Update user deposits for 30-day window and last deposit time
      if (!userData[userAddress]) {
        userData[userAddress] = { deposits: [], totalDeposited30Days: "0" }
      }
      userData[userAddress].deposits.push({ amount, timestamp })
      userData[userAddress].lastDepositTime = timestamp // For streak tracking

      // Update referrer data (totalReferredVolume and referredUsers' deposits)
      if (referrerAddress !== ethers.ZeroAddress.toLowerCase()) {
        // Check if a valid referrer
        if (!referrerData[referrerAddress]) {
          referrerData[referrerAddress] = {
            totalRewards: "0",
            availableRewards: "0",
            referredCount: 0,
            totalReferredVolume: "0",
            totalWithdrawn: "0",
            referredUsers: {},
          }
        }
        referrerData[referrerAddress].totalReferredVolume = (
          ethers.parseUnits(referrerData[referrerAddress].totalReferredVolume, 0) + ethers.parseUnits(amount, 0)
        ).toString()

        // Track referred user's deposits for this specific referrer
        if (!referrerData[referrerAddress].referredUsers[userAddress]) {
          referrerData[referrerAddress].referredUsers[userAddress] = { deposits: [], totalDeposited: "0" }
        }
        referrerData[referrerAddress].referredUsers[userAddress].deposits.push({ amount, timestamp })
        referrerData[referrerAddress].referredUsers[userAddress].totalDeposited = (
          ethers.parseUnits(referrerData[referrerAddress].referredUsers[userAddress].totalDeposited, 0) +
          ethers.parseUnits(amount, 0)
        ).toString()
      }
    }

    // Process ReferralRewardsWithdrawn events (for referrer total rewards)
    for (const event of referralRewardsWithdrawnEvents) {
      const userAddress = event.args.user.toLowerCase()
      const amount = event.args.amount.toString()
      if (!referrerData[userAddress]) {
        referrerData[userAddress] = {
          totalRewards: "0",
          availableRewards: "0",
          referredCount: 0,
          totalReferredVolume: "0",
          totalWithdrawn: "0",
          referredUsers: {},
        }
      }
      referrerData[userAddress].totalRewards = (
        ethers.parseUnits(referrerData[userAddress].totalRewards, 0) + ethers.parseUnits(amount, 0)
      ).toString()
      referrerData[userAddress].totalWithdrawn = (
        ethers.parseUnits(referrerData[userAddress].totalWithdrawn, 0) + ethers.parseUnits(amount, 0)
      ).toString()
    }

    // After processing all events, update derived data (active referees, streaks, leaderboard)
    updateDerivedData()

    serviceState.lastProcessedBlock = toBlock
    saveData() // Save state after each successful run
    console.log("Event indexing complete.")
  } catch (error) {
    console.error("Error fetching or processing events:", error)
  }
}

function updateDerivedData() {
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000 // 30 days in ms
  const sevenDays = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000 // Approx 1 month ago in ms

  // Recalculate 30-day deposits for all users (for "active" referee check)
  for (const userAddress in userData) {
    userData[userAddress].deposits = userData[userAddress].deposits.filter((d) => d.timestamp >= thirtyDaysAgo)
    userData[userAddress].totalDeposited30Days = userData[userAddress].deposits.reduce(
      (sum, d) => (ethers.parseUnits(sum, 0) + ethers.parseUnits(d.amount, 0)).toString(),
      "0",
    )
  }

  // Calculate active referees and streak flags for each referrer
  for (const referrerAddress in referrerData) {
    let activeRefereesCount = 0
    let streakAchieved = false
    const referredUsers = referrerData[referrerAddress].referredUsers

    // For streak tracking, we need to know if at least one deposit occurred in each 7-day window
    // over the last month. This is a simplified approach for "quick & dirty".
    // A more robust solution would track specific 7-day intervals.
    let depositsInLastMonth = []
    for (const referredAddress in referredUsers) {
      // Filter deposits for this referred user within the last month
      const recentDeposits = referredUsers[referredAddress].deposits.filter((d) => d.timestamp >= oneMonthAgo)
      depositsInLastMonth = depositsInLastMonth.concat(recentDeposits)

      // Check for "active" referee (>= 250 USDT in last 30 days)
      const referredUserDeposits30Days = userData[referredAddress]?.totalDeposited30Days || "0"
      if (ethers.parseUnits(referredUserDeposits30Days, 0) >= ethers.parseEther("250")) {
        activeRefereesCount++
      }
    }

    // Simplified streak check: at least 4 deposits in the last month, each within a 7-day window
    // This is a very basic heuristic. A true streak requires more precise interval checking.
    if (depositsInLastMonth.length >= 4) {
      // At least 4 deposits in the last month
      // Sort deposits by timestamp
      depositsInLastMonth.sort((a, b) => a.timestamp - b.timestamp)
      let consecutiveWeeksWithDeposit = 0
      let lastWeekStart = now - sevenDays // Start of the current week

      for (let i = 0; i < 4; i++) {
        // Check for 4 consecutive weeks
        const weekEnd = lastWeekStart + sevenDays
        const depositsInThisWeek = depositsInLastMonth.filter(
          (d) => d.timestamp >= lastWeekStart && d.timestamp < weekEnd,
        )
        if (depositsInThisWeek.length > 0) {
          consecutiveWeeksWithDeposit++
        }
        lastWeekStart -= sevenDays // Move to the previous week
      }
      if (consecutiveWeeksWithDeposit >= 4) {
        streakAchieved = true
      }
    }

    referrerData[referrerAddress].activeRefereesCount = activeRefereesCount
    referrerData[referrerAddress].hasReferralStreak = streakAchieved
  }

  // Update Leaderboard (top 10 referrers by total referral rewards)
  leaderboard = Object.entries(referrerData)
    .map(([address, data]) => ({
      address,
      totalRewards: data.totalRewards,
      activeReferees: data.activeRefereesCount || 0, // Include active referees for sorting option
    }))
    .sort((a, b) => {
      // Sort by totalRewards (descending)
      return ethers.parseUnits(b.totalRewards, 0) - ethers.parseUnits(a.totalRewards, 0)
    })
    .slice(0, 10) // Top 10
}

// --- HTTP API ---
const app = express()
app.use(cors()) // Enable CORS for frontend access
app.use(express.json())

app.get("/api/activeRefereesCount", (req, res) => {
  const address = req.query.address?.toLowerCase()
  if (!address) {
    return res.status(400).json({ error: "Address parameter is required." })
  }
  const count = referrerData[address]?.activeRefereesCount || 0
  res.json({ address, activeRefereesCount: count })
})

app.get("/api/referralStreak", (req, res) => {
  const address = req.query.address?.toLowerCase()
  if (!address) {
    return res.status(400).json({ error: "Address parameter is required." })
  }
  const hasStreak = referrerData[address]?.hasReferralStreak || false
  res.json({ address, hasReferralStreak: hasStreak })
})

app.get("/api/leaderboard", (req, res) => {
  res.json({ leaderboard })
})

// --- Initialization and Scheduling ---

async function init() {
  loadData() // Load existing data on startup
  await fetchAndProcessEvents() // Perform an initial fetch and process

  // This service is designed to be run as a cron job or serverless function.
  // If you want it to run continuously in a long-lived process, uncomment the setInterval:
  // setInterval(fetchAndProcessEvents, 60 * 60 * 1000); // Run every hour (adjust as needed)

  console.log(`Indexing service API listening on port ${PORT}`)
  app.listen(PORT, () => {
    console.log(`HTTP API server running on http://localhost:${PORT}`)
  })
}

init()

// Export for potential testing or serverless function entry point
export { app, fetchAndProcessEvents, loadData, saveData, userData, referrerData, leaderboard, serviceState }

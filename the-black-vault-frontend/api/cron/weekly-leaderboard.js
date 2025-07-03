import { ethers } from "ethers"

// --- ABI & Config ---------------------------------------------------
const BlackVaultABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "user",     type: "address" },
      { indexed: false, internalType: "uint256", name: "amount",   type: "uint256" },
      { indexed: true,  internalType: "address", name: "referrer", type: "address" },
      { indexed: false, internalType: "uint256", name: "cycle",    type: "uint256" }
    ],
    name: "Deposited",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "referrer", type: "address" },
      { internalType: "address", name: "referee",  type: "address" }
    ],
    name: "getReferralBonusInfo",
    outputs: [
      { internalType: "uint256", name: "bonusesUsed",     type: "uint256" },
      { internalType: "uint256", name: "bonusesRemaining", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function",
  }
]

const CONTRACT_ADDRESS  = process.env.REACT_APP_CONTRACT_ADDRESS
const RPC_URL           = process.env.REACT_APP_RPC_URL 
const LAUNCH_TIMESTAMP  = 1751500800           // 7am Brisbane 3 Jul 2025
const WEEK_DURATION     = 7 * 24 * 60 * 60      // one week
const GENESIS_BLOCK     = 52634693              // first deposit event 
const BLOCK_CHUNK_SIZE  = 10000                 // chunk size
const REQUEST_DELAY_MS  = 500                   // delay between chunks

// --- Ethers setup --------------------------------------------------
const provider = new ethers.JsonRpcProvider(RPC_URL)
const vault     = new ethers.Contract(CONTRACT_ADDRESS, BlackVaultABI, provider)

// --- Helpers -------------------------------------------------------
function getCurrentWeekIndex() {
  const now   = Math.floor(Date.now() / 1000)
  return Math.floor((now - LAUNCH_TIMESTAMP) / WEEK_DURATION)
}

function getWeekBounds(i) {
  const start = LAUNCH_TIMESTAMP + i * WEEK_DURATION
  return { weekStart: start, weekEnd: start + WEEK_DURATION }
}

async function getBlockByTimestamp(ts) {
  const latest     = await provider.getBlockNumber()
  const latestData = await provider.getBlock(latest)
  const deltaSecs  = latestData.timestamp - ts
  const estBlocks  = Math.floor(deltaSecs / 3)   // ~3s per BSC block
  return Math.max(0, latest - estBlocks)
}

function calculateReferralReward(amount) {
  return (BigInt(amount) * 10n) / 100n
}

async function fetchEventsInChunks(filter, fromB, toB) {
  let all = [], start = fromB
  while (start <= toB) {
    const end = Math.min(start + BLOCK_CHUNK_SIZE - 1, toB)
    console.log(`Fetching blocks ${start}-${end}`)
    const evs = await vault.queryFilter(filter, start, end)
    all = all.concat(evs)
    start = end + 1
    if (start <= toB) await new Promise(r=>setTimeout(r, REQUEST_DELAY_MS))
  }
  return all
}

// --- Aggregators ---------------------------------------------------
async function aggregateWeekly(weekIndex) {
  const { weekStart, weekEnd } = getWeekBounds(weekIndex)
  const fromBlock = await getBlockByTimestamp(weekStart)
  const toBlock   = await getBlockByTimestamp(weekEnd)
  console.log(`Week ${weekIndex} blocks ${fromBlock}-${toBlock}`)

  const filter = vault.filters.Deposited()
  const events = await fetchEventsInChunks(filter, fromBlock, toBlock)
  console.log(`Found ${events.length} deposit events this week`)

  const rewards = {}
  for (const e of events) {
    const r = e.args.referrer.toLowerCase()
    const u = e.args.user.toLowerCase()
    const a = e.args.amount.toString()
    if (r === ethers.ZeroAddress.toLowerCase()) continue

    const info = await vault.getReferralBonusInfo(r, u)
    if (Number(info.bonusesUsed.toString()) <= 3) {
      rewards[r] = (rewards[r] || 0n) + calculateReferralReward(a)
    }
  }

  const sorted = Object.entries(rewards)
    .map(([addr, amt]) => ({ address: addr, totalRewards: amt.toString() }))
    .sort((a,b)=>BigInt(b.totalRewards)-BigInt(a.totalRewards))
    .slice(0,10)
    .map((e,i)=>({ rank: i+1, ...e }))

  return sorted
}

async function aggregateLifetime() {
  const latestBlock = await provider.getBlockNumber()
  console.log(`Lifetime scan ${GENESIS_BLOCK}-${latestBlock}`)

  const filter = vault.filters.Deposited()
  const events = await fetchEventsInChunks(filter, GENESIS_BLOCK, latestBlock)
  console.log(`Found ${events.length} total deposit events`)

  const rewards = {}
  for (const e of events) {
    const r = e.args.referrer.toLowerCase()
    const u = e.args.user.toLowerCase()
    const a = e.args.amount.toString()
    if (r === ethers.ZeroAddress.toLowerCase()) continue

    const info = await vault.getReferralBonusInfo(r, u)
    if (Number(info.bonusesUsed.toString()) <= 3) {
      rewards[r] = (rewards[r] || 0n) + calculateReferralReward(a)
    }
  }

  return Object.entries(rewards)
    .map(([addr, amt]) => ({ address: addr, totalRewards: amt.toString() }))
    .sort((a,b)=>BigInt(b.totalRewards)-BigInt(a.totalRewards))
    .slice(0,10)
    .map((e,i)=>({ rank: i+1, ...e }))
}

// --- Handler -------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" })
  }

  try {
    const weekIndex  = getCurrentWeekIndex()
    const weekly     = await aggregateWeekly(weekIndex)
    const lifetime   = await aggregateLifetime()

    return res.status(200).json({
      success: true,
      weekIndex,
      weeklyLeaderboard: weekly,
      lifetimeLeaderboard: lifetime,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Leaderboard error:", err)
    return res.status(500).json({ error: err.message })
  }
}

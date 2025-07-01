import { ethers } from "ethers"
import BlackVaultAbi from "../../src/contract/BlackVaultABI.json"

// Define LAUNCH_TIMESTAMP directly here
const LAUNCH_TIMESTAMP = 1717804800000 // June 8, 2024 00:00:00 GMT

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" })
  }

  try {
    const rpcUrl = process.env.REACT_APP_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545"
    const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || "0x08b7fCcb9c92cB3C6A3279Bc377F461fD6fD97A1"

    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const contract = new ethers.Contract(contractAddress, BlackVaultAbi, provider)

    const now = Date.now()
    const oneWeek = 7 * 24 * 60 * 60 * 1000
    const timeSinceLaunch = now - LAUNCH_TIMESTAMP
    const weeksSinceLaunch = Math.floor(timeSinceLaunch / oneWeek)
    const currentWeekStartTime = LAUNCH_TIMESTAMP + weeksSinceLaunch * oneWeek

    // Fetch all Deposit events
    const filter = contract.filters.Deposited()
    const events = await contract.queryFilter(filter)

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

    res.status(200).json({ leaderboard })
  } catch (error) {
    console.error("Error fetching weekly leaderboard:", error)
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}

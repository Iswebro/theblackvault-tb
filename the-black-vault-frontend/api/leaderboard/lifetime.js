import { ethers } from "ethers"
import BlackVaultAbi from "../../src/contract/BlackVaultABI.json"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" })
  }

  try {
    const rpcUrl = process.env.REACT_APP_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545"
    const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || "0x08b7fCcb9c92cB3C6A3279Bc377F461fD6fD97A1"

    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const contract = new ethers.Contract(contractAddress, BlackVaultAbi, provider)

    // Fetch all Deposit events
    const filter = contract.filters.Deposited()
    const events = await contract.queryFilter(filter)

    const lifetimeDeposits = {}

    for (const event of events) {
      const userAddress = event.args.user
      const amount = Number.parseFloat(ethers.formatEther(event.args.amount))

      if (!lifetimeDeposits[userAddress]) {
        lifetimeDeposits[userAddress] = 0
      }
      lifetimeDeposits[userAddress] += amount
    }

    const leaderboard = Object.entries(lifetimeDeposits)
      .map(([address, volume]) => ({ address, volume }))
      .sort((a, b) => b.volume - a.volume)

    res.status(200).json({ leaderboard })
  } catch (error) {
    console.error("Error fetching lifetime leaderboard:", error)
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
}

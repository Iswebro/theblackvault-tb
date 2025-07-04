import { ethers } from "ethers"
import BlackVaultABI from "../../src/contract/BlackVaultABI.json"

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS
const RPC_URL = process.env.REACT_APP_RPC_URL

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { address } = req.query

  if (!address) {
    return res.status(400).json({ error: "Address parameter required" })
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, BlackVaultABI, provider)

    // Get user vault data
    const vaultData = await contract.getUserVault(address)
    const currentCycle = await contract.getCurrentCycle()
    const dailyRate = await contract.DAILY_RATE()

    const activeAmount = vaultData.activeAmount
    const lastAccrualCycle = vaultData.lastAccrualCycle
    const pendingRewards = vaultData.pendingRewards

    // Calculate additional rewards since last accrual
    const cyclesPassed = Math.max(0, Number(currentCycle) - Number(lastAccrualCycle))
    const additionalRewards = (activeAmount * dailyRate * BigInt(cyclesPassed)) / BigInt(1000)
    const totalRewards = pendingRewards + additionalRewards

    res.status(200).json({
      activeAmount: ethers.formatEther(activeAmount),
      pendingRewards: ethers.formatEther(pendingRewards),
      calculatedRewards: ethers.formatEther(totalRewards),
      cyclesPassed,
      currentCycle: currentCycle.toString(),
      lastAccrualCycle: lastAccrualCycle.toString(),
    })
  } catch (error) {
    console.error("Error calculating rewards:", error)
    res.status(500).json({ error: "Failed to calculate rewards" })
  }
}

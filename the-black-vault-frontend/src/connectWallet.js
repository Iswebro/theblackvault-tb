import { BrowserProvider } from "ethers"
import { config } from "./lib/config"

export async function connectInjected() {
  if (!window.ethereum) {
    throw new Error("No wallet found. Please install MetaMask or use a Web3 browser.")
  }

  try {
    console.log(`Attempting to connect to: ${config.CHAIN_NAME}`)

    // Try to switch to the target network
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: config.NETWORK_CONFIG.chainId }],
      })
      console.log(`Switched to ${config.CHAIN_NAME}`)
    } catch (switchError) {
      // If network is not added, prompt user to add it
      if (switchError.code === 4902) {
        console.log(`Adding ${config.CHAIN_NAME} to wallet...`)
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [config.NETWORK_CONFIG],
        })
      } else {
        console.error("Failed to switch network:", switchError)
        throw switchError
      }
    }

    // Request account access
    const [account] = await window.ethereum.request({
      method: "eth_requestAccounts",
    })
    console.log("Accounts requested, got:", account)

    const provider = new BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    // Final verification
    const network = await provider.getNetwork()
    if (network.chainId.toString() !== config.CHAIN_ID.toString()) {
      throw new Error(`Please switch to ${config.CHAIN_NAME} in your wallet.`)
    }
    console.log(`Successfully connected to ${network.name} (Chain ID: ${network.chainId})`)

    return { provider, signer, account }
  } catch (error) {
    console.error("Wallet connection failed:", error)
    throw new Error(error.message || "Failed to connect wallet. Please check your wallet and refresh.")
  }
}

export function getReferralFromURL() {
  const urlParams = new URLSearchParams(window.location.search)
  const ref = urlParams.get("ref")
  return ref && ref.startsWith("0x") && ref.length === 42 ? ref : "0x0000000000000000000000000000000000000000"
}

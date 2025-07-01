// src/connectWallet.js
import { BrowserProvider } from "ethers"

// BSC Testnet configuration
const BSC_TESTNET = {
  chainId: "0x61", // 97 in hex
  chainName: "BSC Testnet",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
  blockExplorerUrls: ["https://testnet.bscscan.com/"],
}

// BSC Mainnet configuration
const BSC_MAINNET = {
  chainId: "0x38", // 56 in hex
  chainName: "Binance Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: ["https://bsc-dataseed.binance.org/"],
  blockExplorerUrls: ["https://bscscan.com/"],
}

export async function connectInjected() {
  if (!window.ethereum) {
    throw new Error("No wallet found. Please install MetaMask or use a Web3 browser.")
  }

  try {
    // Determine which network to use based on environment
    const targetChainId = process.env.REACT_APP_CHAIN_ID || "97"
    const isTestnet = targetChainId === "97"
    const networkConfig = isTestnet ? BSC_TESTNET : BSC_MAINNET

    console.log(`Connecting to ${networkConfig.chainName}...`)

    // Try to switch to the target network
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: networkConfig.chainId }],
      })
    } catch (switchError) {
      // If network is not added, add it
      if (switchError.code === 4902) {
        console.log(`Adding ${networkConfig.chainName} to wallet...`)
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [networkConfig],
        })
      } else {
        throw switchError
      }
    }

    // Request account access
    const [account] = await window.ethereum.request({
      method: "eth_requestAccounts",
    })

    const provider = new BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    // Verify we're on the correct network
    const network = await provider.getNetwork()
    console.log(`Connected to ${networkConfig.chainName} (Chain ID: ${network.chainId})`)

    return { provider, signer, account }
  } catch (error) {
    console.error("Connection failed:", error)
    throw new Error(error.message || "Failed to connect wallet")
  }
}

export function getReferralFromURL() {
  const urlParams = new URLSearchParams(window.location.search)
  const ref = urlParams.get("ref")
  return ref && ref.startsWith("0x") && ref.length === 42 ? ref : "0x0000000000000000000000000000000000000000"
}

// Helper function to add BSC Testnet to wallet manually
export async function addBSCTestnet() {
  if (!window.ethereum) return false

  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [BSC_TESTNET],
    })
    return true
  } catch (error) {
    console.error("Failed to add BSC Testnet:", error)
    return false
  }
}

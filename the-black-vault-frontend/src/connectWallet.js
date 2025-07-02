// src/connectWallet.js
import { BrowserProvider } from "ethers"
import { config } from "./lib/config.ts"

const targetNetwork = {
  chainId: `0x${config.chainId.toString(16)}`,
  chainName: config.chainName,
  nativeCurrency: { name: "BNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: [config.rpcUrl],
  blockExplorerUrls: [config.blockExplorer],
}

export async function connectInjected() {
  if (!window.ethereum) {
    throw new Error("No wallet found. Please install MetaMask or use a Web3 browser.")
  }

  try {
    // Try to switch to the target network
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetNetwork.chainId }],
      })
    } catch (switchError) {
      // If network is not added, add it
      if (switchError.code === 4902) {
        console.log(`Adding ${targetNetwork.chainName} to wallet...`)
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [targetNetwork],
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
    if (Number(network.chainId) !== config.chainId) {
      throw new Error(`Please connect to ${config.chainName}. You are on Chain ID ${network.chainId}.`)
    }

    console.log(`Connected to ${config.chainName} (Account: ${account})`)

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

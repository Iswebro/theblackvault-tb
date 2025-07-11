// src/connectWallet.js
import { BrowserProvider } from "ethers"
import { config } from "./lib/config.ts"

const targetNetwork = {
  chainId: `0x${config.chainId.toString(16)}`, // 0x38 for BSC Mainnet
  chainName: config.chainName,
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  rpcUrls: [config.rpcUrl],
  blockExplorerUrls: [config.blockExplorer],
}

// Alternative BSC Mainnet configuration for Trust Wallet
const bscMainnetConfig = {
  chainId: "0x38", // 56 in hex
  chainName: "Smart Chain",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  rpcUrls: [
    "https://bsc-dataseed.binance.org/",
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed1.ninicoin.io/",
  ],
  blockExplorerUrls: ["https://bscscan.com/"],
}

export async function connectInjected() {
  // Check if we're in Trust Wallet's in-app browser
  const isTrustWallet = window.ethereum && window.ethereum.isTrust
  const isMetaMask = window.ethereum && window.ethereum.isMetaMask

  if (!window.ethereum) {
    throw new Error("No wallet found. Please install MetaMask or use Trust Wallet's in-app browser.")
  }

  console.log("Wallet detected:", {
    isTrustWallet,
    isMetaMask,
    ethereum: !!window.ethereum,
  })

  try {
    // First, try to get current chain ID
    let currentChainId
    try {
      currentChainId = await window.ethereum.request({ method: "eth_chainId" })
      console.log("Current chain ID:", currentChainId, "Target:", targetNetwork.chainId)
    } catch (error) {
      console.log("Could not get current chain ID:", error)
      currentChainId = "0x1" // Default to Ethereum mainnet
    }

    // Only switch network if we're not already on BSC Mainnet
    if (currentChainId !== targetNetwork.chainId && currentChainId !== "0x38") {
      try {
        console.log("Attempting to switch to BSC Mainnet...")

        // Try with our config first
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetNetwork.chainId }],
        })
        console.log("Network switched successfully with primary config")
      } catch (switchError) {
        console.log("Primary switch failed, trying alternative config:", switchError)

        // If switch fails, try to add the network
        if (switchError.code === 4902 || switchError.code === -32603) {
          try {
            console.log("Adding BSC Mainnet to wallet...")

            // Try with Trust Wallet optimized config
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [bscMainnetConfig],
            })
            console.log("BSC Mainnet added successfully")
          } catch (addError) {
            console.log("Failed to add BSC Mainnet, trying primary config:", addError)

            // Fallback to primary config
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [targetNetwork],
            })
            console.log("Network added with primary config")
          }
        } else {
          // Try alternative switch with BSC config
          try {
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x38" }],
            })
            console.log("Network switched with alternative config")
          } catch (altSwitchError) {
            console.error("All network switch attempts failed:", altSwitchError)
            throw new Error("Failed to switch to BSC Mainnet. Please manually add BSC network to your wallet.")
          }
        }
      }
    }

    // Request account access
    console.log("Requesting account access...")
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    })

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from wallet")
    }

    const account = accounts[0]
    console.log("Account connected:", account)

    // Create provider and signer
    const provider = new BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    // Verify we're on the correct network
    const network = await provider.getNetwork()
    console.log("Connected to network:", network.chainId, network.name)

    if (Number(network.chainId) !== 56) {
      throw new Error(`Please connect to BSC Mainnet (Chain ID: 56). Currently on Chain ID: ${network.chainId}`)
    }

    console.log(`✅ Successfully connected to BSC Mainnet`)
    console.log(`📍 Account: ${account}`)

    return { provider, signer, account }
  } catch (error) {
    console.error("Connection failed:", error)

    // Safe error handling
    let errorMessage = "Failed to connect wallet"

    if (error) {
      if (typeof error === "string") {
        errorMessage = error
      } else if (error.message) {
        errorMessage = error.message
      } else if (error.code) {
        switch (error.code) {
          case 4001:
            errorMessage = "Connection rejected by user"
            break
          case -32002:
            errorMessage = "Connection request already pending. Please check your wallet."
            break
          case 4902:
            errorMessage = "BSC Mainnet not found in wallet. Please add it manually."
            break
          case -32603:
            errorMessage = "Network switch failed. Please manually switch to BSC Mainnet."
            break
          default:
            errorMessage = `Wallet error (code: ${error.code})`
        }
      }
    }

    // Provide specific guidance for common issues
    if (errorMessage.includes("not supported chainID") || errorMessage.includes("chainId")) {
      errorMessage =
        "BSC Mainnet not configured in your wallet. Please add BSC network manually or try a different wallet."
    } else if (errorMessage.includes("No wallet found")) {
      errorMessage = "Please use Trust Wallet's in-app browser or install MetaMask"
    } else if (errorMessage.includes("rejected") || errorMessage.includes("cancelled")) {
      errorMessage = "Connection cancelled. Please try again and approve the connection."
    } else if (errorMessage.includes("pending")) {
      errorMessage = "Connection already in progress. Please check your wallet app."
    }

    throw new Error(errorMessage)
  }
}

export function getReferralFromURL() {
  const urlParams = new URLSearchParams(window.location.search)
  const ref = urlParams.get("ref")
  return ref && ref.startsWith("0x") && ref.length === 42 ? ref : "0x0000000000000000000000000000000000000000"
}

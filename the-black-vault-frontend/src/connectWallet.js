// src/connectWallet.js
import { BrowserProvider } from "ethers"
import { config } from "./lib/config.ts"

const targetNetwork = {
  chainId: `0x${config.chainId.toString(16)}`,
  chainName: config.chainName,
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, // Fixed: should be BNB, not tBNB for mainnet
  rpcUrls: [config.rpcUrl],
  blockExplorerUrls: [config.blockExplorer],
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
    // For Trust Wallet, we need to be more explicit about network switching
    const currentChainId = await window.ethereum.request({ method: "eth_chainId" })
    console.log("Current chain ID:", currentChainId, "Target:", targetNetwork.chainId)

    // Only switch network if we're not already on the correct one
    if (currentChainId !== targetNetwork.chainId) {
      try {
        console.log(`Switching to ${targetNetwork.chainName}...`)
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetNetwork.chainId }],
        })
        console.log("Network switched successfully")
      } catch (switchError) {
        console.log("Switch error:", switchError)
        // If network is not added, add it
        if (switchError.code === 4902 || switchError.code === -32603) {
          console.log(`Adding ${targetNetwork.chainName} to wallet...`)
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [targetNetwork],
          })
          console.log("Network added successfully")
        } else {
          throw switchError
        }
      }
    }

    // Request account access with explicit permissions
    console.log("Requesting account access...")
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    })

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from wallet")
    }

    const account = accounts[0]
    console.log("Account connected:", account)

    const provider = new BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    // Double-check we're on the correct network after connection
    const network = await provider.getNetwork()
    console.log("Connected to network:", network.chainId, network.name)

    if (Number(network.chainId) !== config.chainId) {
      throw new Error(`Please connect to ${config.chainName}. Currently on Chain ID ${network.chainId}.`)
    }

    console.log(`✅ Successfully connected to ${config.chainName}`)
    console.log(`📍 Account: ${account}`)

    return { provider, signer, account }
  } catch (error) {
    console.error("Connection failed:", error)

    // Safe error handling - check if error exists and has properties
    let errorMessage = "Failed to connect wallet"

    if (error) {
      if (typeof error === "string") {
        errorMessage = error
      } else if (error.message) {
        errorMessage = error.message
      } else if (error.code) {
        // Handle specific error codes
        switch (error.code) {
          case 4001:
            errorMessage = "Connection rejected by user"
            break
          case -32002:
            errorMessage = "Connection request already pending. Please check your wallet."
            break
          case 4902:
            errorMessage = "Network not found in wallet. Please add BSC Mainnet manually."
            break
          default:
            errorMessage = `Wallet error (code: ${error.code})`
        }
      }
    }

    // Provide more specific error messages based on content
    if (errorMessage.includes("No wallet found")) {
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

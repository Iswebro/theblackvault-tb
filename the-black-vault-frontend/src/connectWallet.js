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
    "https://rpc.ankr.com/multichain/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4",
    "https://rpc.ankr.com/bsc",
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
  const isAndroid = /Android/i.test(navigator.userAgent)

  if (!window.ethereum) {
    throw new Error("No wallet found. Please install MetaMask or use Trust Wallet's in-app browser.")
  }

  console.log("Wallet detected:", {
    isTrustWallet,
    isMetaMask,
    isAndroid,
    ethereum: !!window.ethereum,
    userAgent: navigator.userAgent
  })

  // Trust Wallet Android specific optimizations
  if (isTrustWallet && isAndroid) {
    console.log("🔧 Applying Trust Wallet Android optimizations...")
    
    // Set longer timeout for Trust Wallet Android
    const originalTimeout = window.ethereum.timeout || 60000
    if (window.ethereum.timeout) {
      window.ethereum.timeout = 120000 // 2 minutes for Android Trust Wallet
    }
    
    // Add delay to prevent rapid connect/disconnect cycles
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  try {
    // For Trust Wallet Android, use a more gentle approach
    if (isTrustWallet && isAndroid) {
      console.log("🔧 Using Trust Wallet Android optimized flow...")
      
      // First, check if we're already connected
      let accounts = []
      try {
        accounts = await window.ethereum.request({ 
          method: "eth_accounts" 
        })
        console.log("Existing accounts found:", accounts.length)
      } catch (error) {
        console.log("No existing accounts:", error)
      }
      
      // If no accounts, request connection with longer timeout
      if (accounts.length === 0) {
        console.log("Requesting new connection...")
        accounts = await Promise.race([
          window.ethereum.request({
            method: "eth_requestAccounts",
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Connection timeout after 30 seconds")), 30000)
          )
        ])
      }
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from Trust Wallet")
      }
      
      const account = accounts[0]
      console.log("Trust Wallet account connected:", account)
      
      // Create provider with Trust Wallet specific settings
      const provider = new BrowserProvider(window.ethereum)
      
      // For Trust Wallet Android, skip network validation initially
      // and handle it more gracefully
      let signer
      try {
        signer = await provider.getSigner()
      } catch (signerError) {
        console.log("Signer creation delayed, retrying...")
        await new Promise(resolve => setTimeout(resolve, 1000))
        signer = await provider.getSigner()
      }
      
      // Gentle network check for Trust Wallet
      try {
        const network = await provider.getNetwork()
        console.log("Connected to network:", network.chainId, network.name)
        
        if (Number(network.chainId) !== 56) {
          console.log("Not on BSC, will attempt gentle switch...")
          // Don't throw immediately, try to switch
          try {
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x38" }],
            })
            console.log("Successfully switched to BSC")
          } catch (switchError) {
            console.log("Network switch failed, but continuing with connection...")
            // Don't throw error for Trust Wallet Android, let user switch manually
          }
        }
      } catch (networkError) {
        console.log("Network check failed, continuing anyway:", networkError)
      }
      
      console.log(`✅ Trust Wallet Android connected successfully`)
      console.log(`📍 Account: ${account}`)
      
      return { provider, signer, account }
    }
    
    // Standard flow for other wallets
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

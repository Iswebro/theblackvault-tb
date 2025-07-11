"use client"

import { BrowserProvider } from "ethers"
import { config } from "./lib/config.ts"
import { createWeb3Modal, defaultConfig } from "@web3modal/ethers/react"

// WalletConnect Project ID
const projectId = "ec1a030594f38292648794d4587912f4" // Hardcoded WalletConnect Project ID
if (!projectId) {
  console.error(
    "WalletConnect Project ID is not set. Please set REACT_APP_WALLETCONNECT_PROJECT_ID environment variable.",
  )
  // In a production app, you might want to throw an error here or disable WalletConnect features.
}

// BNB Chain Configuration for WalletConnect and Injected Wallets
const bnbChain = {
  chainId: config.chainId, // 56
  name: config.chainName, // "Smart Chain"
  currency: "BNB", // Native currency symbol for BNB Chain
  explorerUrl: config.blockExplorer,
  rpcUrl: config.rpcUrl,
}
const chains = [bnbChain]

// Web3Modal metadata (customize with your app's details)
const metadata = {
  name: "BlackVault",
  description: "Premium USDT Staking Platform on Binance Smart Chain",
  url: "https://blackvault.vercel.app", // Replace with your actual app URL
  icons: ["https://blackvault.vercel.app/logo192.png"], // Replace with your actual logo
}

// Initialize Web3Modal instance (will be created once)
let web3ModalInstance = null
function getWeb3Modal() {
  if (!web3ModalInstance) {
    const ethersConfig = defaultConfig({
      metadata,
      defaultChainId: bnbChain.chainId,
      rpcUrl: bnbChain.rpcUrl,
      enableEIP6963: true, // Enable WalletConnect's EIP-6963 for better wallet discovery
      enableUniversal: true, // Enable Universal Links for mobile apps
      enableCoinbase: true, // Enable Coinbase Wallet support
    })

    web3ModalInstance = createWeb3Modal({
      ethersConfig,
      chains,
      projectId,
      enableAnalytics: true, // Optional: defaults to false
      themeMode: "dark",
      themeVariables: {
        "--w3m-font-family": "Roboto, sans-serif",
        "--w3m-accent-color": "#1a1a1a", // Deep charcoal
        "--w3m-accent-fill-color": "#e0e0e0", // Light platinum
        "--w3m-background-color": "#101010", // Pure black
        "--w3m-overlay-background-color": "rgba(0, 0, 0, 0.8)",
        "--w3m-z-index": 2000, // Ensure modal is on top
      },
    })
    console.log("Web3Modal initialized.")
  }
  return web3ModalInstance
}

/**
 * Connects to an injected wallet (e.g., MetaMask, Trust Wallet on iOS).
 * Handles network switching/adding for BNB Chain.
 * @returns {Promise<{provider: BrowserProvider, signer: import('ethers').Signer, account: string}>}
 */
async function connectInjectedInternal() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found. Please install MetaMask or use Trust Wallet's in-app browser.")
  }

  console.log("Injected wallet detected:", {
    isTrustWallet: window.ethereum.isTrust,
    isMetaMask: window.ethereum.isMetaMask,
    ethereum: !!window.ethereum,
  })

  try {
    // Request account access
    console.log("Requesting account access from injected wallet...")
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from injected wallet.")
    }
    const account = accounts[0]

    // Create provider and signer
    const provider = new BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    // Verify network and switch if necessary
    const network = await provider.getNetwork()
    console.log("Connected to network (injected):", network.chainId, network.name)

    if (Number(network.chainId) !== bnbChain.chainId) {
      console.log(`Attempting to switch injected wallet to ${bnbChain.name} (Chain ID: ${bnbChain.chainId})...`)
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${bnbChain.chainId.toString(16)}` }],
        })
        // Re-get provider/signer after successful switch
        const newProvider = new BrowserProvider(window.ethereum)
        const newSigner = await newProvider.getSigner()
        const newNetwork = await newProvider.getNetwork()
        if (Number(newNetwork.chainId) !== bnbChain.chainId) {
          throw new Error(
            `Failed to switch to ${bnbChain.name}. Please manually switch to Chain ID: ${bnbChain.chainId}.`,
          )
        }
        console.log("Injected wallet switched network successfully.")
        return { provider: newProvider, signer: newSigner, account }
      } catch (switchError) {
        console.error("Injected wallet network switch failed:", switchError)
        // Handle common errors for unrecognized chain or internal error (often means chain not added)
        if (switchError.code === 4902 || switchError.code === -32603) {
          console.log(`Attempting to add ${bnbChain.name} to injected wallet...`)
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${bnbChain.chainId.toString(16)}`,
                  chainName: bnbChain.name,
                  nativeCurrency: {
                    name: bnbChain.currency,
                    symbol: bnbChain.currency,
                    decimals: 18,
                  },
                  rpcUrls: [bnbChain.rpcUrl],
                  blockExplorerUrls: [bnbChain.explorerUrl],
                },
              ],
            })
            // Re-get provider/signer after adding network
            const newProvider = new BrowserProvider(window.ethereum)
            const newSigner = await newProvider.getSigner()
            const newNetwork = await newProvider.getNetwork()
            if (Number(newNetwork.chainId) !== bnbChain.chainId) {
              throw new Error(
                `Failed to add and switch to ${bnbChain.name}. Please manually add and switch to Chain ID: ${bnbChain.chainId}.`,
              )
            }
            console.log("Injected wallet network added and switched successfully.")
            return { provider: newProvider, signer: newSigner, account }
          } catch (addError) {
            console.error("Injected wallet network add failed:", addError)
            throw new Error(
              `Failed to add or switch to ${bnbChain.name}. Please manually add BSC network to your wallet.`,
            )
          }
        } else {
          throw new Error(
            `Failed to switch to ${bnbChain.name}. Please manually switch to Chain ID: ${bnbChain.chainId}.`,
          )
        }
      }
    }

    console.log(`✅ Successfully connected injected wallet to ${bnbChain.name}`)
    console.log(`📍 Account: ${account}`)
    return { provider, signer, account }
  } catch (error) {
    console.error("Injected connection failed:", error)
    let errorMessage = "Failed to connect injected wallet."
    if (error.code === 4001) errorMessage = "Connection rejected by user."
    else if (error.code === -32002) errorMessage = "Connection request already pending. Please check your wallet."
    else if (error.message) errorMessage = error.message
    throw new Error(errorMessage)
  }
}

/**
 * Connects using WalletConnect.
 * @returns {Promise<{provider: BrowserProvider, signer: import('ethers').Signer, account: string}>}
 */
async function connectWalletConnectInternal() {
  const web3Modal = getWeb3Modal()
  if (!web3Modal) {
    throw new Error("WalletConnect is not initialized. Check console for errors.")
  }

  try {
    console.log("Opening WalletConnect modal...")
    await web3Modal.open()

    console.log("Getting WalletConnect provider and signer...")
    const walletProvider = web3Modal.getProvider()
    const provider = new BrowserProvider(walletProvider)
    const signer = await provider.getSigner()
    const account = await signer.getAddress()

    // Verify network (Web3Modal usually handles this, but as a fallback)
    const network = await provider.getNetwork()
    if (Number(network.chainId) !== bnbChain.chainId) {
      console.warn(`WalletConnect connected to wrong chain (${network.chainId}). Attempting to switch...`)
      try {
        await web3Modal.switchNetwork(bnbChain.chainId)
        // Re-get provider/signer after switch
        const newWalletProvider = web3Modal.getProvider()
        const newProvider = new BrowserProvider(newWalletProvider)
        const newSigner = await newProvider.getSigner()
        const newNetwork = await newProvider.getNetwork()
        if (Number(newNetwork.chainId) !== bnbChain.chainId) {
          throw new Error(`Failed to switch WalletConnect to ${bnbChain.name}.`)
        }
        console.log("WalletConnect switched network successfully.")
        return { provider: newProvider, signer: newSigner, account }
      } catch (switchError) {
        console.error("WalletConnect network switch failed:", switchError)
        throw new Error(
          `Failed to switch WalletConnect to ${bnbChain.name}. Please ensure your wallet supports BSC Mainnet.`,
        )
      }
    }

    console.log(`✅ Successfully connected WalletConnect to ${bnbChain.name}`)
    console.log(`📍 Account: ${account}`)
    return { provider, signer, account }
  } catch (error) {
    console.error("WalletConnect connection failed:", error)
    let errorMessage = "Failed to connect WalletConnect."
    if (error.message && error.message.includes("User rejected")) errorMessage = "Connection rejected by user."
    else if (error.message) errorMessage = error.message
    throw new Error(errorMessage)
  }
}

/**
 * Main function to connect a wallet.
 * Prioritizes injected wallets unless on Android Trust Wallet, then falls back to WalletConnect.
 * @param {string | null} preferredType - Optional. 'injected' or 'walletconnect' to force a type.
 * @returns {Promise<{provider: BrowserProvider, signer: import('ethers').Signer, account: string}>}
 */
export async function connectWallet(preferredType = null) {
  const isAndroidTrustWallet = window.ethereum && window.ethereum.isTrust && navigator.userAgent.includes("Android")
  let provider, signer, account
  let walletTypeUsed = null

  try {
    if (preferredType === "injected" || (!preferredType && window.ethereum && !isAndroidTrustWallet)) {
      // Try injected first, unless it's Android Trust Wallet or no window.ethereum
      console.log("Attempting connection via Injected Wallet (e.g., MetaMask, Trust Wallet iOS)...")
      try {
        const conn = await connectInjectedInternal()
        provider = conn.provider
        signer = conn.signer
        account = conn.account
        walletTypeUsed = "injected"
      } catch (injectedError) {
        console.warn("Injected wallet connection failed, falling back to WalletConnect:", injectedError.message)
        // Fallback to WalletConnect if injected fails
        const conn = await connectWalletConnectInternal()
        provider = conn.provider
        signer = conn.signer
        account = conn.account
        walletTypeUsed = "walletconnect"
      }
    } else {
      // Prioritize WalletConnect if preferred, or if it's Android Trust Wallet, or no injected wallet
      console.log("Attempting connection via WalletConnect (e.g., Trust Wallet Android, other mobile wallets)...")
      const conn = await connectWalletConnectInternal()
      provider = conn.provider
      signer = conn.signer
      account = conn.account
      walletTypeUsed = "walletconnect"
    }

    if (provider && signer && account) {
      localStorage.setItem("walletType", walletTypeUsed)
      localStorage.setItem("connectedAccount", account)
      console.log(`Successfully connected with ${walletTypeUsed} wallet.`)
      return { provider, signer, account }
    } else {
      throw new Error("Failed to establish a wallet connection.")
    }
  } catch (error) {
    console.error("connectWallet (main) failed:", error)
    localStorage.removeItem("walletType")
    localStorage.removeItem("connectedAccount")
    // Re-throw for App.js to handle with toasts
    throw error
  }
}

/**
 * Attempts to auto-reconnect based on previously stored localStorage state.
 * @returns {Promise<{provider: BrowserProvider, signer: import('ethers').Signer, account: string} | null>}
 */
export async function autoReconnect() {
  const walletType = localStorage.getItem("walletType")
  const connectedAccount = localStorage.getItem("connectedAccount")

  if (walletType && connectedAccount) {
    console.log(`Attempting auto-reconnect with ${walletType} for account ${connectedAccount}...`)
    try {
      const { provider, signer, account } = await connectWallet(walletType)
      console.log("Auto-reconnect successful.")
      return { provider, signer, account }
    } catch (error) {
      console.error("Auto-reconnect failed:", error)
      localStorage.removeItem("walletType")
      localStorage.removeItem("connectedAccount")
      return null
    }
  }
  return null
}

/**
 * Disconnects the currently connected wallet and clears localStorage.
 */
export async function disconnectWallet() {
  const walletType = localStorage.getItem("walletType")
  const web3Modal = getWeb3Modal() // Ensure Web3Modal is initialized if needed for disconnect

  if (walletType === "walletconnect" && web3Modal && web3Modal.getProvider()) {
    try {
      await web3Modal.disconnect()
      console.log("WalletConnect session disconnected.")
    } catch (error) {
      console.error("Error disconnecting WalletConnect session:", error)
    }
  }
  localStorage.removeItem("walletType")
  localStorage.removeItem("connectedAccount")
  console.log("Wallet disconnected and localStorage cleared.")
}

/**
 * Helper function to extract referral address from URL.
 * (Existing functionality, kept as is)
 */
export function getReferralFromURL() {
  const urlParams = new URLSearchParams(window.location.search)
  const ref = urlParams.get("ref")
  return ref && ref.startsWith("0x") && ref.length === 42 ? ref : "0x0000000000000000000000000000000000000000"
}

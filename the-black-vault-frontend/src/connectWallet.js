import { BrowserProvider } from "ethers"

// Configuration is now read directly from environment variables here
const CHAIN_ID = Number.parseInt(process.env.REACT_APP_CHAIN_ID || "97")
const CHAIN_NAME = process.env.REACT_APP_CHAIN_NAME || "BSC Testnet"
const RPC_URL = process.env.REACT_APP_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545"
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "ec1a030594f38292648794d4587912f4"

export async function connectInjected() {
  if (window.ethereum) {
    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
      const account = accounts[0]

      // Check if the connected chain is the desired one
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" })
      if (Number.parseInt(currentChainId, 16) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          })
        } catch (switchError) {
          // This error code indicates that the chain has not been added to MetaMask.
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: `0x${CHAIN_ID.toString(16)}`,
                    chainName: CHAIN_NAME,
                    rpcUrls: [RPC_URL],
                    nativeCurrency: {
                      name: "BNB",
                      symbol: "BNB",
                      decimals: 18,
                    },
                    blockExplorerUrls: [process.env.REACT_APP_BLOCK_EXPLORER],
                  },
                ],
              })
            } catch (addError) {
              throw new Error("Failed to add the network to MetaMask: " + addError.message)
            }
          } else {
            throw new Error("Failed to switch network: " + switchError.message)
          }
        }
      }

      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      return { provider, signer, account }
    } catch (error) {
      console.error("Error connecting to MetaMask:", error)
      throw new Error("Failed to connect to MetaMask. Please ensure it's installed and unlocked.")
    }
  } else {
    throw new Error("MetaMask is not installed. Please install it to use this app.")
  }
}

export function getReferralFromURL() {
  const params = new URLSearchParams(window.location.search)
  const ref = params.get("ref")
  // Basic validation for a potential address
  if (ref && ref.startsWith("0x") && ref.length === 42) {
    return ref
  }
  return ""
}

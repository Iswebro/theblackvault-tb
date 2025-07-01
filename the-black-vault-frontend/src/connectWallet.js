import { BrowserProvider } from "ethers"
import { config } from "./lib/config.ts"

const CHAIN_ID = config.chainId.toString()
const CHAIN_NAME = config.chainName
const RPC_URL = config.rpcUrl
const BLOCK_EXPLORER = config.blockExplorer

export async function connectInjected() {
  if (!window.ethereum) {
    throw new Error("No wallet found. Please open in MetaMask or Trust Wallet browser.")
  }

  try {
    // Switch to correct network first
    const chainIdHex = `0x${Number.parseInt(CHAIN_ID).toString(16)}`
    console.log("Attempting to switch to network:", {
      chainId: CHAIN_ID,
      chainIdHex,
      chainName: CHAIN_NAME,
      rpcUrl: RPC_URL,
    })

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      })
      console.log("Successfully switched to network")
    } catch (switchError) {
      console.log("Network switch error:", switchError)
      // If network is not added, add it
      if (switchError.code === 4902) {
        console.log("Adding network to wallet...")
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: CHAIN_NAME,
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [BLOCK_EXPLORER],
            },
          ],
        })
        console.log("Network added successfully")
      } else {
        throw switchError
      }
    }

    // Request account access
    const [account] = await window.ethereum.request({ method: "eth_requestAccounts" })
    const provider = new BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    // Verify we're on the correct network
    const network = await provider.getNetwork()
    console.log("Connected to network:", network)

    if (network.chainId !== BigInt(CHAIN_ID)) {
      throw new Error(`Wrong network! Expected chain ID ${CHAIN_ID}, got ${network.chainId}`)
    }

    console.log("Wallet connected successfully:", {
      account,
      chainId: network.chainId.toString(),
      chainName: network.name,
    })

    return { provider, signer, account }
  } catch (err) {
    console.error("Connection failed", err)
    throw err
  }
}

// Get referral from URL
export function getReferralFromURL() {
  const urlParams = new URLSearchParams(window.location.search)
  const ref = urlParams.get("ref")
  return ref && ref.length === 42 && ref.startsWith("0x") ? ref : "0x0000000000000000000000000000000000000000"
}

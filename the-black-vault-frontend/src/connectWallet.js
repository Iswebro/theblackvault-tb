import { BrowserProvider } from "ethers"

// This function now reads environment variables directly to avoid import issues.
export async function connectInjected() {
  if (!window.ethereum) {
    throw new Error("No wallet found. Please install MetaMask or use a Web3 browser.")
  }

  try {
    // Determine which network to use based on environment variables
    const targetChainId = process.env.REACT_APP_CHAIN_ID || "97" // Default to BSC Testnet
    const isTestnet = targetChainId === "97"

    const networkConfig = {
      chainId: isTestnet ? "0x61" : "0x38", // 97 for testnet, 56 for mainnet
      chainName: isTestnet ? "BSC Testnet" : "Binance Smart Chain",
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      rpcUrls: [isTestnet ? "https://data-seed-prebsc-1-s1.binance.org:8545" : "https://bsc-dataseed.binance.org/"],
      blockExplorerUrls: [isTestnet ? "https://testnet.bscscan.com/" : "https://bscscan.com/"],
    }

    console.log(`Attempting to connect to: ${networkConfig.chainName}`)

    // Try to switch to the target network
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: networkConfig.chainId }],
      })
      console.log(`Switched to ${networkConfig.chainName}`)
    } catch (switchError) {
      // If network is not added, prompt user to add it
      if (switchError.code === 4902) {
        console.log(`Adding ${networkConfig.chainName} to wallet...`)
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [networkConfig],
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
    if (network.chainId.toString() !== targetChainId) {
      throw new Error(`Please switch to ${networkConfig.chainName} in your wallet.`)
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

// Network configuration

// Hardcoded config for BSC Mainnet (or Testnet if you wish)
export const config = {
  // Contract settings
  contractAddress: "0xDe58F2cb3Bc62dfb9963f422d0DB079B2407a719", // <-- set to your deployed contract address
  usdtAddress:     "0x55d398326f99059fF775485246999027B3197955", // <-- set to your USDT token address

  // Network settings
  chainId: 56, // 56 for BSC Mainnet, 97 for Testnet
  chainName: "Binance Smart Chain Mainnet",
  rpcUrl: "https://bsc-dataseed.binance.org/",
  blockExplorer: "https://bscscan.com",

  // WalletConnect
  walletConnectProjectId: "YOUR_WALLETCONNECT_PROJECT_ID", // <-- replace if needed

  // Helper functions
  isTestnet: function () {
    return this.chainId === 97
  },

  getExplorerUrl: function (txHash: string) {
    return `${this.blockExplorer}/tx/${txHash}`
  },

  getAddressUrl: function (address: string) {
    return `${this.blockExplorer}/address/${address}`
  },
}

// Export individual values for convenience
export const { contractAddress, usdtAddress, chainId, chainName, rpcUrl, blockExplorer, walletConnectProjectId } =
  config

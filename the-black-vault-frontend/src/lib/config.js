// Network configuration

// Hardcoded config for BSC Mainnet (or Testnet if you wish)
export const config = {
  // Contract settings
  contractAddress: "0x69945377574869DFDc646070947F759078103a8b", // <-- set to your deployed contract address
  usdtAddress:     "0x55d398326f99059fF775485246999027B3197955", // <-- set to your USDT token address

  // Network settings
  chainId: 56, // 56 for BSC Mainnet, 97 for Testnet
  chainName: "Binance Smart Chain Mainnet",
  rpcUrl: "https://bsc-dataseed.binance.org/",
  blockExplorer: "https://bscscan.com",

  // WalletConnect
  walletConnectProjectId: "ec1a030594f38292648794d4587912f4", // <-- replace if needed

  // Helper functions
  isTestnet: function () {
    return this.chainId === 97
  },

  getExplorerUrl: function (txHash) {
    return `${this.blockExplorer}/tx/${txHash}`
  },

  getAddressUrl: function (address) {
    return `${this.blockExplorer}/address/${address}`
  },
}

// Export individual values for convenience
export const { contractAddress, usdtAddress, chainId, chainName, rpcUrl, blockExplorer, walletConnectProjectId } =
  config

// src/lib/config.ts
// Network configuration
export const config = {
  contractAddress: process.env.REACT_APP_CONTRACT_ADDRESS!,
  oldContractAddress: process.env.REACT_APP_OLD_CONTRACT_ADDRESS!,
  usdtAddress: process.env.REACT_APP_USDT_ADDRESS!,

  chainId: Number.parseInt(process.env.REACT_APP_CHAIN_ID!),
  chainName: process.env.REACT_APP_CHAIN_NAME!,
  rpcUrl: process.env.REACT_APP_RPC_URL!,
  blockExplorer: process.env.REACT_APP_BLOCK_EXPLORER!,

  walletConnectProjectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID!,

  isTestnet() {
    return this.chainId === 97;
  },

  getExplorerUrl(txHash: string) {
    return `${this.blockExplorer}/tx/${txHash}`;
  },
  getAddressUrl(address: string) {
    return `${this.blockExplorer}/address/${address}`;
  },
};

// convenience exports
export const {
  contractAddress,
  oldContractAddress,
  usdtAddress,
  chainId,
  chainName,
  rpcUrl,
  blockExplorer,
  walletConnectProjectId,
} = config;

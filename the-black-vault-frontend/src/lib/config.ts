// src/lib/config.ts

export const config = {
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
  usdtAddress:    process.env.NEXT_PUBLIC_USDT_ADDRESS!,

  chainId:        Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!, 10),
  chainName:      process.env.NEXT_PUBLIC_CHAIN_NAME!,
  rpcUrl:         process.env.NEXT_PUBLIC_RPC_URL!,
  blockExplorer:  process.env.NEXT_PUBLIC_BLOCK_EXPLORER!,

  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,

  isTestnet(): boolean {
    return this.chainId === 97;
  },
  getExplorerUrl(txHash: string) {
    return `${this.blockExplorer}/tx/${txHash}`;
  },
  getAddressUrl(address: string) {
    return `${this.blockExplorer}/address/${address}`;
  },
};

export const {
  contractAddress,
  usdtAddress,
  chainId,
  chainName,
  rpcUrl,
  blockExplorer,
  walletConnectProjectId,
} = config;

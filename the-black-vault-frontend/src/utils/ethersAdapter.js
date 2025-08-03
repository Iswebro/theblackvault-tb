// Utility to convert Wagmi walletClient to ethers signer
import { BrowserProvider } from 'ethers'

export async function walletClientToSigner(walletClient) {
  if (!walletClient) return null;
  
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  
  const provider = new BrowserProvider(transport, network);
  const signer = await provider.getSigner(account.address);
  return signer;
}

export function publicClientToProvider(publicClient) {
  if (!publicClient) return null;
  
  const { chain, transport } = publicClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  
  return new BrowserProvider(transport, network);
}

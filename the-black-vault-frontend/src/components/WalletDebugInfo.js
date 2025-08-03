import React from 'react';
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';

export function WalletDebugInfo() {
  const { address, isConnected, isConnecting, isDisconnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    chainId: bsc.id,
  });
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <div style={{ 
        padding: '16px', 
        margin: '16px', 
        border: '1px solid #333', 
        borderRadius: '8px',
        background: 'rgba(0,0,0,0.3)',
        color: 'white'
      }}>
        <h3>Wallet Status: Disconnected</h3>
        <p>Please connect your wallet to see debug information.</p>
        <p>Connecting: {isConnecting ? 'Yes' : 'No'}</p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '16px', 
      margin: '16px', 
      border: '1px solid #FF6B35', 
      borderRadius: '8px',
      background: 'rgba(255, 107, 53, 0.1)',
      color: 'white'
    }}>
      <h3>🔗 RainbowKit Debug Info</h3>
      <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
        <p><strong>Status:</strong> Connected ✅</p>
        <p><strong>Address:</strong> {address}</p>
        <p><strong>Chain ID:</strong> {chainId}</p>
        <p><strong>Chain Name:</strong> {
          chainId === bsc.id ? 'BSC Mainnet' : 
          chainId === bscTestnet.id ? 'BSC Testnet' : 
          `Unknown (${chainId})`
        }</p>
        <p><strong>Balance:</strong> {
          balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : 'Loading...'
        }</p>
        
        {chainId !== bsc.id && (
          <button 
            onClick={() => switchChain({ chainId: bsc.id })}
            style={{
              background: '#FFB800',
              color: 'black',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            Switch to BSC Mainnet
          </button>
        )}
      </div>
    </div>
  );
}

export default WalletDebugInfo;

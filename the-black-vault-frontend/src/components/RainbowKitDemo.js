import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance } from 'wagmi';
import { WalletButton } from './WalletButton';

export function RainbowKitDemo() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });

  return (
    <div style={{ 
      position: 'fixed', 
      top: '20px', 
      right: '20px', 
      padding: '20px', 
      background: 'white', 
      border: '2px solid #FF6B35', 
      borderRadius: '12px', 
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      zIndex: 9999,
      maxWidth: '350px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#FF6B35' }}>🚀 New RainbowKit Integration</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Standard RainbowKit Button:</h4>
        <ConnectButton />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Custom Styled Button:</h4>
        <WalletButton />
      </div>

      {isConnected && (
        <div style={{ 
          padding: '10px', 
          background: '#f5f5f5', 
          borderRadius: '8px',
          fontSize: '12px'
        }}>
          <div><strong>Address:</strong> {address?.slice(0, 6)}...{address?.slice(-4)}</div>
          {balance && (
            <div><strong>Balance:</strong> {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}</div>
          )}
        </div>
      )}

      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        background: '#e8f5e8', 
        borderRadius: '8px',
        fontSize: '11px'
      }}>
        <strong>✅ Benefits:</strong>
        <ul style={{ margin: '5px 0 0 0', paddingLeft: '15px' }}>
          <li>Multi-wallet support (MetaMask, Trust, Coinbase, WalletConnect)</li>
          <li>Automatic network switching</li>
          <li>Better mobile experience</li>
          <li>Professional UI/UX</li>
          <li>Built-in error handling</li>
        </ul>
      </div>

      <button 
        onClick={() => document.querySelector('.rainbowkit-demo').style.display = 'none'}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'none',
          border: 'none',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        ×
      </button>
    </div>
  );
}

export default RainbowKitDemo;

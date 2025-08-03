// src/components/TrustWalletHelper.js
import { useState, useEffect } from 'react';

const TrustWalletHelper = ({ isConnected, onRetryConnection }) => {
  const [isTrustWallet, setIsTrustWallet] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showHelper, setShowHelper] = useState(false);

  useEffect(() => {
    const trustWallet = window.ethereum && window.ethereum.isTrust;
    const androidDevice = /Android/i.test(navigator.userAgent);
    
    setIsTrustWallet(trustWallet);
    setIsAndroid(androidDevice);
    
    // Show helper if Trust Wallet on Android and not connected
    setShowHelper(trustWallet && androidDevice && !isConnected);
  }, [isConnected]);

  if (!showHelper) return null;

  return (
    <div className="trust-wallet-helper" style={{
      background: 'linear-gradient(135deg, #3375bb 0%, #1e3a8a 100%)',
      border: '1px solid #2563eb',
      borderRadius: '12px',
      padding: '16px',
      margin: '16px 0',
      color: 'white'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          background: '#3b82f6',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '12px',
          fontSize: '18px'
        }}>
          📱
        </div>
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Trust Wallet on Android - Connection Tips
        </h4>
      </div>
      
      <div style={{ fontSize: '14px', lineHeight: '1.5', marginBottom: '16px' }}>
        <p style={{ margin: '0 0 8px 0' }}>
          <strong>If connection fails or disconnects immediately:</strong>
        </p>
        <ul style={{ margin: '0 0 0 20px', padding: 0 }}>
          <li>Ensure you're on <strong>BSC Mainnet</strong> in Trust Wallet</li>
          <li>Close and reopen Trust Wallet app completely</li>
          <li>Clear Trust Wallet browser cache (Settings → Browser → Clear Cache)</li>
          <li>Try connecting again after waiting 5-10 seconds</li>
          <li>Keep Trust Wallet open while using the DApp</li>
        </ul>
      </div>
      
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={onRetryConnection}
          style={{
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          🔄 Retry Connection
        </button>
        
        <button
          onClick={() => setShowHelper(false)}
          style={{
            background: 'transparent',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Dismiss
        </button>
      </div>
      
      <div style={{
        marginTop: '12px',
        padding: '8px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        💡 <strong>Pro tip:</strong> For the best experience, add this site to your Trust Wallet favorites 
        and always access it through the Trust Wallet browser.
      </div>
    </div>
  );
};

export default TrustWalletHelper;

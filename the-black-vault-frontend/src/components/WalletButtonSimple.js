import { ConnectButton } from '@rainbow-me/rainbowkit';

export function WalletButton() {
  return (
    <div className="wallet-button-container">
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          authenticationStatus,
          mounted,
        }) => {
          const ready = mounted && authenticationStatus !== 'loading';
          const connected =
            ready &&
            account &&
            chain &&
            (!authenticationStatus ||
              authenticationStatus === 'authenticated');

          return (
            <div
              {...(!ready && {
                'aria-hidden': true,
                'style': {
                  opacity: 0,
                  pointerEvents: 'none',
                  userSelect: 'none',
                },
              })}
            >
              {(() => {
                if (!connected) {
                  return (
                    <button 
                      onClick={openConnectModal} 
                      type="button" 
                      className="connect-wallet-btn"
                      style={{
                        background: 'linear-gradient(135deg, #c0c0c0 0%, #d4d4d4 100%)',
                        border: '2px solid rgba(255, 107, 53, 0.3)',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        fontWeight: '600',
                        fontSize: '16px',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 12px rgba(255, 107, 53, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 8px 20px rgba(255, 107, 53, 0.35), 0 4px 8px rgba(0, 0, 0, 0.2)';
                        e.target.style.borderColor = 'rgba(255, 107, 53, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)';
                        e.target.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                      }}
                    >
                      🔗 Connect Wallet
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button 
                      onClick={openChainModal} 
                      type="button"
                      style={{
                        background: '#FF4444',
                        border: '2px solid rgba(255, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '8px 16px',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        fontWeight: '500',
                        fontSize: '14px',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#FFB800',
                        boxShadow: '0 0 8px rgba(255, 184, 0, 0.5)'
                      }}></div>
                      Wrong network
                    </button>
                  );
                }

                return (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button
                      onClick={openChainModal}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        background: 'rgba(255, 107, 53, 0.1)',
                        border: '2px solid rgba(255, 107, 53, 0.3)',
                        borderRadius: '12px',
                        padding: '8px 16px',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        fontWeight: '500',
                        fontSize: '14px',
                        color: '#FF6B35',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        backdropFilter: 'blur(10px)',
                        gap: '8px'
                      }}
                      type="button"
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(255, 107, 53, 0.15)';
                        e.target.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255, 107, 53, 0.1)';
                        e.target.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#00FF88',
                        boxShadow: '0 0 8px rgba(0, 255, 136, 0.5)'
                      }}></div>
                      {chain.hasIcon && (
                        <div
                          style={{
                            background: chain.iconBackground,
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            overflow: 'hidden',
                            marginRight: 4,
                          }}
                        >
                          {chain.iconUrl && (
                            <img
                              alt={chain.name ?? 'Chain icon'}
                              src={chain.iconUrl}
                              style={{ width: 16, height: 16 }}
                            />
                          )}
                        </div>
                      )}
                      {chain.name}
                    </button>

                    <button 
                      onClick={openAccountModal} 
                      type="button"
                      style={{
                        background: 'rgba(255, 107, 53, 0.1)',
                        border: '2px solid rgba(255, 107, 53, 0.3)',
                        borderRadius: '12px',
                        padding: '8px 16px',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        fontWeight: '500',
                        fontSize: '14px',
                        color: '#FF6B35',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(255, 107, 53, 0.15)';
                        e.target.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255, 107, 53, 0.1)';
                        e.target.style.transform = 'translateY(0)';
                      }}
                    >
                      👤 {account.displayName}
                      {account.displayBalance && (
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: '8px',
                          padding: '4px 12px',
                          marginLeft: '8px',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: 'rgba(255, 255, 255, 0.8)'
                        }}>
                          {account.displayBalance}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}

export default WalletButton;

import { ConnectButton } from '@rainbow-me/rainbowkit';
import styled from 'styled-components';

const StyledWalletButton = styled.div`
  .custom-connect-button {
    background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);
    border: 2px solid rgba(255, 107, 53, 0.3);
    border-radius: 12px;
    padding: 12px 24px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: 600;
    font-size: 16px;
    color: white;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 
      0 4px 12px rgba(255, 107, 53, 0.25),
      0 2px 4px rgba(0, 0, 0, 0.1);
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s;
    }
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 
        0 8px 20px rgba(255, 107, 53, 0.35),
        0 4px 8px rgba(0, 0, 0, 0.2);
      border-color: rgba(255, 107, 53, 0.5);
      
      &::before {
        left: 100%;
      }
    }
    
    &:active {
      transform: translateY(-1px);
    }
    
    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }
  }

  .connected-button {
    background: rgba(255, 107, 53, 0.1);
    border: 2px solid rgba(255, 107, 53, 0.3);
    border-radius: 12px;
    padding: 8px 16px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: 500;
    font-size: 14px;
    color: #FF6B35;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
    
    &:hover {
      background: rgba(255, 107, 53, 0.15);
      transform: translateY(-1px);
    }
  }

  .balance-display {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 4px 12px;
    margin-left: 8px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }

  .chain-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #00FF88;
    margin-right: 8px;
    box-shadow: 0 0 8px rgba(0, 255, 136, 0.5);
  }

  .wrong-network {
    background: #FF4444 !important;
    color: white !important;
    
    .chain-indicator {
      background: #FFB800;
      box-shadow: 0 0 8px rgba(255, 184, 0, 0.5);
    }
  }
`;

export function WalletButton() {
  return (
    <StyledWalletButton>
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
                      className="custom-connect-button"
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
                      className="connected-button wrong-network"
                    >
                      <div className="chain-indicator"></div>
                      Wrong network
                    </button>
                  );
                }

                return (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button
                      onClick={openChainModal}
                      style={{ display: 'flex', alignItems: 'center' }}
                      type="button"
                      className="connected-button"
                    >
                      <div className="chain-indicator"></div>
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
                      className="connected-button"
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      👤 {account.displayName}
                      {account.displayBalance && (
                        <div className="balance-display">
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
    </StyledWalletButton>
  );
}

export default WalletButton;

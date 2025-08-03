import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain, useChainId } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { useEffect } from 'react';

export function useWallet() {
  try {
    const { address, isConnected, isConnecting, isDisconnected } = useAccount();
    const { connect, connectors, error: connectError, isLoading: isConnectLoading } = useConnect();
    const { disconnect } = useDisconnect();
    const { switchChain } = useSwitchChain();
    const chainId = useChainId();
    
    // Get BNB balance
    const { data: balance } = useBalance({
      address: address,
      chainId: bsc.id,
    });

    // Auto-switch to BSC if connected to wrong network
    useEffect(() => {
      if (isConnected && chainId && chainId !== bsc.id) {
        switchChain({ chainId: bsc.id });
      }
    }, [isConnected, chainId, switchChain]);

    const connectWallet = async (connectorType = 'injected') => {
      try {
        let targetConnector;
        
        if (connectorType === 'injected') {
          // Get the first available injected connector (MetaMask, Trust Wallet, etc.)
          targetConnector = connectors.find(connector => 
            connector.type === 'injected' || connector.name.includes('MetaMask')
          );
        } else {
          // Find specific connector by name or type
          targetConnector = connectors.find(connector => 
            connector.id === connectorType || connector.type === connectorType
          );
        }
        
        if (targetConnector) {
          await connect({ connector: targetConnector });
        } else {
          // Fallback to first available connector
          await connect({ connector: connectors[0] });
        }
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    };

    const disconnectWallet = () => {
      disconnect();
    };

    const switchToBSC = async () => {
      try {
        await switchChain({ chainId: bsc.id });
      } catch (error) {
        console.error('Failed to switch to BSC:', error);
      }
    };

    return {
      // Wallet state
      address,
      isConnected,
      isConnecting: isConnecting || isConnectLoading,
      isDisconnected,
      chainId,
      
      // Balance info
      balance: balance?.formatted || '0',
      balanceSymbol: balance?.symbol || 'BNB',
      
      // Wallet actions
      connectWallet,
      disconnectWallet,
      switchToBSC,
      
      // Available connectors
      connectors,
      
      // Error handling
      error: connectError,
      
      // Helper functions
      isOnBSC: chainId === bsc.id,
      shortAddress: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
      
      // Legacy compatibility
      connect: connectWallet,
      disconnect: disconnectWallet,
    };
  } catch (error) {
    console.error('useWallet error - likely not wrapped in WagmiProvider:', error);
    
    // Return safe defaults when not in WagmiProvider context
    return {
      address: null,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      chainId: null,
      balance: '0',
      balanceSymbol: 'BNB',
      connectWallet: () => console.warn('WagmiProvider not found'),
      disconnectWallet: () => console.warn('WagmiProvider not found'),
      switchToBSC: () => console.warn('WagmiProvider not found'),
      connectors: [],
      error: null,
      isOnBSC: false,
      shortAddress: null,
      connect: () => console.warn('WagmiProvider not found'),
      disconnect: () => console.warn('WagmiProvider not found'),
    };
  }
}

export default useWallet;

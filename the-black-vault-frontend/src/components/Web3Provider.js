'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

// Black Vault WalletConnect Project ID
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'ec1a030594f38292648794d4587912f4';

const config = getDefaultConfig({
  appName: 'Black Vault',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [bsc, bscTestnet],
  ssr: true,
});

const queryClient = new QueryClient();

// Black Vault custom theme - sleek and professional
const blackVaultTheme = {
  ...darkTheme({
    accentColor: '#FF6B35',
    accentColorForeground: 'white',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small',
  }),
  colors: {
    ...darkTheme().colors,
    accentColor: '#FF6B35',
    accentColorForeground: 'white',
    actionButtonBorder: 'rgba(255, 107, 53, 0.2)',
    actionButtonBorderMobile: 'rgba(64, 64, 64, 0.3)',
    actionButtonSecondaryBackground: 'rgba(26, 26, 26, 0.8)',
    closeButton: 'rgba(255, 255, 255, 0.7)',
    closeButtonBackground: 'rgba(0, 0, 0, 0.2)',
    connectButtonBackground: '#1a1a1a',
    connectButtonBackgroundError: '#FF4444',
    connectButtonInnerBackground: '#1a1a1a',
    connectButtonText: '#e0e0e0',
    connectButtonTextError: 'white',
    connectionIndicator: '#00FF88',
    downloadBottomCardBackground: 'linear-gradient(126deg, rgba(26, 26, 26, 0.9) 9.49%, rgba(0, 0, 0, 0.3) 71.04%), #1A1B1F',
    downloadTopCardBackground: 'linear-gradient(126deg, rgba(26, 26, 26, 0.95) 9.49%, rgba(0, 0, 0, 0.4) 71.04%), #1A1B1F',
    error: '#FF4444',
    generalBorder: 'rgba(64, 64, 64, 0.3)',
    generalBorderDim: 'rgba(64, 64, 64, 0.2)',
    menuItemBackground: 'rgba(26, 26, 26, 0.5)',
    modalBackdrop: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#1A1B1F',
    modalBorder: 'rgba(255, 107, 53, 0.2)',
    modalText: '#FFF',
    modalTextDim: 'rgba(255, 255, 255, 0.7)',
    modalTextSecondary: 'rgba(255, 255, 255, 0.6)',
    profileAction: 'rgba(255, 107, 53, 0.1)',
    profileActionHover: 'rgba(255, 107, 53, 0.15)',
    profileForeground: '#1A1B1F',
    selectedOptionBorder: '#FF6B35',
    standby: '#FFB800',
  },
};

export function Web3Provider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={blackVaultTheme}
          modalSize="compact"
          showRecentTransactions={true}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default Web3Provider;

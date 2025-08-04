'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { 
  getDefaultConfig, 
  RainbowKitProvider, 
  darkTheme, 
  connectorsForWallets 
} from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  walletConnectWallet,
  trustWallet,
  coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

// Black Vault WalletConnect Project ID
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'ec1a030594f38292648794d4587912f4';

// Custom connector configuration to prevent double connections and ensure BSC-first
const connectors = connectorsForWallets(
  [
    {
      groupName: 'BSC Wallets',
      wallets: [
        metaMaskWallet,
        trustWallet,
        walletConnectWallet,
        coinbaseWallet,
      ],
    },
  ],
  {
    appName: 'Black Vault',
    projectId: WALLETCONNECT_PROJECT_ID,
    // Force all wallets to connect to BSC only
    chains: [bsc],
  }
);

const config = getDefaultConfig({
  appName: 'Black Vault',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [bsc], // ONLY BSC mainnet - no other networks
  initialChain: bsc, // Force BSC as default and only chain
  ssr: true,
  connectors,
});

const queryClient = new QueryClient();

// Black Vault custom theme - sleek and professional
const blackVaultTheme = {
  ...darkTheme({
    accentColor: '#c0c0c0',
    accentColorForeground: '#1a1a1a',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small',
  }),
  colors: {
    ...darkTheme().colors,
    accentColor: '#c0c0c0',
    accentColorForeground: '#1a1a1a',
    actionButtonBorder: 'rgba(192, 192, 192, 0.2)',
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
    modalBorder: 'rgba(192, 192, 192, 0.2)',
    modalText: '#FFF',
    modalTextDim: 'rgba(255, 255, 255, 0.7)',
    modalTextSecondary: 'rgba(255, 255, 255, 0.6)',
    profileAction: 'rgba(192, 192, 192, 0.1)',
    profileActionHover: 'rgba(192, 192, 192, 0.15)',
    profileForeground: '#1A1B1F',
    selectedOptionBorder: '#c0c0c0',
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
          chains={[bsc]} // Explicitly restrict to BSC only
          initialChain={bsc} // Force BSC as initial chain
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default Web3Provider;

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

// Custom BSC configuration to ensure proper network detection
const customBSC = {
  ...bsc,
  name: 'Binance Smart Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: {
    default: { 
      http: ['https://rpc.ankr.com/bsc'] 
    },
    public: { 
      http: ['https://bsc-dataseed.binance.org/'] 
    },
  },
  blockExplorers: {
    default: {
      name: 'BSCScan',
      url: 'https://bscscan.com',
    },
  },
};

// Custom connector configuration to prevent double connections
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
    chains: [customBSC],
  }
);

const config = getDefaultConfig({
  appName: 'Black Vault',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [customBSC], // ONLY BSC mainnet - no other networks
  initialChain: customBSC, // Force BSC as default and only chain
  ssr: true,
  connectors,
  // Force BSC for all wallets including Trust Wallet
  multiInjectedProviderDiscovery: false,
  // Enable auto-switching to BSC
  autoConnect: true,
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
          chains={[customBSC]} // Explicitly restrict to BSC only
          initialChain={customBSC} // Force BSC as initial chain
          appInfo={{
            appName: 'Black Vault',
            disclaimer: 'Connect to BSC (Binance Smart Chain) network only.',
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default Web3Provider;

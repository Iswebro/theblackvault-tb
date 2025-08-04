import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#1a1a1a" />
        <meta name="description" content="THE BLACK VAULT - Premium USDT Staking Platform on Binance Smart Chain" />
        
        {/* iOS and PWA Icons */}
        <link rel="apple-touch-icon" href="/faviconborder.PNG" />
        <link rel="apple-touch-icon" sizes="180x180" href="/faviconborder.PNG" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* Additional iOS meta tags for better app experience */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Black Vault" />
        
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.theblackvault.xyz/" />
        <meta property="og:title" content="BLACK VAULT - Premium USDT Staking Platform on Binance Smart Chain" />
        <meta property="og:description" content="Premium USDT Staking Platform on Binance Smart Chain. Stake USDT (BEP-20) and earn daily rewards in a secure, community-driven vault." />
        <meta property="og:image" content="/faviconborder.PNG" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://www.theblackvault.xyz/" />
        <meta property="twitter:title" content="BLACK VAULT - Premium USDT Staking Platform on Binance Smart Chain" />
        <meta property="twitter:description" content="Premium USDT Staking Platform on Binance Smart Chain. Stake USDT (BEP-20) and earn daily rewards in a secure, community-driven vault." />
        <meta property="twitter:image" content="/faviconborder.PNG" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

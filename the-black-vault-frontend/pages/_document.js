import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#000000" />
        <meta name="description" content="The Black Vault - A secure, community-driven crypto vault experience. Deposit BNB and earn rewards" />
        <link rel="apple-touch-icon" href="/logo2.svg" />
        <link rel="manifest" href="/manifest.json" />
        
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.theblackvault.xyz/" />
        <meta property="og:title" content="The Black Vault - Premium BNB Staking" />
        <meta property="og:description" content="Welcome to The Black Vault. A secure, community-driven crypto vault experience. Deposit BNB and earn rewards" />
        <meta property="og:image" content="/favicon.ico" />
        
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://www.theblackvault.xyz/" />
        <meta property="twitter:title" content="The Black Vault - Premium BNB Staking" />
        <meta property="twitter:description" content="Welcome to The Black Vault. A secure, community-driven crypto vault experience. Deposit BNB and earn rewards" />
        <meta property="twitter:image" content="/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

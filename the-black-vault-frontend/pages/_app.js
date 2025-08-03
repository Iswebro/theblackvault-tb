import '../src/index.css'
import '../src/App.css'
import { Web3Provider } from '../src/components/Web3Provider'

export default function App({ Component, pageProps }) {
  return (
    <Web3Provider>
      <Component {...pageProps} />
    </Web3Provider>
  )
}

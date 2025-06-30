# The Black Vault - Frontend

A secure, community-driven crypto vault built on Binance Smart Chain.

## Features

- 🔐 Secure wallet connection (MetaMask, Trust Wallet)
- 💰 Deposit BNB to earn rewards
- 🎁 Withdraw vault rewards
- 👥 Referral system with rewards
- 📊 Real-time transaction history
- 📱 Mobile-first responsive design
- 🌙 Dark theme optimized for crypto users

## Tech Stack

- **Frontend**: React 19, Tailwind CSS
- **Blockchain**: Ethers.js v6
- **Network**: Binance Smart Chain (BSC)
- **Build**: Create React App with react-app-rewired

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- MetaMask or Trust Wallet browser

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd the-black-vault-frontend
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Copy environment variables:
\`\`\`bash
cp .env.example .env
\`\`\`

4. Update `.env` with your contract address and RPC URL:
\`\`\`env
REACT_APP_CONTRACT_ADDRESS=0xYourContractAddress
REACT_APP_RPC_URL=https://bsc-dataseed.binance.org/
\`\`\`

5. Start development server:
\`\`\`bash
npm start
\`\`\`

The app will open at `http://localhost:3000`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_CONTRACT_ADDRESS` | BlackVault contract address | Required |
| `REACT_APP_RPC_URL` | BSC RPC endpoint | `https://bsc-dataseed.binance.org/` |
| `REACT_APP_CHAIN_ID` | Chain ID for BSC | `56` |
| `REACT_APP_CHAIN_NAME` | Network name | `Binance Smart Chain` |
| `REACT_APP_BLOCK_EXPLORER` | Block explorer URL | `https://bscscan.com/` |

## Usage

### For Users

1. **Connect Wallet**: Click "Connect Wallet" and approve in MetaMask/Trust Wallet
2. **Deposit**: Enter BNB amount and click "Deposit BNB"
3. **Earn Rewards**: Rewards accrue automatically based on vault performance
4. **Withdraw**: Withdraw vault rewards or referral earnings anytime
5. **Referrals**: Share your link with `?ref=0xYourAddress` to earn referral rewards

### For Developers

#### Project Structure
\`\`\`
src/
├── components/
│   └── Toast.js          # Toast notification system
├── contract/
│   └── BlackVaultABI.json # Smart contract ABI
├── App.js                # Main application component
├── connectWallet.js      # Wallet connection utilities
├── index.js             # React entry point
└── App.css              # Tailwind CSS + custom styles
\`\`\`

#### Key Functions

- `connectInjected()`: Connects to injected wallet (MetaMask/Trust)
- `getReferralFromURL()`: Extracts referral address from URL params
- `loadContractData()`: Fetches user balance, rewards, and history
- `deposit()`: Deposits BNB to vault with referral
- `withdraw()`: Withdraws vault rewards
- `withdrawReferral()`: Withdraws referral earnings

## Leaderboard System

### Weekly & Lifetime Referral Leaderboards

The Black Vault features both weekly and lifetime referral leaderboards to track top performers.

#### Weekly Leaderboard

- **Reset Schedule**: Every Monday at 7:00 AM AEST (Brisbane Time)
- **Tracking Period**: 7-day rolling windows from launch
- **Data Source**: On-chain `Deposited` events with referral rewards calculation
- **Display**: Top 10 referrers by weekly referral rewards earned

#### Lifetime Leaderboard

- **Tracking Period**: All-time since contract launch
- **Data Source**: All historical `Deposited` events
- **Display**: Top 10 referrers by total referral rewards earned

### Off-chain Aggregation

#### Weekly Leaderboard Script

\`\`\`bash
# Run weekly leaderboard aggregation
npm run leaderboard:weekly
\`\`\`

The script (`scripts/weeklyLeaderboard.js`) should be scheduled to run via cron:

\`\`\`bash
# Crontab entry for Monday 7 AM AEST (UTC+10)
# Note: Adjust for daylight saving time if needed
0 21 * * 0 cd /path/to/project && npm run leaderboard:weekly
\`\`\`

**Brisbane Time Cron Schedule:**
- **Standard Time (AEST)**: `0 21 * * 0` (Sunday 9 PM UTC = Monday 7 AM AEST)
- **Daylight Time (AEDT)**: `0 20 * * 0` (Sunday 8 PM UTC = Monday 7 AM AEDT)

#### Data Storage

Leaderboard data is stored in JSON files:
- `leaderboard-data/week-{index}.json` - Weekly leaderboard data
- `leaderboard-data/lifetime.json` - Lifetime leaderboard data

### API Endpoints

#### GET /api/leaderboard/weekly

Returns the current week's referral leaderboard.

**Response:**
\`\`\`json
{
  "weekIndex": 5,
  "weekStart": 1719273600,
  "weekEnd": 1719878400,
  "generatedAt": 1719850000,
  "leaderboard": [
    {
      "rank": 1,
      "address": "0xabc...1234",
      "totalRewards": "1250000000000000000000"
    }
  ]
}
\`\`\`

#### GET /api/leaderboard/lifetime

Returns the all-time referral leaderboard.

**Response:**
\`\`\`json
{
  "generatedAt": 1719850000,
  "leaderboard": [
    {
      "rank": 1,
      "address": "0xabc...1234", 
      "totalRewards": "5750000000000000000000"
    }
  ]
}
\`\`\`

### Frontend Components

#### Weekly Leaderboard (Default View)

- Displays current week's top 10 referrers
- Shows week number and reset schedule
- Updates automatically when new data is available

#### Lifetime Leaderboard (Modal)

- Accessible via "See Lifetime Leaderboard" button
- Shows all-time top 10 referrers
- Modal overlay with responsive design

### Technical Details

#### Week Calculation

\`\`\`javascript
const LAUNCH_TIMESTAMP = 1718668800 // 7am Brisbane time 17 June 2024
const WEEK_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds
const currentWeekIndex = Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION)
\`\`\`

#### Referral Reward Calculation

- **Bonus Rate**: 10% of deposit amount
- **Eligibility**: First 3 deposits per referrer-referee pair
- **Verification**: Uses `getReferralBonusInfo()` contract function

#### Block Time Estimation

The script estimates block numbers from timestamps using BSC's ~3 second average block time for efficient event querying.

### Deployment Notes

1. **Environment Variables**: Ensure `REACT_APP_CONTRACT_ADDRESS` and `REACT_APP_RPC_URL` are set
2. **Data Directory**: Create `leaderboard-data/` directory with write permissions
3. **Cron Setup**: Configure cron job for weekly aggregation
4. **API Routes**: Deploy API endpoints to your hosting platform
5. **Time Zone**: Verify cron runs in correct timezone (Brisbane/AEST)

## Building for Production

\`\`\`bash
npm run build
\`\`\`

This creates an optimized build in the `build/` directory.

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

1. Build the project: `npm run build`
2. Upload `build/` directory to your hosting provider
3. Configure environment variables on your hosting platform

## Testing

### Local Testing

1. Start local development server: `npm start`
2. Connect with MetaMask on BSC Testnet
3. Test deposit/withdraw flows with test BNB

### Testnet Testing

1. Switch to BSC Testnet in MetaMask
2. Get test BNB from BSC Testnet faucet
3. Update `.env` with testnet contract address
4. Test all functionality end-to-end

## Troubleshooting

### Common Issues

**Wallet won't connect**
- Ensure you're using MetaMask or Trust Wallet in-app browser
- Check that BSC network is added to your wallet

**Transaction fails**
- Ensure sufficient BNB balance for gas fees
- Check contract address is correct
- Verify you're on BSC Mainnet (Chain ID: 56)

**App won't load**
- Clear browser cache and reload
- Check browser console for errors
- Ensure all environment variables are set

### Support

For technical issues, check the browser console for error messages and ensure:
- Wallet is connected to BSC network
- Contract address is correct
- Sufficient BNB for gas fees

## License

MIT License - see LICENSE file for details
\`\`\`

## H. Vercel Configuration

export default function HowItWorks() {
  const features = [
    {
      icon: "🔒",
      title: "Permanent Deposits",
      description:
        "Your principal USDT deposit is permanently locked in the vault. Only the rewards generated can be withdrawn.",
    },
    {
      icon: "💸",
      title: "Daily Rewards",
      description: "Earn a fixed daily reward rate of 2.5% on your active USDT amount. Rewards accrue every 24 hours.",
    },
    {
      icon: "🔗",
      title: "Referral System",
      description:
        "Invite new users and earn a 10% referral bonus on their first 3 deposits only.",
    },
    {
      icon: "💰",
      title: "USDT (BEP-20)",
      description:
        "The platform exclusively uses USDT (BEP-20) on the Binance Smart Chain (BSC). Ensure you deposit the correct token on the right network.",
    },
    {
      icon: "📈",
      title: "Minimum Deposit",
      description: "A minimum deposit of 50 USDT is required to activate your vault and start earning rewards.",
    },
    {
      icon: "🛡️",
      title: "Fair Play & Security",
      description:
        "We actively monitor user activity to ensure fair play. Any abuse or exploitation detected will not be tolerated, maintaining a secure environment for all.",
    },
  ]

  return (
    <div className="vault-card premium-card">
      <h3 className="card-title">
        <span className="card-icon">💡</span>
        How It Works
      </h3>
      <div className="how-it-works-grid">
        {features.map((feature, index) => (
          <div key={index} className="how-it-works-item">
            <div className="how-it-works-icon">{feature.icon}</div>
            <h4 className="how-it-works-title">{feature.title}</h4>
            <p className="how-it-works-description">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

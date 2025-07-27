export default function Footer() {
  return (
    <footer className="vault-footer">
      <div className="footer-content">
        <div className="footer-branding">
          <div className="footer-logo">
            <img 
              src="/logo2.svg" 
              alt="Black Vault Logo" 
              className="footer-logo-img"
            />
            <span className="footer-title">Black Vault</span>
          </div>
          <p className="footer-tagline">
            Secure rewards, advanced protocol, thriving community
          </p>
          <p className="footer-subtitle">
            Built with 🖤 for the DeFi community
          </p>
        </div>
      </div>
    </footer>
  );
}

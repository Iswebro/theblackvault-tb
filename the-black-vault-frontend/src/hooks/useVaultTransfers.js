// src/hooks/useVaultTransfers.js
// React hook to fetch BEP-20 token transfers involving the Vault contract for the connected wallet
import { useEffect, useState } from 'react';

export default function useVaultTransfers(wallet, vault) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wallet || !vault) {
      setTransfers([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/bscscan?wallet=${wallet}&vault=${vault}`)
      .then(res => res.json())
      .then(data => {
        setTransfers(data.result || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch transfers');
        setLoading(false);
      });
  }, [wallet, vault]);

  return { transfers, loading, error };
}

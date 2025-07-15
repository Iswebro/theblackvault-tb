// pages/api/bscscan.js
// Next.js API route to proxy BscScan API requests and hide your API key
// Usage: /api/bscscan?wallet=0x...&vault=0x...

import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { wallet, vault } = req.query;
  const apiKey = process.env.BSCSCAN_API_KEY;

  if (!wallet || !vault) {
    return res.status(400).json({ error: 'Missing wallet or vault address' });
  }
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not set on server' });
  }

  // BscScan API endpoint for BEP-20 token transfers involving the wallet
  const url = `https://api.bscscan.com/api?module=account&action=tokentx&address=${wallet}&sort=desc&apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== '1' || !data.result) {
      return res.status(200).json({ result: [] });
    }
    // Filter for only transfers involving the Vault contract
    const filtered = data.result.filter(
      tx => tx.contractAddress.toLowerCase() === vault.toLowerCase()
    );
    return res.status(200).json({ result: filtered });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch from BscScan', details: err.message });
  }
}

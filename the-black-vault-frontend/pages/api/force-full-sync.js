// Temporary endpoint to force a full historical sync
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Clear the last processed block to force full sync
    await redis.del('referral-stats:last-processed-block');
    console.log("🔧 Cleared last processed block - next cron run will do full sync");
    
    res.status(200).json({ 
      success: true, 
      message: "Cleared last processed block - next cron run will do full historical sync" 
    });
  } catch (error) {
    console.error("❌ Error forcing full sync:", error);
    res.status(500).json({ error: error.message });
  }
}

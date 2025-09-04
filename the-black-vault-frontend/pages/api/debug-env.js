// Debug environment variables
export default async function handler(req, res) {
  const envVars = {
    KV_REST_API_URL: process.env.KV_REST_API_URL ? 'SET' : 'NOT SET',
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? 'SET' : 'NOT SET',
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET', 
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV
  };
  
  res.status(200).json({
    success: true,
    environment: envVars,
    recommendation: envVars.KV_REST_API_URL === 'SET' ? 'Use KV_REST_API_* variables' : 'Use UPSTASH_REDIS_REST_* variables'
  });
}

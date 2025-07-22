// Optional optimization for very large leaderboards
// This would only be needed if you have 50,000+ referrers

// 1. Pagination for large leaderboards
export async function getPaginatedLeaderboard(type, page = 1, limit = 50) {
  const allData = await redis.get(`leaderboard:${type}`);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  return {
    data: allData.slice(startIndex, endIndex),
    totalCount: allData.length,
    totalPages: Math.ceil(allData.length / limit),
    currentPage: page
  };
}

// 2. Compress large datasets
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export async function setCompressedLeaderboard(key, data) {
  const compressed = await gzipAsync(JSON.stringify(data));
  await redis.set(key, compressed.toString('base64'));
}

export async function getCompressedLeaderboard(key) {
  const compressed = await redis.get(key);
  if (!compressed) return null;
  
  const buffer = Buffer.from(compressed, 'base64');
  const decompressed = await gunzipAsync(buffer);
  return JSON.parse(decompressed.toString());
}

// 3. TTL-based cleanup for old weekly data
export async function cleanupOldWeeklyData() {
  const currentWeek = getCurrentWeekIndex();
  const weeksToKeep = 12; // Keep last 12 weeks
  
  for (let week = 0; week < currentWeek - weeksToKeep; week++) {
    await redis.del(`leaderboard:weekly:${week}`);
  }
}

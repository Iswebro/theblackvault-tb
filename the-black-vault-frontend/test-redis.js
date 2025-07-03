// test-redis.js
import { Redis } from '@upstash/redis'

async function main() {
  const redis = new Redis({
    url: 'https://regular-javelin-35266.upstash.io',
    token: 'AYnCAAIjcDE0MDg1ZDBhMGFiNzk0YzZmYjBjNzE0NWUzN2NlNzdkMXAxMA',
  })

  // 1) Ping
  const pong = await redis.ping()
  console.log('PING response:', pong) // should print 'PONG'

  // 2) Set + Get
  await redis.set('foo', 'bar')
  const foo = await redis.get('foo')
  console.log('GET foo:', foo)        // should print 'bar'
}

main().catch((err) => {
  console.error('Redis test failed:', err)
  process.exit(1)
})

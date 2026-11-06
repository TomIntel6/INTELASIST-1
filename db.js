import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config()

export function getDatabaseEndpoint() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    return { host: 'not-configured', port: 'unknown' }
  }

  try {
    const url = new URL(connectionString)
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      return { host: 'invalid-uri', port: 'unknown' }
    }

    return {
      host: url.hostname || 'invalid-host',
      port: url.port || '5432',
    }
  } catch {
    return { host: 'invalid-uri', port: 'unknown' }
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

pool.on('error', (error) => {
  console.error('[Database] Idle client error', {
    name: error.name,
    code: error.code,
  })
})

export default pool
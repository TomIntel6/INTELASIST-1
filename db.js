import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config()

console.log('DB URL:', process.env.DATABASE_URL)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

export default pool
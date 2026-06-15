import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config()

const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:3000'
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function pickUser() {
  const client = await pool.connect()
  try {
    const { rows } = await client.query('SELECT id, correo FROM usuarios ORDER BY nombre ASC LIMIT 1')
    if (rows.length === 0) throw new Error('No users found')
    return rows[0]
  } finally {
    client.release()
  }
}

async function showPermissions(userId) {
  const client = await pool.connect()
  try {
    const permRes = await client.query('SELECT id, modules_access, created_at, updated_at FROM user_permissions WHERE user_id = $1', [userId])
    console.log('user_permissions:', permRes.rows)
    if (permRes.rows.length > 0) {
      const pid = permRes.rows[0].id
      const details = await client.query('SELECT permission_key, granted FROM user_permission_details WHERE permission_id = $1', [pid])
      console.log('user_permission_details:', details.rows)
    }
  } finally {
    client.release()
  }
}

async function updateViaApi(userId) {
  console.log('Calling API to toggle a permission for user', userId)
  // Toggle a safe permission key that likely exists
  const payload = { permissions: { view_all_reports: true } }
  const res = await fetch(`${API_BASE}/api/users/${userId}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  console.log('API response status:', res.status)
  const text = await res.text().catch(() => '')
  try { console.log('API response json:', JSON.parse(text)) } catch(e) { console.log('API response body:', text) }
}

async function updateModulesViaApi(userId) {
  console.log('Calling API to update modules for user', userId)
  const payload = { modules: { reports: true, evidence: true, updates: true, users: false, system: false, admin: false } }
  const res = await fetch(`${API_BASE}/api/users/${userId}/modules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  console.log('Modules API status:', res.status)
  const text = await res.text().catch(() => '')
  try { console.log('Modules API json:', JSON.parse(text)) } catch(e) { console.log('Modules API body:', text) }
}

async function main() {
  try {
    const user = await pickUser()
    console.log('Selected user:', user)

    console.log('\n-- Permisos antes --')
    await showPermissions(user.id)

    await updateViaApi(user.id)

    console.log('\n-- Permisos despues --')
    await showPermissions(user.id)

    console.log('\n-- Módulos antes --')
    await showPermissions(user.id)

    await updateModulesViaApi(user.id)

    console.log('\n-- Módulos despues --')
    await showPermissions(user.id)

    process.exit(0)
  } catch (err) {
    console.error('Error in test script:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()

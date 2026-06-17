import pool from './db.js'

try {
  console.log('Testing users query...')
  
  // Test 1: Count usuarios
  const count = await pool.query('SELECT COUNT(*) as count FROM usuarios')
  console.log('Total usuarios:', count.rows[0].count)
  
  // Test 2: Get all usuarios with activity
  const result = await pool.query(`
    SELECT 
      u.id,
      u.correo as email,
      u.nombre,
      u.rol as role,
      COALESCE((
        SELECT COUNT(*)
        FROM reports r
        WHERE (r.created_by IS NOT NULL AND r.created_by::text = u.id::text)
          OR (r.created_by_email IS NOT NULL AND LOWER(TRIM(r.created_by_email)) = LOWER(TRIM(u.correo)))
      ), 0) AS "reportsCreated",
      (SELECT last_login FROM user_activity_log WHERE user_id = u.id ORDER BY last_login DESC LIMIT 1) AS "lastLogin",
      (SELECT last_activity FROM user_activity_log WHERE user_id = u.id ORDER BY last_activity DESC LIMIT 1) AS "lastActivity",
      COALESCE((SELECT is_suspended FROM user_activity_log WHERE user_id = u.id LIMIT 1), false) AS "isSuspended",
      (SELECT suspension_reason FROM user_activity_log WHERE user_id = u.id LIMIT 1) AS "suspensionReason",
      (SELECT suspended_at FROM user_activity_log WHERE user_id = u.id LIMIT 1) AS "suspendedAt",
      (SELECT suspended_by FROM user_activity_log WHERE user_id = u.id LIMIT 1) AS "suspendedBy"
    FROM usuarios u
    ORDER BY u.nombre ASC
  `)
  
  console.log(`Query returned ${result.rows.length} rows`)
  if (result.rows.length > 0) {
    console.log('First user:', JSON.stringify(result.rows[0], null, 2))
  }
  
  process.exit(0)
} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

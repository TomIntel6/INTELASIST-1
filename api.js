import { randomUUID } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import pool from './db.js'

const app = express()
// Conjunto de clientes SSE conectados
const sseClients = new Set()
const ROLE_OPTIONS = ['Agente', 'Admin', 'Support', 'Gerente']
const SALT_ROUNDS = 10
const SUPPORT_LOCKED_EMAIL = 'jrodriguez@intelasist.com'

function isSupportLockedEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase() === SUPPORT_LOCKED_EMAIL
}

function enforceLockedSupportRoles(email, roles) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (normalizedEmail !== SUPPORT_LOCKED_EMAIL) {
    return roles
  }

  const nextRoles = Array.isArray(roles) ? Array.from(new Set(roles)) : []
  if (!nextRoles.includes('Support')) {
    nextRoles.unshift('Support')
  } else {
    nextRoles.splice(nextRoles.indexOf('Support'), 1)
    nextRoles.unshift('Support')
  }

  return nextRoles
}

function loadEnvFile() {
  try {
    const envPath = resolve(process.cwd(), '.env')
    const envContent = readFileSync(envPath, 'utf8')

    for (const line of envContent.split(/\r?\n/)) {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue
      }

      const separatorIndex = trimmedLine.indexOf('=')
      if (separatorIndex === -1) {
        continue
      }

      const key = trimmedLine.slice(0, separatorIndex).trim()
      let value = trimmedLine.slice(separatorIndex + 1).trim()

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch (error) {
    console.warn('No se pudo cargar .env en el backend:', error instanceof Error ? error.message : error)
  }
}

loadEnvFile()

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SUPABASE_SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
).trim()
const SUPABASE_SERVICE_KEY_SOURCE = process.env.SUPABASE_SERVICE_KEY
  ? 'SUPABASE_SERVICE_KEY'
  : process.env.SUPABASE_SERVICE_ROLE_KEY
    ? 'SUPABASE_SERVICE_ROLE_KEY'
    : 'none'
const PLACEHOLDER_SERVICE_KEY = 'TU_SECRET_KEY'

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY && SUPABASE_SERVICE_KEY !== PLACEHOLDER_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null

if (!supabase) {
  console.warn('[Supabase] service role key no está configurada con valor válido; el backend no usará el cliente administrativo de Supabase.')
}

function getSupabaseAdminClient() {
  return supabase
}

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://intelasist-ai.vercel.app'
const SUPABASE_STORAGE_BUCKET = String(process.env.SUPABASE_STORAGE_BUCKET || 'uploads').trim()
console.log('[Supabase] ENV vars:', {
  SUPABASE_URL: SUPABASE_URL ? 'set' : 'missing',
  SUPABASE_SERVICE_KEY_SOURCE: SUPABASE_SERVICE_KEY_SOURCE,
  SUPABASE_SERVICE_KEY: SUPABASE_SERVICE_KEY ? 'set' : 'missing',
  SUPABASE_STORAGE_BUCKET: SUPABASE_STORAGE_BUCKET,
})
console.log('[Supabase] cliente administrativo inicializado:', supabase ? 'sí' : 'no')
const allowedOrigins = [
  FRONTEND_ORIGIN,
  'https://intelasist-yps2-64ysydqqy-jose-rodriguez-s-projects1.vercel.app'
]

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(cors(corsOptions))

const authRoutes = express.Router()

const uploadsDir = resolve(process.cwd(), 'uploads')
mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

const upload = multer({
  storage: multer.memoryStorage(),
})

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file

    if (!file) {
      console.error('[Supabase Storage] No se recibió archivo en la petición.')
      res.status(400).json({ error: 'No se recibió ningún archivo.' })
      return
    }

    if (!file.buffer) {
      console.error('[Supabase Storage] El archivo no contiene datos válidos.')
      res.status(400).json({ error: 'El archivo no contiene datos válidos.' })
      return
    }

    if (file.size === 0) {
      console.error('[Supabase Storage] El archivo tiene tamaño 0.')
      res.status(400).json({ error: 'El archivo tiene tamaño 0.' })
      return
    }

    const originalName = String(file.originalname || 'unknown')
    const extension = extname(originalName).toLowerCase()
    const filename = `${Date.now()}-${randomUUID()}${extension}`
    const storagePath = `reports/${filename}`

    console.log('[Supabase Storage] Preparando subida:', {
      bucket: SUPABASE_STORAGE_BUCKET,
      storagePath,
      originalName,
      size: file.size,
      mimeType: file.mimetype,
      bufferLength: file.buffer.length,
    })

    if (supabase) {
      if (typeof supabase.storage.getBucket === 'function') {
        const { data: bucketData, error: bucketError } = await supabase.storage.getBucket(SUPABASE_STORAGE_BUCKET)
        console.log('[Supabase Storage] Verificando bucket:', { bucket: SUPABASE_STORAGE_BUCKET, bucketData, bucketError })

        if (bucketError || !bucketData) {
          const bucketMessage = bucketError?.message || bucketError?.details || bucketError?.hint || `Bucket ${SUPABASE_STORAGE_BUCKET} no existe o no es accesible.`
          console.error('[Supabase Storage] Error de bucket:', bucketMessage, { bucketError, bucketData })
          res.status(500).json({ error: bucketMessage })
          return
        }
      } else {
        console.warn('[Supabase Storage] No se puede verificar bucket con esta versión del cliente. Continúa sin verificación explícita.')
      }

      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        })

      console.log('[Supabase Storage] Respuesta de upload:', { uploadData, uploadError })

      if (uploadError) {
        const uploadErrorPayload = {
          message: uploadError?.message,
          statusCode: uploadError?.statusCode ?? null,
          error: uploadError?.error ?? null,
          full: JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError)),
        }
        console.error('[Supabase Storage] Error subiendo archivo a Supabase Storage:', uploadErrorPayload)
        res.status(500).json({ error: uploadErrorPayload })
        return
      }

      const { data: publicUrlData, error: publicUrlError } = await supabase
        .storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(storagePath)

      console.log('[Supabase Storage] Respuesta getPublicUrl:', { publicUrlData, publicUrlError })

      if (publicUrlError || !publicUrlData?.publicUrl) {
        const errorMessage = publicUrlError?.message || publicUrlError?.details || publicUrlError?.hint || 'No se pudo generar la URL pública de Supabase Storage.'
        console.error('[Supabase Storage] Error generando URL pública de Supabase:', errorMessage, publicUrlError)
        res.status(500).json({ error: errorMessage })
        return
      }

      return res.status(201).json({
        ok: true,
        filename,
        path: storagePath,
        url: publicUrlData.publicUrl,
      })
    }

    console.warn('[Supabase Storage] No se detectó cliente Supabase válido. Guardando localmente en directorio uploads/ en lugar de Supabase Storage.')
    const localFilePath = resolve(uploadsDir, filename)
    writeFileSync(localFilePath, file.buffer)
    const filePath = `/uploads/${filename}`
    const fileUrl = `${req.protocol}://${req.get('host')}${filePath}`

    res.status(201).json({ ok: true, filename, path: filePath, url: fileUrl })
  } catch (err) {
    console.error('Error al subir archivo:', err)
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido al subir el archivo.'
    res.status(500).json({ error: errorMessage })
  }
})

function normalizeRole(role) {
  return ROLE_OPTIONS.includes(role) ? role : 'Agente'
}

function normalizeRoles(roles) {
  if (Array.isArray(roles)) {
    const normalized = roles
      .map(role => normalizeRole(typeof role === 'string' ? role.trim() : ''))
      .filter(role => role !== 'Agente' || roles.includes(role))

    return Array.from(new Set(normalized))
  }

  if (typeof roles === 'string') {
    const trimmed = roles.trim()
    if (!trimmed) {
      return []
    }

    if (trimmed.startsWith('[')) {
      try {
        return normalizeRoles(JSON.parse(trimmed))
      } catch {
        // Se continúa con el parseo simple a continuación.
      }
    }

    return normalizeRoles([trimmed])
  }

  return []
}

function normalizeRolePayload(payload) {
  const requestedRoles = normalizeRoles(payload?.roles)
  if (requestedRoles.length > 0) {
    return requestedRoles
  }

  const primaryRole = normalizeRole(typeof payload?.role === 'string' ? payload.role.trim() : '')
  return [primaryRole]
}

function derivePrimaryRole(roles) {
  return roles[0] ?? 'Agente'
}

function extractRolesFromRow(row) {
  const requestedRoles = normalizeRoles(row?.roles)
  if (requestedRoles.length > 0) {
    return requestedRoles
  }

  const primaryRole = normalizeRole(row?.rol)
  return [primaryRole]
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash)
}

function serializeUserRecord(row) {
  let roles = extractRolesFromRow(row)

  if (isSupportLockedEmail(row?.correo)) {
    roles = enforceLockedSupportRoles(row?.correo, roles)
  }

  return {
    id: String(row.id),
    correo: row.correo,
    nombre: row.nombre || row.correo,
    rol: derivePrimaryRole(roles),
    roles,
    must_change_password: row.must_change_password === true,
  }
}

function formatTimestamp(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string') {
    return value
  }

  return new Date(value).toISOString()
}

function serializeReportRow(row) {
  return {
    id: String(row.id),
    month: String(row.month),
    year: Number(row.year),
    insured_name: String(row.insured_name ?? ''),
    plate: String(row.plate ?? ''),
    policy: String(row.policy ?? ''),
    service_type: String(row.service_type ?? ''),
    coverage: row.coverage ?? null,
    brand: String(row.brand ?? ''),
    model: String(row.model ?? ''),
    color: String(row.color ?? ''),
    year_vehicle: row.year_vehicle === null ? null : Number(row.year_vehicle),
    status: String(row.status ?? 'Seguimiento de caso'),
    observation_comment: String(row.observation_comment ?? ''),
    evidence_url: row.evidence_url ?? null,
    evidence_filename: row.evidence_filename ?? null,
    evidence_path: row.evidence_path ?? null,
    evidence_urls: Array.isArray(row.evidence_urls)
      ? row.evidence_urls.map((item) => ({
          url: String((item ?? {}).url ?? ''),
          filename: String((item ?? {}).filename ?? ''),
          path: String((item ?? {}).path ?? ''),
        }))
      : row.evidence_urls && typeof row.evidence_urls === 'string'
        ? JSON.parse(row.evidence_urls)
        : null,
    created_by: row.created_by ?? null,
    created_by_name: String(row.created_by_name ?? ''),
    created_by_email: String(row.created_by_email ?? ''),
    created_at: formatTimestamp(row.created_at ?? new Date()),
    updated_at: formatTimestamp(row.updated_at ?? row.created_at ?? new Date()),
  }
}

function serializeUpdateRow(row) {
  return {
    id: String(row.id),
    report_id: String(row.report_id ?? ''),
    status: String(row.status ?? 'Seguimiento de caso'),
    comment: String(row.comment ?? ''),
    added_by: row.added_by ?? null,
    added_by_name: String(row.added_by_name ?? ''),
    added_by_email: String(row.added_by_email ?? ''),
    created_at: formatTimestamp(row.created_at ?? new Date()),
  }
}

function getReportId() {
  return randomUUID()
}

async function ensureOnlinePresenceTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS online_presence (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      last_seen BIGINT NOT NULL
    )
  `)
}

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre TEXT,
      correo TEXT,
      password TEXT,
      rol TEXT DEFAULT 'Agente',
      roles JSONB DEFAULT '[]'::jsonb,
      must_change_password BOOLEAN DEFAULT FALSE,
      creado_en TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre TEXT`)
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS correo TEXT`)
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password TEXT`)
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'Agente'`)
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb`)
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE`)
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW()`)

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_password_bcrypt_check'
          AND conrelid = 'usuarios'::regclass
      ) THEN
        ALTER TABLE usuarios
        ADD CONSTRAINT users_password_bcrypt_check
        CHECK (password IS NULL OR password ~ '^\\$2[aby]\\$\\d\\d\\$');
      END IF;
    END $$;
  `)
}

async function ensureUsersRolesColumn() {
  await pool.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb
  `)
}

async function ensureUsersMustChangePasswordColumn() {
  await pool.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE
  `)
}

async function ensureUsersPasswordConstraint() {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_password_bcrypt_check'
          AND conrelid = 'usuarios'::regclass
      ) THEN
        ALTER TABLE usuarios
        ADD CONSTRAINT users_password_bcrypt_check
        CHECK (password IS NULL OR password ~ '^\\$2[aby]\\$\\d\\d\\$');
      END IF;
    END $$;
  `)
}

async function ensureReportUpdatesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS report_updates (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Seguimiento de caso',
      comment TEXT NOT NULL DEFAULT '',
      added_by TEXT,
      added_by_name TEXT NOT NULL DEFAULT '',
      added_by_email TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_report_updates_report_id ON report_updates (report_id, created_at ASC)
  `)
}

async function ensureReportsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      insured_name TEXT NOT NULL,
      plate TEXT NOT NULL,
      policy TEXT NOT NULL,
      service_type TEXT NOT NULL,
      coverage TEXT,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      color TEXT NOT NULL,
      year_vehicle INTEGER,
      status TEXT NOT NULL,
      observation_comment TEXT NOT NULL DEFAULT '',
      evidence_url TEXT,
      evidence_filename TEXT,
      evidence_path TEXT,
      evidence_urls JSONB,
      created_by TEXT,
      created_by_name TEXT NOT NULL DEFAULT '',
      created_by_email TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reports' AND column_name = 'created_at' AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE reports
        ALTER COLUMN created_at TYPE timestamptz
        USING created_at AT TIME ZONE 'UTC';
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reports' AND column_name = 'updated_at' AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE reports
        ALTER COLUMN updated_at TYPE timestamptz
        USING updated_at AT TIME ZONE 'UTC';
      END IF;
    END $$;
  `)

  // Agregar columnas de evidencia si no existen
  await pool.query(`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS evidence_url TEXT
  `)

  await pool.query(`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS evidence_filename TEXT
  `)

  await pool.query(`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS evidence_path TEXT
  `)

  await pool.query(`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS evidence_urls JSONB
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reports_month_year_created_at ON reports (month, year, created_at DESC)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reports_created_by_email ON reports (LOWER(created_by_email))
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reports_created_at_desc ON reports (created_at DESC)
  `)
}

async function ensureReportUpdatesTableWrapper() {
  await ensureReportUpdatesTable()
}

async function ensureFailedReportAttemptsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS failed_report_attempts (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      missing_fields TEXT[] NOT NULL,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_failed_attempts_user_email ON failed_report_attempts (LOWER(user_email))
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_failed_attempts_attempted_at ON failed_report_attempts (attempted_at DESC)
  `)
}

async function loadReportsWithUpdates(query = '', values = []) {
  const reportsResult = await pool.query(
    `
      SELECT * FROM reports
      ${query}
      ORDER BY created_at DESC
    `,
    values
  )

  if (reportsResult.rows.length === 0) {
    return []
  }

  const updatesResult = await pool.query(
    `
      SELECT * FROM report_updates
      WHERE report_id = ANY($1)
      ORDER BY created_at ASC
    `,
    [reportsResult.rows.map(row => row.id)]
  )

  const updatesByReportId = updatesResult.rows.reduce((acc, row) => {
    acc[row.report_id] = [...(acc[row.report_id] ?? []), serializeUpdateRow(row)]
    return acc
  }, {})

  return reportsResult.rows.map(row => ({
    ...serializeReportRow(row),
    report_updates: updatesByReportId[row.id] ?? [],
  }))
}

async function loadSingleReportWithUpdates(reportId) {
  console.log(`[loadSingleReportWithUpdates] inicio reportId=${reportId}`)
  const reportResult = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId])
  console.log(`[loadSingleReportWithUpdates] report query rowCount=${reportResult.rowCount}`)

  if (reportResult.rowCount === 0) {
    console.warn(`[loadSingleReportWithUpdates] informe no encontrado reportId=${reportId}`)
    return null
  }

  const updatesResult = await pool.query(
    'SELECT * FROM report_updates WHERE report_id = $1 ORDER BY created_at ASC',
    [reportId]
  )
  console.log(`[loadSingleReportWithUpdates] updates query rowCount=${updatesResult.rowCount}`)

  return {
    ...serializeReportRow(reportResult.rows[0]),
    report_updates: updatesResult.rows.map(serializeUpdateRow),
  }
}

async function updateUserRoleInSupabase(email, nextRole) {
  const admin = getSupabaseAdminClient()

  if (!admin) {
    throw new Error('No hay configuración de Supabase en el servidor.')
  }

  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })

  if (error) {
    if (error.message === 'Invalid API key') {
      throw new Error('Clave service role inválida. Reemplázala por la clave real de Supabase en .env para persistir el rol.')
    }

    throw new Error(error.message)
  }

  const targetUser = data.users.find(user => user.email?.toLowerCase() === normalizedEmail)

  if (!targetUser) {
    throw new Error('Usuario no encontrado en Supabase.')
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(targetUser.id, {
    user_metadata: {
      ...(targetUser.user_metadata ?? {}),
      role: nextRole,
    },
  })

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    userId: targetUser.id,
    email: targetUser.email,
    role: nextRole,
  }
}

app.get('/', (req, res) => {
  res.send('Servidor funcionando')
})

app.get('/usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre, correo, rol, roles FROM usuarios')
    res.json(result.rows.map(serializeUserRecord))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

authRoutes.post('/login', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!email || !password) {
      res.status(400).json({ error: 'Faltan credenciales.' })
      return
    }

    const result = await pool.query(
      'SELECT id, nombre, correo, password, rol, roles, must_change_password FROM usuarios WHERE LOWER(correo) = LOWER($1)',
      [email]
    )

    if (result.rowCount === 0) {
      res.status(401).json({ error: 'Credenciales inválidas.' })
      return
    }

    const user = result.rows[0]

    if (user.must_change_password === true) {
      res.json({
        user: serializeUserRecord(user),
        must_change_password: true,
      })
      return
    }

    if (!user.password) {
      res.json({
        user: serializeUserRecord(user),
        must_change_password: true,
      })
      return
    }

    const isValid = await comparePassword(password, user.password)

    if (!isValid) {
      res.status(401).json({ error: 'Credenciales inválidas.' })
      return
    }

    res.json({
      user: serializeUserRecord(user),
      must_change_password: false,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al iniciar sesión.' })
  }
})

app.use('/auth', authRoutes)

app.post('/usuarios', async (req, res) => {
  try {
    const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim() : ''
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const requirePasswordChange = req.body?.requirePasswordChange === true
    const roles = enforceLockedSupportRoles(correo, normalizeRolePayload(req.body))
    const primaryRole = derivePrimaryRole(roles)

    if (!correo) {
      res.status(400).json({ error: 'Falta el correo del usuario' })
      return
    }

    const existing = await pool.query(
      'SELECT id, nombre, correo, password, rol, roles, must_change_password FROM usuarios WHERE LOWER(correo) = LOWER($1)',
      [correo]
    )

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0]
      const nextName = nombre || existingUser.nombre || existingUser.correo
      const baseNextRoles = roles.length > 0 ? roles : extractRolesFromRow(existingUser)
      const nextRoles = enforceLockedSupportRoles(correo, baseNextRoles)
      const nextPrimaryRole = derivePrimaryRole(nextRoles)
      const nextHash = password ? await hashPassword(password) : existingUser.password
      const nextMustChangePassword = requirePasswordChange || existingUser.must_change_password === true || !!password

      const updated = await pool.query(
        `UPDATE usuarios
         SET nombre = $1,
             password = $2,
             rol = $3,
             roles = $4,
             must_change_password = $5
         WHERE LOWER(correo) = LOWER($6)
         RETURNING id, nombre, correo, password, rol, roles, must_change_password`,
        [nextName, nextHash, nextPrimaryRole, JSON.stringify(nextRoles), nextMustChangePassword, correo]
      )

      // Operación idempotente: devolver el usuario existente sin ruido en logs.
      res.json({
        user: serializeUserRecord(updated.rows[0] ?? existingUser),
        existed: true,
      })
      return
    }

    const hash = password ? await hashPassword(password) : null
    const mustChangePassword = requirePasswordChange || !!password

    const result = await pool.query(
      'INSERT INTO usuarios (nombre, correo, password, rol, roles, must_change_password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, correo, rol, roles, must_change_password',
      [nombre || correo, correo, hash, primaryRole, JSON.stringify(roles), mustChangePassword]
    )

    res.json({ user: serializeUserRecord(result.rows[0]) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear usuario' })
  }
})

app.put('/usuarios/:email/rol', async (req, res) => {
  try {
    const email = typeof req.params.email === 'string' ? req.params.email.trim() : ''
    const roles = enforceLockedSupportRoles(email, normalizeRolePayload(req.body))
    const primaryRole = derivePrimaryRole(roles)

    if (!email) {
      res.status(400).json({ error: 'Falta el correo del usuario.' })
      return
    }

    const updated = await pool.query(
      'UPDATE usuarios SET rol = $1, roles = $2 WHERE LOWER(correo) = LOWER($3) RETURNING id, nombre, correo, rol, roles',
      [primaryRole, JSON.stringify(roles), email]
    )

    if (updated.rowCount === 0) {
      res.status(404).json({ error: 'Usuario no encontrado.' })
      return
    }

    const user = serializeUserRecord(updated.rows[0])

    // Notificar a los clientes SSE sobre el cambio de roles
    try {
      const payload = JSON.stringify({ type: 'role-change', email: user.correo, roles: user.roles })
      for (const client of sseClients) {
        try {
          client.write(`event: role-change\n`)
          client.write(`data: ${payload}\n\n`)
        } catch (e) {
          // Ignora clientes que fallan al escribir
        }
      }
    } catch (err) {
      console.warn('Error notificando via SSE:', err)
    }

    res.json({ ok: true, user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar el rol.' })
  }
})

// Endpoint SSE para notificaciones en tiempo real
app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  // Enviar un comentario inicial para mantener la conexión
  res.write(': connected\n\n')

  sseClients.add(res)

  req.on('close', () => {
    sseClients.delete(res)
  })
})

app.put('/usuarios/:email/password', async (req, res) => {
  try {
    const email = typeof req.params.email === 'string' ? req.params.email.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!email || !password) {
      res.status(400).json({ error: 'Faltan datos para actualizar la contraseña.' })
      return
    }

    const updated = await pool.query(
      'UPDATE usuarios SET password = $1, must_change_password = false WHERE LOWER(correo) = LOWER($2) RETURNING id, nombre, correo, rol, roles, must_change_password',
      [await hashPassword(password), email]
    )

    if (updated.rowCount === 0) {
      res.status(404).json({ error: 'Usuario no encontrado.' })
      return
    }

    res.json({ user: serializeUserRecord(updated.rows[0]) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar la contraseña.' })
  }
})

app.delete('/usuarios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'ID de usuario inválido' })
      return
    }

    const existing = await pool.query('SELECT correo FROM usuarios WHERE id = $1', [id])
    if (existing.rowCount === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }

    const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id])

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }

    res.json({ ok: true, id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar usuario' })
  }
})

app.patch('/usuarios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : ''

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'ID de usuario inválido' })
      return
    }

    if (!nombre) {
      res.status(400).json({ error: 'El nombre no puede estar vacío.' })
      return
    }

    const updated = await pool.query(
      'UPDATE usuarios SET nombre = $1 WHERE id = $2 RETURNING id, nombre, correo, rol, roles',
      [nombre, id]
    )

    if (updated.rowCount === 0) {
      res.status(404).json({ error: 'Usuario no encontrado.' })
      return
    }

    res.json({ ok: true, user: serializeUserRecord(updated.rows[0]) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar el nombre del usuario.' })
  }
})

app.get('/reports', async (req, res) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month.trim() : ''
    const year = typeof req.query.year === 'string' && req.query.year.trim() ? Number(req.query.year) : null

    const conditions = []
    const values = []

    if (month) {
      values.push(month)
      conditions.push(`month = $${values.length}`)
    }

    if (year !== null && Number.isFinite(year)) {
      values.push(year)
      conditions.push(`year = $${values.length}`)
    }

    const query = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const reports = await loadReportsWithUpdates(query, values)

    res.json({ reports })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener informes' })
  }
})

app.get('/reports/count', async (req, res) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : ''

    if (!email) {
      res.status(400).json({ error: 'Falta el correo del usuario.' })
      return
    }

    const result = await pool.query(
      'SELECT COUNT(*)::int AS count FROM reports WHERE LOWER(created_by_email) = LOWER($1)',
      [email]
    )

    res.json({ count: result.rows[0].count })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al contar informes' })
  }
})

app.get('/reports/:id', async (req, res) => {
  const reportId = req.params.id
  console.log(`[GET] /reports/${reportId} - inicio`)

  try {
    const report = await loadSingleReportWithUpdates(reportId)
    console.log(`[GET] /reports/${reportId} - carga de informe completada`, { reportExists: Boolean(report) })

    if (!report) {
      console.warn(`[GET] /reports/${reportId} - informe no encontrado`)
      res.status(404).json({ error: 'Informe no encontrado.' })
      return
    }

    res.json({ report })
    console.log(`[GET] /reports/${reportId} - éxito`)
  } catch (error) {
    console.error(`[GET] /reports/${reportId} - error`, error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: `Error al obtener el informe: ${errorMessage}` })
  }
})

function getCurrentSpanishMonth() {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return months[new Date().getMonth()]
}

function normalizeReportPayload(payload) {
  const now = new Date()
  const month = typeof payload.month === 'string' && payload.month.trim() ? payload.month : getCurrentSpanishMonth()
  const year = Number.isFinite(Number(payload.year)) ? Number(payload.year) : now.getFullYear()

  return {
    month,
    year,
    insured_name: String(payload.insured_name ?? ''),
    plate: String(payload.plate ?? ''),
    policy: String(payload.policy ?? ''),
    service_type: String(payload.service_type ?? ''),
    coverage: payload.coverage ?? null,
    brand: String(payload.brand ?? ''),
    model: String(payload.model ?? ''),
    color: String(payload.color ?? ''),
    year_vehicle: payload.year_vehicle === undefined || payload.year_vehicle === null ? null : Number(payload.year_vehicle),
    status: String(payload.status ?? 'Seguimiento de caso'),
    observation_comment: String(payload.observation_comment ?? ''),
    evidence_url: payload.evidence_url ?? null,
    evidence_filename: payload.evidence_filename ?? null,
    evidence_path: payload.evidence_path ?? null,
    evidence_urls: Array.isArray(payload.evidence_urls) ? payload.evidence_urls : null,
    created_by: payload.created_by ?? null,
    created_by_name: String(payload.created_by_name ?? ''),
    created_by_email: String(payload.created_by_email ?? ''),
  }
}

app.post('/reports', async (req, res) => {
  try {
    const payload = normalizeReportPayload(req.body ?? {})
    
    // Validar campos requeridos
    const requiredFields = {
      service_type: payload.service_type,
      insured_name: payload.insured_name,
      plate: payload.plate,
      policy: payload.policy,
      brand: payload.brand,
      model: payload.model,
      color: payload.color,
      status: payload.status,
    }
    
    const missingFields = Object.entries(requiredFields)
      .filter(([, value]) => !value || String(value).trim() === '')
      .map(([field]) => field)
    
    // Si faltan campos, registrar intento fallido
    if (missingFields.length > 0) {
      try {
        await pool.query(
          `INSERT INTO failed_report_attempts (user_id, user_email, user_name, missing_fields)
           VALUES ($1, $2, $3, $4)`,
          [
            payload.created_by || null,
            payload.created_by_email || '',
            payload.created_by_name || '',
            missingFields
          ]
        )
      } catch (logError) {
        console.error('Error al registrar intento fallido:', logError)
      }
      
      res.status(400).json({ 
        error: `Faltan campos requeridos: ${missingFields.join(', ')}` 
      })
      return
    }

    const reportId = getReportId()
    const createdAt = new Date().toISOString()

    const result = await pool.query(`
      INSERT INTO reports (
        id, month, year, insured_name, plate, policy, service_type, coverage, brand, model, color,
        year_vehicle, status, observation_comment, evidence_url, evidence_filename, evidence_path, evidence_urls, created_by, created_by_name, created_by_email,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `, [
      reportId,
      payload.month,
      Number(payload.year),
      payload.insured_name,
      payload.plate,
      payload.policy,
      payload.service_type ?? '',
      payload.coverage ?? null,
      payload.brand ?? '',
      payload.model ?? '',
      payload.color ?? '',
      payload.year_vehicle === undefined || payload.year_vehicle === null ? null : Number(payload.year_vehicle),
      payload.status ?? 'Seguimiento de caso',
      payload.observation_comment ?? '',
      payload.evidence_url ?? null,
      payload.evidence_filename ?? null,
      payload.evidence_path ?? null,
      payload.evidence_urls ? JSON.stringify(payload.evidence_urls) : null,
      payload.created_by ?? null,
      payload.created_by_name ?? '',
      payload.created_by_email ?? '',
      createdAt,
      createdAt,
    ])

    const report = {
      ...serializeReportRow(result.rows[0]),
      report_updates: [],
    }

    res.status(201).json({ report })
  } catch (error) {
    console.error('Error al crear informe:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: `Error al crear el informe: ${errorMessage}` })
  }
})

app.post('/reports/bulk', async (req, res) => {
  try {
    const reports = Array.isArray(req.body?.reports) ? req.body.reports : []

    if (reports.length === 0) {
      res.status(400).json({ error: 'No se proporcionaron informes para crear.' })
      return
    }

    const values = []
    const placeholders = []
    let index = 1

    for (const rawPayload of reports) {
      const payload = normalizeReportPayload(rawPayload)
      const reportId = getReportId()
      const createdAt = new Date().toISOString()

      values.push(
        reportId,
        payload.month,
        payload.year,
        payload.insured_name,
        payload.plate,
        payload.policy,
        payload.service_type,
        payload.coverage,
        payload.brand,
        payload.model,
        payload.color,
        payload.year_vehicle,
        payload.status,
        payload.observation_comment,
        payload.evidence_url,
        payload.evidence_filename,
        payload.evidence_path,
        payload.evidence_urls ? JSON.stringify(payload.evidence_urls) : null,
        payload.created_by,
        payload.created_by_name,
        payload.created_by_email,
        createdAt,
        createdAt
      )

      const rowPlaceholders = Array.from({ length: 23 }, (_, offset) => `$${index + offset}`)
      placeholders.push(`(${rowPlaceholders.join(', ')})`)
      index += 23
    }

    const result = await pool.query(`
      INSERT INTO reports (
        id, month, year, insured_name, plate, policy, service_type, coverage, brand, model, color,
        year_vehicle, status, observation_comment, evidence_url, evidence_filename, evidence_path, evidence_urls, created_by, created_by_name, created_by_email,
        created_at, updated_at
      ) VALUES ${placeholders.join(', ')}
      RETURNING *
    `, values)

    const createdReports = result.rows.map(row => ({
      ...serializeReportRow(row),
      report_updates: [],
    }))

    res.status(201).json({ reports: createdReports })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear los informes' })
  }
})

app.patch('/reports/:id', async (req, res) => {
  try {
    const changes = req.body ?? {}
    const entries = Object.entries(changes)

    if (entries.length === 0) {
      res.status(400).json({ error: 'No hay cambios para aplicar.' })
      return
    }

    const setClauses = []
    const values = []

    for (const [key, value] of entries) {
      if (key === 'id' || key === 'created_at' || key === 'report_updates') {
        continue
      }

      values.push(value)
      setClauses.push(`${key} = $${values.length}`)
    }

    values.push(new Date().toISOString())
    setClauses.push(`updated_at = $${values.length}`)
    values.push(req.params.id)

    const query = `UPDATE reports SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`
    const result = await pool.query(query, values)

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Informe no encontrado.' })
      return
    }

    const report = await loadSingleReportWithUpdates(req.params.id)
    res.json({ report })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al actualizar el informe' })
  }
})

app.delete('/reports/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING id', [req.params.id])

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Informe no encontrado.' })
      return
    }

    res.json({ ok: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar el informe' })
  }
})

app.get('/failed-report-attempts', async (req, res) => {
  try {
    const days = Math.max(1, Number(req.query.days) || 30)
    const result = await pool.query(`
      SELECT 
        user_email,
        user_name,
        COUNT(DISTINCT failed_report_attempts.id) as attempt_count,
        MAX(attempted_at) as last_attempt,
        COALESCE(array_agg(DISTINCT unnest) FILTER (WHERE unnest IS NOT NULL), ARRAY[]::TEXT[]) as all_missing_fields
      FROM failed_report_attempts,
      LATERAL unnest(missing_fields) as unnest
      WHERE attempted_at >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY user_email, user_name
      ORDER BY MAX(attempted_at) DESC
    `, [days])

    console.log(`✓ GET /failed-report-attempts - Se encontraron ${result.rows.length} usuarios con intentos fallidos`)
    
    res.json({
      users: result.rows.map(row => ({
        email: row.user_email,
        name: row.user_name,
        attemptCount: Number(row.attempt_count),
        lastAttempt: row.last_attempt,
        missingFields: Array.isArray(row.all_missing_fields) ? row.all_missing_fields : [],
      })),
    })
  } catch (error) {
    console.error('✗ Error al obtener intentos fallidos:', error)
    res.status(500).json({ error: 'Error al obtener intentos fallidos' })
  }
})

// Devuelve intentos individuales (raw) para listados y conteo por intento
app.get('/failed-report-attempts/raw', async (req, res) => {
  try {
    const days = Math.max(1, Number(req.query.days) || 30)
    const result = await pool.query(`
      SELECT id, user_id, user_email, user_name, missing_fields, attempted_at
      FROM failed_report_attempts
      WHERE attempted_at >= NOW() - ($1::int * INTERVAL '1 day')
      ORDER BY attempted_at DESC NULLS LAST
      LIMIT 1000
    `, [days])

    console.log('GET /failed-report-attempts/raw query returned', result.rows.length, 'rows')
    res.json({
      attempts: result.rows.map(row => ({
        id: row.id,
        email: row.user_email,
        name: row.user_name,
        missingFields: row.missing_fields,
        attemptedAt: row.attempted_at,
      })),
    })
  } catch (error) {
    console.error('✗ Error GET /failed-report-attempts/raw:', error)
    res.status(500).json({ error: 'Error al obtener intentos (raw)' })
  }
})

app.get('/failed-report-attempts/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase()
    const days = Math.max(1, Number(req.query.days) || 30)
    const result = await pool.query(`
      SELECT user_email, user_name, missing_fields, attempted_at
      FROM failed_report_attempts
      WHERE LOWER(user_email) = $1
      AND attempted_at >= NOW() - ($2::int * INTERVAL '1 day')
      ORDER BY attempted_at DESC NULLS LAST
      LIMIT 20
    `, [email, days])

    res.json({
      attempts: result.rows.map(row => ({
        email: row.user_email,
        name: row.user_name,
        missingFields: Array.isArray(row.missing_fields) ? row.missing_fields : [],
        attemptedAt: row.attempted_at,
      })),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener detalles de intentos' })
  }
})

app.post('/failed-report-attempts/register', async (req, res) => {
  console.log('📥 POST /failed-report-attempts/register recibido')
  console.log('  Content-Type:', req.get('content-type'))
  console.log('  Body type:', typeof req.body)
  console.log('  Body:', JSON.stringify(req.body).slice(0, 200))
  
  try {
    let user_id, user_email, user_name, missing_fields

    // Manejar tanto JSON como FormData/sendBeacon
    if (typeof req.body === 'object' && req.body !== null) {
      // Si es un objeto JSON
      user_id = req.body.user_id || null
      user_email = req.body.user_email || ''
      user_name = req.body.user_name || ''
      missing_fields = Array.isArray(req.body.missing_fields) ? req.body.missing_fields : []
    } else if (typeof req.body === 'string') {
      // Si viene como string (sendBeacon a veces lo envía así)
      try {
        const parsed = JSON.parse(req.body)
        user_id = parsed.user_id || null
        user_email = parsed.user_email || ''
        user_name = parsed.user_name || ''
        missing_fields = Array.isArray(parsed.missing_fields) ? parsed.missing_fields : []
      } catch (parseErr) {
        console.warn('⚠️ No se pudo parsear JSON:', parseErr)
        user_email = ''
        missing_fields = []
      }
    }

    console.log('  Parsed data:', { user_email, user_name, missingFieldsCount: missing_fields.length, missingFields: missing_fields.join(', ') })

    if (!user_email || !Array.isArray(missing_fields) || missing_fields.length === 0) {
      console.warn('❌ Solicitud inválida - datos incompletos:', { user_email, missing_fields })
      res.status(400).json({ error: 'Datos incompletos para registrar intento' })
      return
    }

    // Normalizar email a minúsculas
    const normalizedEmail = user_email.trim().toLowerCase()

    // Registrar cada intento sin deduplicación (permite múltiples intentos del mismo usuario)
    const result = await pool.query(
      `INSERT INTO failed_report_attempts (user_id, user_email, user_name, missing_fields)
       VALUES ($1, $2, $3, $4)
       RETURNING id, attempted_at`,
      [
        user_id || null,
        normalizedEmail,
        user_name || normalizedEmail,
        missing_fields
      ]
    )

    const newId = result.rows[0]?.id
    const newAttemptedAt = result.rows[0]?.attempted_at
    
    console.log(`✅ Intento fallido registrado:`)
    console.log(`   ID: ${newId}`)
    console.log(`   Email: ${normalizedEmail}`)
    console.log(`   Campos faltantes: ${missing_fields.join(', ')}`)
    console.log(`   Registrado en: ${newAttemptedAt}`)
    
    res.json({ ok: true, id: newId })
  } catch (error) {
    console.error('❌ Error registering failed attempt:', error)
    res.status(500).json({ error: 'Error al registrar intento fallido' })
  }
})

// Borrar un intento por ID
app.delete('/failed-report-attempts/:id', async (req, res) => {
  try {
    const id = req.params.id
    const result = await pool.query(`DELETE FROM failed_report_attempts WHERE id = $1`, [id])
    console.log(`🗑️ DELETE /failed-report-attempts/${id} - filas afectadas: ${result.rowCount}`)
    res.json({ ok: true, deleted: result.rowCount === 1 })
  } catch (error) {
    console.error('✗ Error DELETE /failed-report-attempts/:id', error)
    res.status(500).json({ error: 'Error al borrar intento' })
  }
})

app.post('/reports/:id/updates', async (req, res) => {
  const reportId = req.params.id
  console.log(`[POST] /reports/${reportId}/updates - inicio`, { payload: req.body })

  try {
    const payload = req.body ?? {}
    const updateId = getReportId()
    const createdAt = new Date().toISOString()

    const report = await loadSingleReportWithUpdates(reportId)
    console.log(`[POST] /reports/${reportId}/updates - informe cargado`, { reportId, reportExists: Boolean(report) })

    if (!report) {
      console.warn(`[POST] /reports/${reportId}/updates - informe no encontrado`)
      res.status(404).json({ error: 'Informe no encontrado.' })
      return
    }

    const statusToInsert = payload.status ?? report.status
    console.log(`[POST] /reports/${reportId}/updates - insertando actualización`, {
      updateId,
      reportId,
      status: statusToInsert,
      comment: payload.comment ?? '',
      added_by: payload.added_by ?? null,
      added_by_name: payload.added_by_name ?? '',
      added_by_email: payload.added_by_email ?? '',
      createdAt,
    })

    await pool.query(`
      INSERT INTO report_updates (
        id, report_id, status, comment, added_by, added_by_name, added_by_email, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      updateId,
      reportId,
      statusToInsert,
      payload.comment ?? '',
      payload.added_by ?? null,
      payload.added_by_name ?? '',
      payload.added_by_email ?? '',
      createdAt,
    ])
    console.log(`[POST] /reports/${reportId}/updates - insert completado`, { updateId })

    const reportStatusToStore = payload.status === 'Informativo'
      ? report.status
      : payload.status ?? report.status

    const updateReportResult = await pool.query(
      'UPDATE reports SET status = $1, updated_at = $2 WHERE id = $3',
      [reportStatusToStore, createdAt, reportId]
    )
    console.log(`[POST] /reports/${reportId}/updates - actualización de informe completada`, { rowCount: updateReportResult.rowCount })

    const updateResult = await pool.query('SELECT * FROM report_updates WHERE id = $1', [updateId])
    console.log(`[POST] /reports/${reportId}/updates - select update`, { rowCount: updateResult.rowCount })

    if (updateResult.rowCount === 0 || !updateResult.rows[0]) {
      console.error(`[POST] /reports/${reportId}/updates - actualización insertada no encontrada`, { updateId })
      res.status(500).json({ error: 'La actualización se creó pero no se pudo recuperar.' })
      return
    }

    const serializedUpdate = serializeUpdateRow(updateResult.rows[0])
    res.status(201).json({ update: serializedUpdate })
    console.log(`[POST] /reports/${reportId}/updates - éxito`, { updateId })
  } catch (error) {
    console.error(`[POST] /reports/${reportId}/updates - error`, error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: `Error al agregar la actualización: ${errorMessage}` })
  }
})

app.get('/reports/:id/updates', async (req, res) => {
  const reportId = req.params.id
  console.log(`[GET] /reports/${reportId}/updates - inicio`)

  try {
    console.log(`[GET] /reports/${reportId}/updates - consultando existencia del informe`)
    const reportResult = await pool.query('SELECT id FROM reports WHERE id = $1', [reportId])
    console.log(`[GET] /reports/${reportId}/updates - reportResult`, { rowCount: reportResult.rowCount })

    if (reportResult.rowCount === 0) {
      console.warn(`[GET] /reports/${reportId}/updates - informe no encontrado`)
      res.status(404).json({ error: 'Informe no encontrado.' })
      return
    }

    console.log(`[GET] /reports/${reportId}/updates - consultando actualizaciones`)
    const updatesResult = await pool.query(
      'SELECT * FROM report_updates WHERE report_id = $1 ORDER BY created_at ASC',
      [reportId]
    )
    console.log(`[GET] /reports/${reportId}/updates - updatesResult`, { rowCount: updatesResult.rowCount })

    const updates = updatesResult.rows.map(serializeUpdateRow)
    console.log(`[GET] /reports/${reportId}/updates - éxito`, { updatesCount: updates.length })
    res.json({ updates })
  } catch (error) {
    console.error(`[GET] /reports/${reportId}/updates - error`, error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: `Error al obtener las actualizaciones: ${errorMessage}` })
  }
})

app.get('/online-users', async (req, res) => {
  try {
    // Cutoff de 45 segundos para dar margen frente a latencia y sincronización ligera.
    const cutoff = Date.now() - 1000 * 45
    const result = await pool.query(
      'SELECT user_id, email, full_name, role, last_seen FROM online_presence WHERE last_seen > $1 ORDER BY last_seen DESC',
      [cutoff]
    )

    res.json({
      users: result.rows.map(row => ({
        userId: row.user_id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        lastSeen: Number(row.last_seen),
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener usuarios conectados' })
  }
})

app.post('/online-users', async (req, res) => {
  try {
    const { userId, email, fullName, role } = req.body

    if (!userId || !email || !fullName || !role) {
      res.status(400).json({ error: 'Faltan datos para registrar presencia.' })
      return
    }

    const serverTimestamp = Date.now()

    await pool.query(
      `INSERT INTO online_presence (user_id, email, full_name, role, last_seen)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id)
       DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role, last_seen = EXCLUDED.last_seen`,
      [userId, email, fullName, role, serverTimestamp]
    )

    res.json({ ok: true, lastSeen: serverTimestamp })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar presencia' })
  }
})

app.post('/online-users/offline', async (req, res) => {
  try {
    let body = req.body

    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch (parseError) {
        console.warn('Payload de offline no es JSON válido:', body)
      }
    }

    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''

    if (!userId) {
      res.status(400).json({ error: 'Falta el identificador del usuario.' })
      return
    }

    await pool.query('DELETE FROM online_presence WHERE user_id = $1', [userId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al limpiar la presencia' })
  }
})

app.delete('/online-users/:userId', async (req, res) => {
  try {
    await pool.query('DELETE FROM online_presence WHERE user_id = $1', [req.params.userId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar presencia' })
  }
})

async function startCleanupTask() {
  // Limpia usuarios con presencia expirada cada 20 segundos
  setInterval(async () => {
    try {
      const cutoff = Date.now() - 1000 * 45
      const result = await pool.query(
        'DELETE FROM online_presence WHERE last_seen < $1 RETURNING user_id',
        [cutoff]
      )
      
      if (result.rows.length > 0) {
        console.log(`Limpiados ${result.rows.length} usuarios inactivos`)
      }
    } catch (err) {
      console.error('Error limpiando presencia expirada:', err)
    }
  }, 20000)
}

async function start() {
  try {
    console.log('Inicializando base de datos...')
    await ensureOnlinePresenceTable()
    await ensureUsersTable()
    await ensureUsersRolesColumn()
    await ensureUsersMustChangePasswordColumn()
    await ensureUsersPasswordConstraint()
    await ensureReportsTable()
    await ensureReportUpdatesTableWrapper()
    await ensureFailedReportAttemptsTable()
    console.log('Base de datos inicializada correctamente')
  } catch (err) {
    console.error('Error inicializando base de datos:', err instanceof Error ? err.message : err)
    console.warn('Continuando sin BD - usando fallback en memoria')
  }

  // Inicia la tarea de limpieza de presencia expirada
  startCleanupTask()

  const PORT = process.env.PORT || 3000
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT}`)
  })
}

start().catch(err => {
  console.error('Error crítico al iniciar:', err)
  process.exit(1)
})

import { randomUUID } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import pool from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
// Logging middleware para diagnóstico de rutas
app.use((req, res, next) => {
  try {
    console.log(`[HTTP] ${req.method} ${req.originalUrl}`)
  } catch (e) {
    // ignore
  }
  next()
})
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
  'https://intelasist-yps2-64ysydqqy-jose-rodriguez-s-projects1.vercel.app',
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

// Serve static files from dist folder for the React frontend (MUST BE BEFORE API ROUTES)
const distPath = join(__dirname, 'dist')
console.log(`[EXPRESS] Serving static files from: ${distPath}`)
app.use(express.static(distPath))

// Middleware para capturar información del usuario desde el body o headers
app.use((req, res, next) => {
  try {
    // Si el body tiene información del usuario, la capturamos
    if (req.body) {
      if (req.body.userId || req.body.user_id) {
        req.user = {
          id: req.body.userId || req.body.user_id,
          email: req.body.userEmail || req.body.user_email,
          user_metadata: {
            full_name: req.body.userName || req.body.user_name,
          },
        }
      }
    }
  } catch (e) {
    // ignore
  }
  next()
})

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
          statusCode: uploadError?.statusCode || null,
          error: uploadError?.error || null,
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
  return roles[0] || 'Agente'
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
    insured_name: String(row.insured_name || ''),
    plate: String(row.plate || ''),
    policy: String(row.policy || ''),
    service_type: String(row.service_type || ''),
    coverage: row.coverage || null,
    brand: String(row.brand || ''),
    model: String(row.model || ''),
    color: String(row.color || ''),
    year_vehicle: row.year_vehicle === null ? null : Number(row.year_vehicle),
    status: String(row.status || 'Seguimiento de caso'),
    observation_comment: String(row.observation_comment || ''),
    evidence_url: row.evidence_url || null,
    evidence_filename: row.evidence_filename || null,
    evidence_path: row.evidence_path || null,
    evidence_urls: Array.isArray(row.evidence_urls)
      ? row.evidence_urls.map((item) => ({
          url: String((item || {}).url || ''),
          filename: String((item || {}).filename || ''),
          path: String((item || {}).path || ''),
        }))
      : row.evidence_urls && typeof row.evidence_urls === 'string'
        ? JSON.parse(row.evidence_urls)
        : null,
    created_by: row.created_by || null,
    created_by_name: String(row.created_by_name || ''),
    created_by_email: String(row.created_by_email || ''),
    created_at: formatTimestamp(row.created_at || new Date()),
    updated_at: formatTimestamp(row.updated_at || row.created_at || new Date()),
  }
}

function serializeUpdateRow(row) {
  return {
    id: String(row.id),
    report_id: String(row.report_id || ''),
    status: String(row.status || 'Seguimiento de caso'),
    comment: String(row.comment || ''),
    added_by: row.added_by || null,
    added_by_name: String(row.added_by_name || ''),
    added_by_email: String(row.added_by_email || ''),
    created_at: formatTimestamp(row.created_at || new Date()),
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
      completed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      missing_details JSONB NOT NULL DEFAULT '[]'::jsonb,
      completed_details JSONB NOT NULL DEFAULT '[]'::jsonb,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    ALTER TABLE failed_report_attempts
    ADD COLUMN IF NOT EXISTS completed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
  `)

  await pool.query(`
    ALTER TABLE failed_report_attempts
    ADD COLUMN IF NOT EXISTS missing_details JSONB NOT NULL DEFAULT '[]'::jsonb
  `)

  await pool.query(`
    ALTER TABLE failed_report_attempts
    ADD COLUMN IF NOT EXISTS completed_details JSONB NOT NULL DEFAULT '[]'::jsonb
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_failed_attempts_user_email ON failed_report_attempts (LOWER(user_email))
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_failed_attempts_attempted_at ON failed_report_attempts (attempted_at DESC)
  `)
}

async function ensureUserPermissionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL,
      modules_access JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id)
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id)
  `)
}

async function ensureUserPermissionDetailsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_permission_details (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      permission_id UUID NOT NULL REFERENCES user_permissions(id) ON DELETE CASCADE,
      permission_key TEXT NOT NULL,
      granted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(permission_id, permission_key)
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_permission_details_permission_id ON user_permission_details(permission_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_permission_details_permission_key ON user_permission_details(permission_key)
  `)
}

async function ensureAuditLogsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT,
      user_email TEXT,
      user_name TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      entity_id UUID,
      entity_type TEXT,
      old_values JSONB,
      new_values JSONB,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)
  `)
}

async function logAuditEvent(req, {
  action,
  module,
  entityId = null,
  entityType = null,
  oldValues = null,
  newValues = null,
  status = 'success',
  errorMessage = null,
  auditUserId = null,
  auditUserEmail = null,
  auditUserName = null,
}) {
  try {
    const ipAddress = req.headers['x-forwarded-for']
      ? String(req.headers['x-forwarded-for']).split(',')[0].trim()
      : req.ip || null
    const userAgent = req.headers['user-agent'] ? String(req.headers['user-agent']) : null

    // Usar datos de auditoría explícitos si se proporcionan, sino capturar de req.user
    let userId = auditUserId || (req.user && req.user.id) || null
    let userEmail = (auditUserEmail || (req.user && req.user.email) || '').trim()
    let userName = (auditUserName || (req.user && req.user.user_metadata && req.user.user_metadata.full_name) || '').trim()

    console.log(`[logAuditEvent] INICIO - Parámetros explícitos recibidos:`, { auditUserId, auditUserEmail, auditUserName })
    console.log(`[logAuditEvent] Usuario antes de fallbacks:`, { userId, userEmail, userName })

    // Get user name from database if email is available and name not provided
    if (!userName && userEmail) {
      try {
        const userResult = await pool.query(
          'SELECT nombre FROM usuarios WHERE correo = $1 LIMIT 1',
          [userEmail]
        )
        const dbName = userResult.rows[0]?.nombre || ''
        if (dbName) {
          userName = (dbName || '').trim()
          console.log(`[logAuditEvent] Nombre obtenido de BD:`, { userName })
        }
      } catch (e) {
        console.warn('Error fetching user name for audit:', e)
      }
    }

    // Fallback chain: metadata > db > email > 'Usuario Desconocido'
    if (!userName) {
      userName = userEmail || 'Usuario Desconocido'
      console.log(`[logAuditEvent] Usando fallback de email o 'Usuario Desconocido':`, { userName })
    }

    console.log(`[logAuditEvent] DATOS FINALES A INSERTAR:`, { 
      action, 
      module, 
      userId, 
      userEmail, 
      userName,
      entityId,
      status
    })

    const insertQuery = `INSERT INTO audit_logs (
      user_id,
      user_email,
      user_name,
      action,
      module,
      entity_id,
      entity_type,
      old_values,
      new_values,
      ip_address,
      user_agent,
      status,
      error_message
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`

    const auditResult = await pool.query(insertQuery, [
      userId,
      userEmail,
      userName,
      action,
      module,
      entityId,
      entityType,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent,
      status,
      errorMessage,
    ])

    const auditId = auditResult.rows[0]?.id
    console.log(`[logAuditEvent] ✅ Audit log insertado con ID: ${auditId}`, { userId, userEmail, userName })
  } catch (auditError) {
    console.error('Error logging audit event:', auditError)
  }
}

async function ensureDeletedReportsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deleted_reports (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      report_id TEXT NOT NULL,
      original_data JSONB NOT NULL,
      deleted_by TEXT,
      deleted_by_name TEXT,
      deleted_by_email TEXT,
      deleted_at TIMESTAMPTZ DEFAULT NOW(),
      restored_at TIMESTAMPTZ,
      permanently_deleted_at TIMESTAMPTZ,
      permanently_deleted_by TEXT,
      reason TEXT
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_deleted_reports_report_id ON deleted_reports(report_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_deleted_reports_deleted_by ON deleted_reports(deleted_by)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_deleted_reports_deleted_at ON deleted_reports(deleted_at DESC)
  `)
}

async function ensureUserActivityLogTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_activity_log (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL,
      reports_created INTEGER DEFAULT 0,
      last_login TIMESTAMPTZ,
      last_activity TIMESTAMPTZ,
      is_suspended BOOLEAN DEFAULT false,
      suspension_reason TEXT,
      suspended_at TIMESTAMPTZ,
      suspended_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id)
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id)
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

  console.log('[API] loadReportsWithUpdates', { query: query.trim(), values, count: reportsResult.rows.length })

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
    acc[row.report_id] = [...(acc[row.report_id] || []), serializeUpdateRow(row)]
    return acc
  }, {})

  return reportsResult.rows.map(row => ({
    ...serializeReportRow(row),
    report_updates: updatesByReportId[row.id] || [],
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
      ...(targetUser.user_metadata || {}),
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

// NOTE: Root route removed - served by express.static(distPath) and SPA routing middleware

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
        user: serializeUserRecord(updated.rows[0] || existingUser),
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

    console.log('[API] GET /reports request', { month, year, query: req.query })

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

function normalizeAttemptDetails(value) {
  if (Array.isArray(value)) {
    return value.filter(item => item && typeof item === 'object' && (item.field || item.label || item.value !== undefined))
  }

  if (typeof value === 'string') {
    try {
      return normalizeAttemptDetails(JSON.parse(value))
    } catch {
      return []
    }
  }

  return []
}

function normalizeReportPayload(payload) {
  const now = new Date()
  const month = typeof payload.month === 'string' && payload.month.trim() ? payload.month : getCurrentSpanishMonth()
  const year = Number.isFinite(Number(payload.year)) ? Number(payload.year) : now.getFullYear()

  return {
    month,
    year,
    insured_name: String(payload.insured_name || ''),
    plate: String(payload.plate || ''),
    policy: String(payload.policy || ''),
    service_type: String(payload.service_type || ''),
    coverage: payload.coverage || null,
    brand: String(payload.brand || ''),
    model: String(payload.model || ''),
    color: String(payload.color || ''),
    year_vehicle: payload.year_vehicle === undefined || payload.year_vehicle === null ? null : Number(payload.year_vehicle),
    status: String(payload.status || 'Seguimiento de caso'),
    observation_comment: String(payload.observation_comment || ''),
    evidence_url: payload.evidence_url || null,
    evidence_filename: payload.evidence_filename || null,
    evidence_path: payload.evidence_path || null,
    evidence_urls: Array.isArray(payload.evidence_urls) ? payload.evidence_urls : null,
    created_by: payload.created_by || null,
    created_by_name: String(payload.created_by_name || ''),
    created_by_email: String(payload.created_by_email || ''),
  }
}

app.post('/reports', async (req, res) => {
  try {
    const payload = normalizeReportPayload(req.body || {})
    
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

    // Garantizar que created_by está relleno con fallback a req.user
    const userId = payload.created_by || req.user?.id || null
    const userEmail = (payload.created_by_email || req.user?.email || '').trim()
    let userName = (payload.created_by_name || req.user?.user_metadata?.full_name || '').trim()

    // Get user name from database if email is available and name not provided
    if (!userName && userEmail) {
      try {
        const userResult = await pool.query(
          'SELECT nombre FROM usuarios WHERE correo = $1 LIMIT 1',
          [userEmail]
        )
        const dbName = userResult.rows[0]?.nombre || ''
        userName = (dbName || req.user?.user_metadata?.full_name || '').trim()
      } catch (e) {
        console.warn('Error fetching user name:', e)
        userName = (req.user?.user_metadata?.full_name || '').trim()
      }
    }
    
    // Fallback chain: metadata > email > 'Usuario Desconocido'
    if (!userName) {
      userName = userEmail || 'Usuario Desconocido'
    }

    console.log(`[API] Audit user captured:`, { userId, userEmail, userName })

    console.log(`[API] Creating report with created_by fallback:`, {
      userId,
      userEmail,
      userName,
      payloadProvidedUserId: payload.created_by,
    })

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
      payload.service_type || '',
      payload.coverage || null,
      payload.brand || '',
      payload.model || '',
      payload.color || '',
      payload.year_vehicle === undefined || payload.year_vehicle === null ? null : Number(payload.year_vehicle),
      payload.status || 'Seguimiento de caso',
      payload.observation_comment || '',
      payload.evidence_url || null,
      payload.evidence_filename || null,
      payload.evidence_path || null,
      payload.evidence_urls ? JSON.stringify(payload.evidence_urls) : null,
      userId,
      userName,
      userEmail,
      createdAt,
      createdAt,
    ])

    const report = {
      ...serializeReportRow(result.rows[0]),
      report_updates: [],
    }

    if (userId) {
      await pool.query(`
        INSERT INTO user_activity_log (user_id, reports_created, last_activity, is_suspended)
        VALUES ($1, 1, NOW(), false)
        ON CONFLICT (user_id) DO UPDATE
          SET reports_created = COALESCE(user_activity_log.reports_created, 0) + 1,
              last_activity = NOW()
      `, [userId])
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
    const changes = req.body || {}
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
    const reportId = req.params.id

    // Obtener el reporte antes de eliminarlo (para auditoría)
    const reportQuery = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId])
    if (reportQuery.rowCount === 0) {
      return res.status(404).json({ error: 'Informe no encontrado.' })
    }

    const reportData = reportQuery.rows[0]

    // Obtener información del usuario
    const userId = req.user?.id || null
    const userEmail = (req.user?.email || '').trim()
    const userName = (req.user?.user_metadata?.full_name || '').trim()

    console.log(`[DELETE /reports/:id] Usuario:`, { userId, userEmail, userName })

    // Ejecutar la eliminación
    const result = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING id', [reportId])

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Informe no encontrado.' })
    }

    // Registrar auditoría
    await logAuditEvent(req, {
      action: 'delete_report',
      module: 'reports',
      entityId: reportId,
      entityType: 'report',
      oldValues: reportData,
      status: 'success',
      auditUserId: userId,
      auditUserEmail: userEmail,
      auditUserName: userName,
    })

    console.log(`[DELETE /reports/:id] ✅ Reporte ${reportId} eliminado. Auditoría registrada.`)
    res.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /reports/:id] Error:', error)

    // Registrar error en auditoría
    const userId = req.user?.id || null
    const userEmail = (req.user?.email || '').trim()
    const userName = (req.user?.user_metadata?.full_name || '').trim()

    await logAuditEvent(req, {
      action: 'delete_report',
      module: 'reports',
      entityId: req.params.id,
      entityType: 'report',
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
      auditUserId: userId,
      auditUserEmail: userEmail,
      auditUserName: userName,
    })

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
        COALESCE(array_agg(DISTINCT unnest_missing) FILTER (WHERE unnest_missing IS NOT NULL), ARRAY[]::TEXT[]) as all_missing_fields,
        COALESCE(array_agg(DISTINCT unnest_completed) FILTER (WHERE unnest_completed IS NOT NULL), ARRAY[]::TEXT[]) as all_completed_fields
      FROM failed_report_attempts
      LEFT JOIN LATERAL unnest(missing_fields) as unnest_missing ON TRUE
      LEFT JOIN LATERAL unnest(completed_fields) as unnest_completed ON TRUE
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
        completedFields: Array.isArray(row.all_completed_fields) ? row.all_completed_fields : [],
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
    await ensureFailedReportAttemptsTable()

    const days = Math.max(1, Number(req.query.days) || 30)
    const result = await pool.query(`
      SELECT id, user_id, user_email, user_name, missing_fields, completed_fields, missing_details, completed_details, attempted_at
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
        missingFields: Array.isArray(row.missing_fields) ? row.missing_fields : [],
        completedFields: Array.isArray(row.completed_fields) ? row.completed_fields : [],
        missingDetails: normalizeAttemptDetails(row.missing_details),
        completedDetails: normalizeAttemptDetails(row.completed_details),
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
      SELECT user_email, user_name, missing_fields, completed_fields, missing_details, completed_details, attempted_at
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
        completedFields: Array.isArray(row.completed_fields) ? row.completed_fields : [],
        missingDetails: row.missing_details,
        completedDetails: row.completed_details,
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
    await ensureFailedReportAttemptsTable()

    let user_id, user_email, user_name, missing_fields, completed_fields, missing_details, completed_details

    // Manejar tanto JSON como FormData/sendBeacon
    if (typeof req.body === 'object' && req.body !== null) {
      // Si es un objeto JSON
      user_id = req.body.user_id || null
      user_email = req.body.user_email || ''
      user_name = req.body.user_name || ''
      missing_fields = Array.isArray(req.body.missing_fields) ? req.body.missing_fields : []
      completed_fields = Array.isArray(req.body.completed_fields)
        ? req.body.completed_fields
        : (Array.isArray(req.body.completedFields) ? req.body.completedFields : [])
      missing_details = normalizeAttemptDetails(req.body.missing_details ?? req.body.missingDetails)
      completed_details = normalizeAttemptDetails(req.body.completed_details ?? req.body.completedDetails)
    } else if (typeof req.body === 'string') {
      // Si viene como string (sendBeacon a veces lo envía así)
      try {
        const parsed = JSON.parse(req.body)
        user_id = parsed.user_id || null
        user_email = parsed.user_email || ''
        user_name = parsed.user_name || ''
        missing_fields = Array.isArray(parsed.missing_fields) ? parsed.missing_fields : []
        completed_fields = Array.isArray(parsed.completed_fields)
          ? parsed.completed_fields
          : (Array.isArray(parsed.completedFields) ? parsed.completedFields : [])
        missing_details = normalizeAttemptDetails(parsed.missing_details ?? parsed.missingDetails)
        completed_details = normalizeAttemptDetails(parsed.completed_details ?? parsed.completedDetails)
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
      `INSERT INTO failed_report_attempts (user_id, user_email, user_name, missing_fields, completed_fields, missing_details, completed_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, attempted_at`,
      [
        user_id || null,
        normalizedEmail,
        user_name || normalizedEmail,
        missing_fields,
        completed_fields,
        JSON.stringify(missing_details),
        JSON.stringify(completed_details)
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
    const payload = req.body || {}
    const updateId = getReportId()
    const createdAt = new Date().toISOString()

    const report = await loadSingleReportWithUpdates(reportId)
    console.log(`[POST] /reports/${reportId}/updates - informe cargado`, { reportId, reportExists: Boolean(report) })

    if (!report) {
      console.warn(`[POST] /reports/${reportId}/updates - informe no encontrado`)
      res.status(404).json({ error: 'Informe no encontrado.' })
      return
    }

    const isLockedStatus = report.status === 'Informativo' || report.status === 'Validacion'
    const statusToInsert = isLockedStatus ? report.status : payload.status || report.status

    console.log(`[POST] /reports/${reportId}/updates - insertando actualización`, {
      updateId,
      reportId,
      status: statusToInsert,
      comment: payload.comment || '',
      added_by: payload.added_by || null,
      added_by_name: payload.added_by_name || '',
      added_by_email: payload.added_by_email || '',
      createdAt,
      lockedStatus: isLockedStatus,
    })

    await pool.query(`
      INSERT INTO report_updates (
        id, report_id, status, comment, added_by, added_by_name, added_by_email, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      updateId,
      reportId,
      statusToInsert,
      payload.comment || '',
      payload.added_by || null,
      payload.added_by_name || '',
      payload.added_by_email || '',
      createdAt,
    ])
    console.log(`[POST] /reports/${reportId}/updates - insert completado`, { updateId })

    const reportStatusToStore = isLockedStatus
      ? report.status
      : payload.status || report.status

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

// ========== NEW ADMIN ENDPOINTS (API v2) ==========

// GET /api/users/with-activity - Listar usuarios con actividad (SIN auth.admin)
app.get('/api/users/with-activity', async (req, res) => {
  const startTime = Date.now()
  const endpoint = '/api/users/with-activity'
  
  try {
    console.log(`[${new Date().toISOString()}] 📊 ${endpoint} - INICIO`)
    console.log(`  Query params: ${JSON.stringify(req.query)}`)
    console.log(`  User: ${req.user?.email || 'anonymous'}`)
    
    // Step 1: Verificar que la tabla usuarios existe
    console.log(`  [1/3] Verificando esquema de tabla usuarios...`)
    const usuariosSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position
    `)
    if (usuariosSchema.rows.length === 0) {
      throw new Error('Tabla "usuarios" no encontrada')
    }
    console.log(`  ✓ Tabla usuarios tiene ${usuariosSchema.rows.length} columnas:`, usuariosSchema.rows.map(r => `${r.column_name}(${r.data_type})`).join(', '))
    
    // Step 2: Verificar que la tabla user_activity_log existe
    console.log(`  [2/3] Verificando esquema de tabla user_activity_log...`)
    const activitySchema = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_activity_log'
      ORDER BY ordinal_position
    `)
    if (activitySchema.rows.length === 0) {
      console.warn(`  ⚠️  Tabla user_activity_log no encontrada, usando datos solo de usuarios`)
    } else {
      console.log(`  ✓ Tabla user_activity_log tiene ${activitySchema.rows.length} columnas:`, activitySchema.rows.map(r => `${r.column_name}(${r.data_type})`).join(', '))
    }
    
    // Step 3: Ejecutar query
    console.log(`  [3/3] Ejecutando query de usuarios...`)
    
    // First, try a simple query without the JOIN to verify usuarios table works
    try {
      const checkUsarios = await pool.query('SELECT COUNT(*) as count FROM usuarios')
      console.log(`  ✓ Tabla usuarios tiene ${checkUsarios.rows[0].count} registros`)
    } catch (checkErr) {
      console.warn(`  ⚠️  No se pudo contar usuarios:`, checkErr.message)
    }
    
    // Try to get activity log count
    try {
      const checkActivity = await pool.query('SELECT COUNT(*) as count FROM user_activity_log')
      console.log(`  ✓ Tabla user_activity_log tiene ${checkActivity.rows[0].count} registros`)
    } catch (checkErr) {
      console.warn(`  ⚠️  No se pudo contar activity_log:`, checkErr.message)
    }
    
    // Get user id type from schema
    const idTypeQuery = await pool.query(`
      SELECT data_type FROM information_schema.columns 
      WHERE table_name = 'usuarios' AND column_name = 'id'
    `)
    const idType = idTypeQuery.rows[0]?.data_type || 'unknown'
    console.log(`  ℹ️  Tipo de usuarios.id: ${idType}`)
    
    const userIdTypeQuery = await pool.query(`
      SELECT data_type FROM information_schema.columns 
      WHERE table_name = 'user_activity_log' AND column_name = 'user_id'
    `)
    const userIdType = userIdTypeQuery.rows[0]?.data_type || 'unknown'
    console.log(`  ℹ️  Tipo de user_activity_log.user_id: ${userIdType}`)
    
    // Build appropriate JOIN condition based on types
    let joinCondition = 'u.id = ual.user_id'
    if (idType !== userIdType) {
      // If types don't match, cast both to text
      joinCondition = 'u.id::text = ual.user_id::text'
    }
    console.log(`  ℹ️  Condición de JOIN: ${joinCondition}`)
    
    // Verify reports table exists
    try {
      const checkReports = await pool.query('SELECT COUNT(*) as count FROM reports')
      console.log(`  ✓ Tabla reports tiene ${checkReports.rows[0].count} registros`)
    } catch (checkErr) {
      console.warn(`  ⚠️  No se pudo contar reports:`, checkErr.message)
    }
    
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
    
    console.log(`  ✓ Query ejecutada, recuperadas ${result.rows.length} filas`)
    
    const mappedData = result.rows.map((row, idx) => {
      const mapped = {
        id: row.id,
        email: row.email,
        nombre: row.nombre,
        role: row.role,
        reportsCreated: parseInt(row.reportsCreated || '0', 10) || 0,
        lastLogin: row.lastLogin,
        lastActivity: row.lastActivity,
        isSuspended: row.isSuspended || false,
        suspensionReason: row.suspensionReason,
        suspendedAt: row.suspendedAt,
        suspendedBy: row.suspendedBy,
      }
      if (idx === 0) {
        console.log(`  Ejemplo de fila mapeada:`, mapped)
      }
      return mapped
    })
    
    const duration = Date.now() - startTime
    console.log(`  ✅ FIN: ${result.rows.length} usuarios en ${duration}ms`)
    
    res.json(mappedData)
  } catch (err) {
    const duration = Date.now() - startTime
    console.error(`  ❌ ERROR en ${endpoint} (${duration}ms):`, {
      name: err.name,
      message: err.message,
      code: err.code,
      detail: err.detail,
      sqlState: err.sqlState,
      position: err.position,
      internalPosition: err.internalPosition,
      internalQuery: err.internalQuery,
      context: err.where,
      file: err.file,
      line: err.line,
      routine: err.routine,
      stack: err.stack,
    })
    res.status(500).json({ 
      error: 'Error al obtener usuarios',
      details: err.message,
      code: err.code,
      sqlState: err.sqlState,
      timestamp: new Date().toISOString(),
      hint: 'Verifique que las tablas usuarios y user_activity_log existan y tengan el esquema correcto',
    })
  }
})

// GET /api/users - Listar usuarios con actividad (SIN auth.admin)
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.correo as email,
        u.nombre,
        u.rol as role,
        (
          SELECT COUNT(*)
          FROM reports r
          WHERE (r.created_by IS NOT NULL AND r.created_by::text = u.id::text)
            OR (r.created_by_email IS NOT NULL AND LOWER(TRIM(r.created_by_email)) = LOWER(TRIM(u.correo)))
        ) AS "reportsCreated",
        ual.last_login AS "lastLogin",
        ual.last_activity AS "lastActivity",
        ual.is_suspended AS "isSuspended",
        ual.suspension_reason AS "suspensionReason",
        ual.suspended_at AS "suspendedAt",
        ual.suspended_by AS "suspendedBy"
      FROM usuarios u
      LEFT JOIN user_activity_log ual ON u.id::text = ual.user_id
      ORDER BY u.nombre ASC
    `)
    
    res.json(result.rows.map(row => ({
      id: row.id,
      email: row.email,
      nombre: row.nombre,
      role: row.role,
      reportsCreated: row.reportsCreated || 0,
      lastLogin: row.lastLogin,
      lastActivity: row.lastActivity,
      isSuspended: row.isSuspended || false,
      suspensionReason: row.suspensionReason,
      suspendedAt: row.suspendedAt,
      suspendedBy: row.suspendedBy,
    })))
  } catch (err) {
    console.error('Error fetching users:', err)
    res.status(500).json({ error: 'Error al obtener usuarios' })
  }
})

// GET /api/users/statistics - Estadísticas del sistema
app.get('/api/users/statistics', async (req, res) => {
  try {
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM usuarios) AS total_users,
        (SELECT COUNT(*) FROM user_activity_log WHERE is_suspended = true) AS suspended_users,
        (SELECT COUNT(*) FROM reports) AS total_reports,
        (SELECT COUNT(*) FROM user_activity_log WHERE is_suspended = false OR is_suspended IS NULL) AS active_users
    `)

    const row = statsResult.rows[0] || {}
    const totalUsers = parseInt(row.total_users || 0)
    const suspendedUsers = parseInt(row.suspended_users || 0)
    const totalReports = parseInt(row.total_reports || 0)
    const activeUsers = parseInt(row.active_users || 0)

    res.json({
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalReports,
      averageReportsPerUser: totalUsers > 0 ? Number((totalReports / totalUsers).toFixed(2)) : 0,
    })
  } catch (err) {
    console.error('Error fetching statistics:', err)
    res.status(500).json({ error: 'Error al obtener estadísticas' })
  }
})

// GET /api/users/with-permissions - Usuarios + Permisos (batch)
app.get('/api/users/with-permissions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id AS "id",
        u.correo AS "email",
        u.nombre AS "fullName",
        u.rol AS "role",
        COALESCE(up.modules_access ->> 'presence_badge_style', 'none') AS "presenceStyle",
        COALESCE(jsonb_object_agg(upd.permission_key, upd.granted) FILTER (WHERE upd.permission_key IS NOT NULL), '{}'::jsonb) AS "permissions"
      FROM usuarios u
      LEFT JOIN user_permissions up ON up.user_id = u.id
      LEFT JOIN user_permission_details upd ON upd.permission_id = up.id
      GROUP BY u.id, u.correo, u.nombre, u.rol, up.modules_access
      ORDER BY u.nombre ASC
    `)

    // Get all permission keys defined in the system
    const allPermissionsResult = await pool.query(`
      SELECT DISTINCT permission_key FROM user_permission_details
      WHERE permission_key IS NOT NULL
      ORDER BY permission_key
    `)
    
    const allPermissionKeys = new Set(allPermissionsResult.rows.map(r => r.permission_key))

    const usersWithPerms = result.rows.map((row) => {
      // Initialize complete permissions object with all keys set to false
      const completePermissions = {}
      allPermissionKeys.forEach(key => {
        completePermissions[key] = false
      })
      
      // Override with actual user permissions from database
      if (row.permissions && typeof row.permissions === 'object') {
        Object.assign(completePermissions, row.permissions)
      }

      return {
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        role: row.role,
        presenceStyle: row.presenceStyle || 'none',
        permissions: completePermissions,
      }
    })

    res.json(usersWithPerms)
  } catch (err) {
    console.error('Error fetching users with permissions:', err)
    res.status(500).json({ error: 'Error al obtener usuarios con permisos' })
  }
})

// GET /api/users/with-modules - Usuarios + Módulos accesibles
app.get('/api/users/with-modules', async (req, res) => {
  try {
    const usersResult = await pool.query(`
      SELECT 
        u.id AS "userId",
        u.correo AS "email",
        u.nombre AS "userName",
        u.rol AS "role",
        COALESCE(up.modules_access, '{}'::jsonb) AS "modules"
      FROM usuarios u
      LEFT JOIN user_permissions up ON up.user_id::integer = u.id
      ORDER BY u.nombre ASC
    `)

    // Get all module keys defined in the system
    const allModulesResult = await pool.query(`
      SELECT DISTINCT jsonb_object_keys(modules_access) as module_key 
      FROM user_permissions 
      WHERE modules_access IS NOT NULL
    `)
    
    let allModuleKeys = new Set(allModulesResult.rows.map(r => r.module_key))

    // Fallback to expected module keys when DB has no stored modules_access values yet
    if (allModuleKeys.size === 0) {
      allModuleKeys = new Set(['reports', 'evidence', 'updates', 'users', 'system', 'admin'])
    }

    const usersWithModules = usersResult.rows.map(user => {
      // Initialize complete modules object with all keys set to false
      const completeModules = {}
      allModuleKeys.forEach(key => {
        completeModules[key] = false
      })
      
      // Override with actual user modules from database
      if (user.modules && typeof user.modules === 'object') {
        Object.assign(completeModules, user.modules)
      }

      return {
        userId: user.userId,
        email: user.email,
        userName: user.userName,
        role: user.role,
        modules: completeModules,
      }
    })

    res.json(usersWithModules)
  } catch (err) {
    console.error('Error fetching users with modules:', err)
    res.status(500).json({ error: 'Error al obtener usuarios con módulos' })
  }
})

// GET /api/users/:userId - Obtener usuario específico
app.get('/api/users/:userId', async (req, res) => {
  try {
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    
    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' })
    }

    const userResult = await pool.query(`
      SELECT 
        u.id,
        u.correo as email,
        u.nombre,
        u.rol as role,
        u.roles
      FROM usuarios u
      WHERE u.id::text = $1
      LIMIT 1
    `, [userId])
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const reportsCountResult = await pool.query(`
      SELECT COUNT(*) AS reports_created
      FROM reports
      WHERE (created_by IS NOT NULL AND created_by::text = $1)
        OR (created_by_email IS NOT NULL AND LOWER(TRIM(created_by_email)) = LOWER(TRIM($2)))
    `, [userId, userResult.rows[0].email])

    const activityResult = await pool.query(`
      SELECT 
        reports_created,
        last_login,
        last_activity,
        is_suspended,
        suspension_reason,
        suspended_at,
        suspended_by
      FROM user_activity_log
      WHERE user_id = $1
      LIMIT 1
    `, [userId])

    const user = userResult.rows[0]
    const activity = activityResult.rows[0] || {}
    const reportsCount = parseInt(reportsCountResult.rows[0]?.reports_created || 0, 10)

    res.json({
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
        roles: user.roles ? JSON.parse(user.roles) : [user.role],
      },
      activity: {
        reportsCreated: reportsCount,
        lastLogin: activity.last_login,
        lastActivity: activity.last_activity,
        isSuspended: activity.is_suspended || false,
        suspensionReason: activity.suspension_reason,
        suspendedAt: activity.suspended_at,
        suspendedBy: activity.suspended_by,
      },
    })
  } catch (err) {
    console.error('Error fetching user:', err)
    res.status(500).json({ error: 'Error al obtener usuario' })
  }
})

// GET /api/users/:userId/permissions - Permisos granulares por usuario
app.get('/api/users/:userId/permissions', async (req, res) => {
  try {
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' })
    }

    const permResult = await pool.query(
      'SELECT id, modules_access, created_at, updated_at FROM user_permissions WHERE user_id = $1 LIMIT 1',
      [userId]
    )

    if (permResult.rows.length === 0) {
      return res.json({
        permissionId: null,
        permissions: {},
        modules: {},
        createdAt: null,
        updatedAt: null,
      })
    }

    const permission = permResult.rows[0]
    const detailsResult = await pool.query(
      'SELECT permission_key, granted FROM user_permission_details WHERE permission_id = $1',
      [permission.id]
    )

    // Get all permission keys defined in the system
    const allPermissionsResult = await pool.query(`
      SELECT DISTINCT permission_key FROM user_permission_details
      WHERE permission_key IS NOT NULL
      ORDER BY permission_key
    `)
    
    const allPermissionKeys = new Set(allPermissionsResult.rows.map(r => r.permission_key))

    // Initialize complete permissions object with all keys set to false
    const completePermissions = {}
    allPermissionKeys.forEach(key => {
      completePermissions[key] = false
    })

    // Override with actual user permissions from database
    detailsResult.rows.forEach((row) => {
      completePermissions[row.permission_key] = row.granted
    })

    const presenceStyle = typeof permission.modules_access === 'object' && permission.modules_access !== null
      ? (permission.modules_access.presence_badge_style || 'none')
      : 'none'

    res.json({
      permissionId: permission.id,
      permissions: completePermissions,
      modules: permission.modules_access || {},
      presenceStyle,
      createdAt: permission.created_at,
      updatedAt: permission.updated_at,
    })
  } catch (err) {
    console.error('Error fetching user permissions:', err)
    res.status(500).json({ error: 'Error al obtener permisos del usuario' })
  }
})

// POST /api/users/:userId/suspend - Suspender usuario
app.post('/api/users/:userId/suspend', async (req, res) => {
  try {
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Suspendido por administrador'

    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' })
    }

    await pool.query(
      'INSERT INTO user_activity_log (user_id, reports_created, is_suspended) VALUES ($1, 0, true) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    )

    await pool.query(
      'UPDATE user_activity_log SET is_suspended = true, suspension_reason = $1, suspended_at = NOW() WHERE user_id = $2',
      [reason, userId]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('Error suspending user:', err)
    res.status(500).json({ error: 'Error al suspender usuario' })
  }
})

// POST /api/users/:userId/reactivate - Reactivar usuario
app.post('/api/users/:userId/reactivate', async (req, res) => {
  try {
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : ''

    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' })
    }

    await pool.query(
      'INSERT INTO user_activity_log (user_id, reports_created, is_suspended) VALUES ($1, 0, false) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    )

    await pool.query(
      'UPDATE user_activity_log SET is_suspended = false, suspension_reason = NULL, suspended_at = NULL WHERE user_id = $1',
      [userId]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('Error reactivating user:', err)
    res.status(500).json({ error: 'Error al reactivar usuario' })
  }
})

// PUT /api/users/:userId/permissions - Actualizar permisos
app.put('/api/users/:userId/permissions', async (req, res) => {
  try {
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    const permissions = req.body?.permissions || {}
    const presenceStyle = typeof req.body?.presenceStyle === 'string' ? req.body.presenceStyle.trim() : ''

    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' })
    }

    // Realizar las operaciones en una transacción para asegurar atomicidad
    try {
      await pool.query('BEGIN')

      // Get or create permission record
      let permResult = await pool.query(
        'SELECT id, modules_access FROM user_permissions WHERE user_id = $1 FOR UPDATE',
        [userId]
      )

      let permId = permResult.rows[0]?.id
      const existingModulesAccess = permResult.rows[0]?.modules_access && typeof permResult.rows[0].modules_access === 'object'
        ? { ...permResult.rows[0].modules_access }
        : {}

      if (!permId) {
        const createResult = await pool.query(
          'INSERT INTO user_permissions (user_id) VALUES ($1) RETURNING id',
          [userId]
        )
        permId = createResult.rows[0].id
      }

      // Delete existing permissions
      await pool.query(
        'DELETE FROM user_permission_details WHERE permission_id = $1',
        [permId]
      )

      // Insert new permissions
      for (const [key, granted] of Object.entries(permissions)) {
        await pool.query(
          'INSERT INTO user_permission_details (permission_id, permission_key, granted) VALUES ($1, $2, $3)',
          [permId, key, granted]
        )
      }

      const nextModulesAccess = { ...existingModulesAccess }
      if (presenceStyle && presenceStyle !== 'none') {
        nextModulesAccess.presence_badge_style = presenceStyle
      } else {
        delete nextModulesAccess.presence_badge_style
      }

      // Actualizar updated_at en user_permissions
      await pool.query(
        'UPDATE user_permissions SET modules_access = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(nextModulesAccess), permId]
      )

      await pool.query('COMMIT')

      console.log(`[API] Permisos persistidos en BD para usuario: ${userId} (permId=${permId})`)

      // Notificar a los clientes SSE sobre el cambio de permisos en tiempo real (después del COMMIT)
      try {
        const payload = JSON.stringify({ 
          type: 'permissions-updated', 
          userId, 
          permissions,
          timestamp: new Date().toISOString()
        })
        for (const client of sseClients) {
          try {
            client.write(`event: permissions-updated\n`)
            client.write(`data: ${payload}\n\n`)
          } catch (e) {
            // Ignora clientes que fallan al escribir
          }
        }
        console.log(`[SSE] Notificación de permisos actualizada para usuario: ${userId}`)
      } catch (err) {
        console.warn('Error notificando cambio de permisos via SSE:', err)
      }

      res.json({ success: true, message: 'Permisos actualizados', userId, permissions, presenceStyle: presenceStyle || 'none' })
    } catch (txErr) {
      try { await pool.query('ROLLBACK') } catch (e) { /* noop */ }
      console.error('Error en transacción al actualizar permisos:', txErr)
      return res.status(500).json({ error: 'Error al actualizar permisos (transacción)' })
    }
  } catch (err) {
    console.error('Error updating permissions:', err)
    res.status(500).json({ error: 'Error al actualizar permisos' })
  }
})

// PUT /api/users/:userId/modules - Actualizar módulos accesibles
app.put('/api/users/:userId/modules', async (req, res) => {
  try {
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    const modules = req.body?.modules || {}

    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' })
    }

    // Realizar la actualización en una transacción
    try {
      await pool.query('BEGIN')

      // Get or create permission record (lock row)
      let permResult = await pool.query(
        'SELECT id FROM user_permissions WHERE user_id = $1 FOR UPDATE',
        [userId]
      )

      let permId = permResult.rows[0]?.id

      if (!permId) {
        const createResult = await pool.query(
          'INSERT INTO user_permissions (user_id) VALUES ($1) RETURNING id',
          [userId]
        )
        permId = createResult.rows[0].id
      }

      // Update modules_access JSONB column
      const modulesJson = JSON.stringify(modules)
      await pool.query(
        'UPDATE user_permissions SET modules_access = $1, updated_at = NOW() WHERE id = $2',
        [modulesJson, permId]
      )

      await pool.query('COMMIT')

      console.log(`[API] Módulos persistidos en BD para usuario: ${userId} (permId=${permId})`)

      // Notificar a los clientes SSE sobre el cambio de módulos en tiempo real
      try {
        const payload = JSON.stringify({ 
          type: 'modules-updated', 
          userId, 
          modules,
          timestamp: new Date().toISOString()
        })
        for (const client of sseClients) {
          try {
            client.write(`event: modules-updated\n`)
            client.write(`data: ${payload}\n\n`)
          } catch (e) {
            // Ignora clientes que fallan al escribir
          }
        }
        console.log(`[SSE] Notificación de módulos actualizada para usuario: ${userId}`)
      } catch (err) {
        console.warn('Error notificando cambio de módulos via SSE:', err)
      }
      
      res.json({ 
        success: true, 
        message: 'Módulos actualizados correctamente',
        userId,
        modules,
      })
    } catch (txErr) {
      try { await pool.query('ROLLBACK') } catch (e) { /* noop */ }
      console.error('Error en transacción al actualizar módulos:', txErr)
      return res.status(500).json({ error: 'Error al actualizar módulos (transacción)' })
    }
  } catch (err) {
    console.error('Error updating modules:', err)
    res.status(500).json({ error: 'Error al actualizar módulos' })
  }
})

// GET /api/health/auth - Health check del servicio de autenticación
app.get('/api/health/auth', async (req, res) => {
  try {
    const countResult = await pool.query('SELECT COUNT(*) as count FROM usuarios')
    const userCount = parseInt(countResult.rows[0]?.count || 0)

    res.json({
      status: 'healthy',
      message: `Servicio de autenticación disponible`,
      userCount,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error checking auth health:', err)
    res.status(500).json({
      status: 'error',
      message: 'Servicio de autenticación no disponible',
      error: err instanceof Error ? err.message : 'Error desconocido',
    })
  }
})

// ========== TRASH & AUDIT ENDPOINTS ==========

// POST /api/trash - Mover informe a papelera
app.post('/api/trash', async (req, res) => {
  try {
    const reportId = typeof req.body?.reportId === 'string' ? req.body.reportId.trim() : ''
    const originalData = typeof req.body?.originalData === 'object' ? req.body.originalData : {}
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Deleted by user'

    if (!reportId) {
      return res.status(400).json({ error: 'reportId requerido' })
    }

    const existingReport = await pool.query('SELECT id FROM reports WHERE id = $1', [reportId])
    if (existingReport.rowCount === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' })
    }

    // Capturar información del usuario - primero del body, luego de req.user
    let deletedBy = req.body?.userId || (req.user && req.user.id) || null
    let deletedByEmail = (req.body?.userEmail || (req.user && req.user.email) || '').trim()
    let deletedByName = (req.body?.userName || (req.user && req.user.user_metadata && req.user.user_metadata.full_name) || '').trim()

    console.log(`[POST /api/trash] User info from body:`, { 
      bodyUserId: req.body?.userId,
      bodyUserEmail: req.body?.userEmail,
      bodyUserName: req.body?.userName,
    })
    console.log(`[POST /api/trash] User info from req.user:`, {
      reqUserId: req.user?.id,
      reqUserEmail: req.user?.email,
      reqUserName: req.user?.user_metadata?.full_name,
    })

    // Get user name from database if email is available and name not provided
    if (!deletedByName && deletedByEmail) {
      try {
        const userResult = await pool.query(
          'SELECT nombre FROM usuarios WHERE correo = $1 LIMIT 1',
          [deletedByEmail]
        )
        const dbName = userResult.rows[0]?.nombre || ''
        deletedByName = (dbName || '').trim()
      } catch (e) {
        console.warn('Error fetching user name for trash:', e)
      }
    }
    
    // Fallback chain
    if (!deletedByName && deletedByEmail) {
      deletedByName = deletedByEmail
    }
    if (!deletedByName && deletedBy) {
      deletedByName = `User ${deletedBy.slice(0, 8)}`
    }
    if (!deletedByName) {
      deletedByName = 'Usuario Desconocido'
    }

    console.log(`[POST /api/trash] Final user info:`, { deletedBy, deletedByEmail, deletedByName })

    const insertResult = await pool.query(
      `INSERT INTO deleted_reports (
        report_id,
        original_data,
        deleted_by,
        deleted_by_name,
        deleted_by_email,
        deleted_at,
        reason
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      RETURNING id`,
      [
        reportId,
        originalData,
        deletedBy,
        deletedByName,
        deletedByEmail,
        reason,
      ]
    )

    const deletedId = insertResult.rows[0]?.id

    // También podemos borrar el informe original si así se requiere
    await pool.query('DELETE FROM reports WHERE id = $1', [reportId])

    await logAuditEvent(req, {
      action: 'delete_report',
      module: 'reports',
      entityId: reportId,
      entityType: 'report',
      oldValues: originalData,
      newValues: { status: 'trashed', reason },
      status: 'success',
      auditUserId: deletedBy,
      auditUserEmail: deletedByEmail,
      auditUserName: deletedByName,
    })

    res.json({ 
      success: true, 
      id: deletedId,
      reportId,
      reason,
    })
  } catch (err) {
    console.error('Error moving to trash:', err)
    await logAuditEvent(req, {
      action: 'delete_report',
      module: 'reports',
      entityId: req.body?.reportId || null,
      entityType: 'report',
      oldValues: req.body?.originalData || null,
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
      auditUserId: deletedBy,
      auditUserEmail: deletedByEmail,
      auditUserName: deletedByName,
    })
    res.status(500).json({ error: 'Error al mover a papelera' })
  }
})

// GET /api/trash - Obtener papelera (con paginación)
app.get('/api/trash', async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit)) || 50
    const offset = parseInt(String(req.query.offset)) || 0

    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM deleted_reports 
      WHERE permanently_deleted_at IS NULL AND restored_at IS NULL
    `)
    const totalCount = parseInt(countResult.rows[0]?.count || 0)

    const dataResult = await pool.query(`
      SELECT 
        id, report_id, original_data, deleted_by, deleted_by_name, 
        deleted_by_email, deleted_at, restored_at, permanently_deleted_at, 
        reason
      FROM deleted_reports
      WHERE permanently_deleted_at IS NULL AND restored_at IS NULL
      ORDER BY deleted_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset])

    res.json({
      data: dataResult.rows,
      count: totalCount,
      limit,
      offset,
    })
  } catch (err) {
    console.error('Error fetching trash:', err)
    res.status(500).json({ error: 'Error al obtener papelera' })
  }
})

// POST /api/trash/empty - Vaciar papelera (DEBE IR ANTES DE /:id)
app.post('/api/trash/empty', async (req, res) => {
  try {
    // Capturar información del usuario
    const userId = req.user?.id || null
    const userEmail = (req.user?.email || '').trim()
    const userName = (req.user?.user_metadata?.full_name || '').trim()

    console.log(`[POST /api/trash/empty] INICIO - Usuario:`, { userId, userEmail, userName })

    // Obtener todos los registros que serán eliminados (antes de eliminarlos)
    const trashedReports = await pool.query(`
      SELECT id, report_id, original_data, deleted_by, deleted_by_email, deleted_by_name
      FROM deleted_reports 
      WHERE permanently_deleted_at IS NULL AND restored_at IS NULL
    `)

    console.log(`[POST /api/trash/empty] Encontrados ${trashedReports.rows.length} reportes para eliminar`)

    // Registrar auditoría para cada reporte eliminado
    for (const trash of trashedReports.rows) {
      try {
        await logAuditEvent(req, {
          action: 'permanent_delete_report',
          module: 'trash',
          entityId: trash.report_id,
          entityType: 'report',
          oldValues: trash.original_data,
          status: 'success',
          auditUserId: userId,
          auditUserEmail: userEmail,
          auditUserName: userName,
        })
        console.log(`[POST /api/trash/empty] ✅ Auditoría registrada para reporte ${trash.report_id}`)
      } catch (auditErr) {
        console.error(`[POST /api/trash/empty] Error registrando auditoría para ${trash.report_id}:`, auditErr)
      }
    }

    // Ejecutar la eliminación real
    const result = await pool.query(`
      UPDATE deleted_reports 
      SET permanently_deleted_at = NOW() 
      WHERE permanently_deleted_at IS NULL AND restored_at IS NULL
      RETURNING id
    `)

    console.log(`[POST /api/trash/empty] ✅ Papelera vaciada. ${result.rows.length} reportes eliminados permanentemente`)

    // Registrar evento de papelera vaciada
    await logAuditEvent(req, {
      action: 'empty_trash',
      module: 'trash',
      status: 'success',
      newValues: { deleted_count: result.rows.length },
      auditUserId: userId,
      auditUserEmail: userEmail,
      auditUserName: userName,
    })

    res.json({ success: true, deleted_count: result.rows.length })
  } catch (err) {
    console.error('[POST /api/trash/empty] Error emptying trash:', err)

    // Registrar error en auditoría
    const userId = req.user?.id || null
    const userEmail = (req.user?.email || '').trim()
    const userName = (req.user?.user_metadata?.full_name || '').trim()

    await logAuditEvent(req, {
      action: 'empty_trash',
      module: 'trash',
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
      auditUserId: userId,
      auditUserEmail: userEmail,
      auditUserName: userName,
    })

    res.status(500).json({ error: 'Error al vaciar papelera' })
  }
})

// GET /api/trash/stats - Estadísticas de papelera (DEBE IR ANTES DE /:id)
app.get('/api/trash/stats', async (req, res) => {
  const startTime = Date.now()
  const endpoint = '/api/trash/stats'
  
  try {
    console.log(`[${new Date().toISOString()}] 🗑️  ${endpoint} - INICIO`)
    console.log(`  Query params: ${JSON.stringify(req.query)}`)
    console.log(`  User: ${req.user?.email || 'anonymous'}`)
    
    // Verificar que la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'deleted_reports'
      )
    `)
    console.log(`  Tabla deleted_reports existe: ${tableCheck.rows[0].exists}`)
    
    const result = await pool.query(`
      SELECT COUNT(*) as total_deleted
      FROM deleted_reports
      WHERE permanently_deleted_at IS NULL AND restored_at IS NULL
    `)
    
    const totalDeleted = parseInt(result.rows[0]?.total_deleted || 0)
    const duration = Date.now() - startTime
    
    console.log(`  ✅ FIN: ${totalDeleted} reportes en papelera, ${duration}ms`)
    
    res.json({ 
      totalDeleted,
      timestamp: new Date().toISOString(),
      responseTime: duration,
    })
  } catch (err) {
    const duration = Date.now() - startTime
    console.error(`  ❌ ERROR en ${endpoint} (${duration}ms):`, {
      name: err.name,
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      position: err.position,
      stack: err.stack,
    })
    res.status(500).json({ 
      error: 'Error al obtener estadísticas de papelera',
      details: err.message,
      errorCode: err.code,
      timestamp: new Date().toISOString(),
    })
  }
})

// GET /api/trash/:id - Obtener elemento de papelera
app.get('/api/trash/:id', async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    
    if (!id) {
      return res.status(400).json({ error: 'ID requerido' })
    }

    const result = await pool.query(`
      SELECT 
        id, report_id, original_data, deleted_by, deleted_by_name, 
        deleted_by_email, deleted_at, restored_at, permanently_deleted_at, 
        reason
      FROM deleted_reports
      WHERE id = $1
      LIMIT 1
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Elemento de papelera no encontrado' })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('Error fetching trash item:', err)
    res.status(500).json({ error: 'Error al obtener elemento de papelera' })
  }
})

// POST /api/trash/:id/restore - Restaurar informe
app.post('/api/trash/:id/restore', async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    
    if (!id) {
      return res.status(400).json({ error: 'ID requerido' })
    }

    const updateResult = await pool.query(`
      UPDATE deleted_reports 
      SET restored_at = NOW() 
      WHERE id = $1 AND permanently_deleted_at IS NULL
      RETURNING id, report_id
    `, [id])

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Elemento de papelera no encontrado' })
    }

    const restoredReportId = updateResult.rows[0]?.report_id
    
    // Get user info from body or req.user
    const restoredBy = req.body?.userId || req.user?.id || null
    const restoredByEmail = (req.body?.userEmail || req.user?.email || '').trim()
    const restoredByName = (req.body?.userName || req.user?.user_metadata?.full_name || '').trim()

    // Log the restore action
    await logAuditEvent(req, {
      action: 'restore_report',
      module: 'reports',
      entityId: restoredReportId,
      entityType: 'report',
      status: 'success',
      auditUserId: restoredBy,
      auditUserEmail: restoredByEmail,
      auditUserName: restoredByName,
    })

    res.json({ success: true, restored: updateResult.rows[0] })
  } catch (err) {
    console.error('Error restoring report:', err)
    res.status(500).json({ error: 'Error al restaurar informe' })
  }
})

// POST /api/trash/:id/delete - Eliminar permanentemente
app.post('/api/trash/:id/delete', async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    
    if (!id) {
      return res.status(400).json({ error: 'ID requerido' })
    }

    const deleteResult = await pool.query(`
      UPDATE deleted_reports 
      SET permanently_deleted_at = NOW() 
      WHERE id = $1 AND restored_at IS NULL
      RETURNING id, report_id
    `, [id])

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Elemento de papelera no encontrado' })
    }

    const permanentlyDeletedReportId = deleteResult.rows[0]?.report_id

    // Get user info from body or req.user
    const deletedBy = req.body?.userId || req.user?.id || null
    const deletedByEmail = (req.body?.userEmail || req.user?.email || '').trim()
    const deletedByName = (req.body?.userName || req.user?.user_metadata?.full_name || '').trim()

    // Log the permanent delete action
    await logAuditEvent(req, {
      action: 'permanently_delete_report',
      module: 'reports',
      entityId: permanentlyDeletedReportId,
      entityType: 'report',
      status: 'success',
      auditUserId: deletedBy,
      auditUserEmail: deletedByEmail,
      auditUserName: deletedByName,
    })

    res.json({ success: true, deleted: deleteResult.rows[0] })
  } catch (err) {
    console.error('Error deleting report:', err)
    res.status(500).json({ error: 'Error al eliminar informe' })
  }
})

// POST /api/audit-logs - Guardar un evento de auditoría
app.post('/api/audit-logs', async (req, res) => {
  try {
    const body = req.body || {}
    const action = typeof body.action === 'string' && body.action.trim() ? body.action.trim() : null
    const module = typeof body.module === 'string' && body.module.trim() ? body.module.trim() : null

    if (!action || !module) {
      return res.status(400).json({ error: 'action y module son requeridos' })
    }

    const ipAddress = req.headers['x-forwarded-for']
      ? String(req.headers['x-forwarded-for']).split(',')[0].trim()
      : req.ip || null
    const userAgent = req.headers['user-agent'] ? String(req.headers['user-agent']) : null

    // Capturar información del usuario con fallbacks
    let userId = (body.userId || body.user_id || null)
    let userEmail = String(body.userEmail || body.user_email || body.email || '').trim() || null
    let userName = String(body.userName || body.user_name || body.name || '').trim()

    console.log(`[POST /api/audit-logs] 📥 Datos recibidos del frontend:`, { userId, userEmail, userName, action, module })

    // IMPORTANTE: Siempre intentar obtener el nombre de la BD si no viene del frontend
    if (userEmail) {
      try {
        const userResult = await pool.query(
          'SELECT nombre FROM usuarios WHERE correo = $1 LIMIT 1',
          [userEmail]
        )
        const dbName = userResult.rows[0]?.nombre || ''
        if (dbName && !userName) {
          userName = dbName.trim()
          console.log(`[POST /api/audit-logs] 🔍 Nombre obtenido de BD:`, { userName })
        }
      } catch (e) {
        console.warn('Error fetching user name for audit log:', e)
      }
    }

    // Fallbacks en cadena
    if (!userName && userEmail) {
      userName = userEmail
      console.log(`[POST /api/audit-logs] Fallback a email como nombre:`, { userName })
    }
    if (!userName && userId) {
      userName = `User ${userId.slice(0, 8)}`
      console.log(`[POST /api/audit-logs] Fallback a user ID:`, { userName })
    }
    if (!userName) {
      userName = 'Usuario Desconocido'
      console.log(`[POST /api/audit-logs] ⚠️ Fallback a 'Usuario Desconocido'`)
    }

    console.log(`[POST /api/audit-logs] 📝 Datos finales a insertar:`, { userId, userEmail, userName, action, module })

    const auditInsertQuery = `
      INSERT INTO audit_logs (
        user_id,
        user_email,
        user_name,
        action,
        module,
        entity_id,
        entity_type,
        old_values,
        new_values,
        ip_address,
        user_agent,
        status,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, user_id, user_email, user_name, action, module, created_at
    `

    const auditResult = await pool.query(auditInsertQuery, [
      userId,
      userEmail,
      userName,
      action,
      module,
      body.entityId || body.entity_id || null,
      body.entityType || body.entity_type || null,
      body.oldValues || body.old_values || null,
      body.newValues || body.new_values || null,
      ipAddress,
      userAgent,
      body.status || 'success',
      body.errorMessage || body.error_message || null,
    ])

    const insertedAudit = auditResult.rows[0]
    console.log(`[POST /api/audit-logs] ✅ Audit log insertado exitosamente:`, { 
      id: insertedAudit?.id,
      user_id: insertedAudit?.user_id,
      user_email: insertedAudit?.user_email,
      user_name: insertedAudit?.user_name,
      action: insertedAudit?.action,
      module: insertedAudit?.module,
      created_at: insertedAudit?.created_at
    })

    res.json({ success: true, auditId: insertedAudit?.id })
  } catch (err) {
    console.error('Error saving audit log:', err)
    res.status(500).json({ error: 'Error al guardar el log de auditoría' })
  }
})

// GET /api/audit-logs - Obtener logs de auditoría
app.get('/api/audit-logs', async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit)) || 50
    const offset = parseInt(String(req.query.offset)) || 0
    const userId = String(req.query.userId || '')
    const userEmail = String(req.query.userEmail || '')
    const module = String(req.query.module || '')
    const action = String(req.query.action || '')

    let whereClause = ''
    const params = []

    if (userId) {
      whereClause += `${whereClause ? ' AND' : 'WHERE'} al.user_id = $${params.length + 1}`
      params.push(userId)
    }
    if (userEmail) {
      whereClause += `${whereClause ? ' AND' : 'WHERE'} al.user_email ILIKE $${params.length + 1}`
      params.push(`%${userEmail}%`)
    }
    if (module) {
      whereClause += `${whereClause ? ' AND' : 'WHERE'} al.module = $${params.length + 1}`
      params.push(module)
    }
    if (action) {
      whereClause += `${whereClause ? ' AND' : 'WHERE'} al.action = $${params.length + 1}`
      params.push(action)
    }

    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM audit_logs al ${whereClause}
    `, params)
    const totalCount = parseInt(countResult.rows[0]?.count || 0)

    const dataResult = await pool.query(`
      SELECT 
        al.id, al.user_id, al.user_email, 
        COALESCE(
          NULLIF(al.user_name, ''),
          u.nombre,
          al.user_email,
          'Usuario Desconocido'
        ) as user_name,
        al.action, al.module, 
        al.entity_id, al.entity_type, al.old_values, al.new_values, al.status, 
        al.error_message, al.created_at
      FROM audit_logs al
      LEFT JOIN usuarios u ON al.user_email = u.correo
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset])

    res.json({
      data: dataResult.rows,
      count: totalCount,
      limit,
      offset,
    })
  } catch (err) {
    console.error('Error fetching audit logs:', err)
    res.status(500).json({ error: 'Error al obtener logs de auditoría' })
  }
})

// DELETE /api/audit-logs/:id - Eliminar un registro de auditoría
app.delete('/api/audit-logs/:id', async (req, res) => {
  try {
    const auditId = req.params.id
    if (!auditId) {
      return res.status(400).json({ error: 'ID de auditoría requerido' })
    }

    const result = await pool.query('DELETE FROM audit_logs WHERE id = $1 RETURNING id', [auditId])

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro de auditoría no encontrado' })
    }

    res.json({ success: true, deletedId: result.rows[0].id })
  } catch (err) {
    console.error('Error deleting audit log:', err)
    res.status(500).json({ error: 'Error al eliminar el registro de auditoría' })
  }
})

// ADMIN ENDPOINT: Llenar user_names vacíos en audit_logs (TEMPORAL)
app.post('/api/admin/fill-audit-usernames', async (req, res) => {
  try {
    console.log('[FILL AUDIT] Iniciando proceso de llenar user_names...')

    // 1. Obtener todos los registros con user_name vacío o nulo
    const emptyNameResult = await pool.query(`
      SELECT id, user_id, user_email, user_name
      FROM audit_logs
      WHERE user_name IS NULL OR user_name = ''
      LIMIT 1000
    `)

    const emptyNameLogs = emptyNameResult.rows
    console.log(`[FILL AUDIT] Se encontraron ${emptyNameLogs.length} registros con user_name vacío`)

    if (emptyNameLogs.length === 0) {
      return res.json({ success: true, message: 'No hay registros que actualizar', count: 0 })
    }

    let updated = 0
    const updates = []

    // 2. Para cada registro, obtener el nombre del usuario de la tabla usuarios
    for (const log of emptyNameLogs) {
      try {
        let userName = null

        if (log.user_email) {
          // Buscar el usuario por email
          const userResult = await pool.query(
            'SELECT nombre FROM usuarios WHERE correo = $1 LIMIT 1',
            [log.user_email]
          )
          userName = userResult.rows[0]?.nombre || log.user_email
        } else {
          userName = 'Usuario Desconocido'
        }

        updates.push({
          id: log.id,
          user_name: userName,
        })
      } catch (e) {
        console.warn(`[FILL AUDIT] Error procesando log ${log.id}:`, e.message)
        updates.push({
          id: log.id,
          user_name: log.user_email || 'Usuario Desconocido',
        })
      }
    }

    // 3. Actualizar todos los registros
    console.log(`[FILL AUDIT] Actualizando ${updates.length} registros...`)
    for (const update of updates) {
      try {
        await pool.query(
          'UPDATE audit_logs SET user_name = $1 WHERE id = $2',
          [update.user_name, update.id]
        )
        updated++
      } catch (e) {
        console.warn(`[FILL AUDIT] Error actualizando log ${update.id}:`, e.message)
      }
    }

    console.log(`[FILL AUDIT] ✅ Proceso completado: ${updated}/${updates.length} actualizados`)
    res.json({
      success: true,
      message: `Actualizados ${updated} registros`,
      count: updated,
    })
  } catch (err) {
    console.error('[FILL AUDIT] Error:', err)
    res.status(500).json({ error: 'Error al llenar user_names' })
  }
})

// Debug middleware to ensure we reach here
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/assets')) {
    console.log(`[DEBUG] Unmatched route: ${req.method} ${req.path}`)
  }
  next()
})

// SPA Routing Middleware - MUST BE AFTER ALL SPECIFIC ROUTES (api, static files, uploads)
// This catches all non-API requests and serves index.html for React Router
app.use((req, res) => {
  // If it's an API request or static asset, don't serve index.html
  if (req.path.startsWith('/api') || req.path.startsWith('/assets') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Not found' })
  }
  
  // Serve index.html for all other requests (SPA routing)
  const indexPath = join(distPath, 'index.html')
  console.log(`[SPA ROUTER] Serving ${req.path} -> ${indexPath}`)
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err)
      res.status(500).json({ error: 'Server error' })
    }
  })
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

async function ensurePgcryptoExtension() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
}

async function start() {
  try {
    console.log('Inicializando base de datos...')
    await ensurePgcryptoExtension()
    await ensureOnlinePresenceTable()
    await ensureUsersTable()
    await ensureUsersRolesColumn()
    await ensureUsersMustChangePasswordColumn()
    await ensureUsersPasswordConstraint()
    await ensureReportsTable()
    await ensureReportUpdatesTableWrapper()
    await ensureFailedReportAttemptsTable()
    await ensureUserPermissionsTable()
    await ensureUserPermissionDetailsTable()
    await ensureUserActivityLogTable()
    await ensureAuditLogsTable()
    await ensureDeletedReportsTable()
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

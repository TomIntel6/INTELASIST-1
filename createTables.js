import pool from './db.js'

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100),
        correo VARCHAR(100),
        password VARCHAR(255),
        rol VARCHAR(50) DEFAULT 'Agente',
        creado_en TIMESTAMP DEFAULT NOW()
      )
    `)

    await pool.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS password VARCHAR(255)
    `)

    await pool.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS rol VARCHAR(50) DEFAULT 'Agente'
    `)

    await pool.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb
    `)

    await pool.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE
    `)

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

    await pool.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS creado_en TIMESTAMP DEFAULT NOW()
    `)

    console.log('Tabla usuarios creada/actualizada correctamente')
  } catch (err) {
    console.error(err)
  }
}

createTables()

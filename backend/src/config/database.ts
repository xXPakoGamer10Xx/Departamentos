import { Pool, PoolClient } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'departamentos',
  user: process.env.DB_USER || 'depas_user',
  password: process.env.DB_PASSWORD || 'depas_secret_2024',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const STARTUP_MIGRATIONS = `
CREATE TABLE IF NOT EXISTS pagos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inquilino_id  UUID NOT NULL REFERENCES inquilinos(id) ON DELETE CASCADE,
  periodo       VARCHAR(7) NOT NULL,
  monto         NUMERIC(10,2) NOT NULL,
  metodo        VARCHAR(20) NOT NULL DEFAULT 'efectivo',
  qr_token      UUID UNIQUE,
  confirmado    BOOLEAN NOT NULL DEFAULT FALSE,
  confirmado_en TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(inquilino_id, periodo)
);
CREATE INDEX IF NOT EXISTS idx_pagos_inquilino ON pagos(inquilino_id);
CREATE INDEX IF NOT EXISTS idx_pagos_periodo ON pagos(periodo);
CREATE INDEX IF NOT EXISTS idx_pagos_qr_token ON pagos(qr_token);

CREATE TABLE IF NOT EXISTS tickets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inquilino_id  UUID NOT NULL REFERENCES inquilinos(id) ON DELETE CASCADE,
  titulo        VARCHAR(200) NOT NULL,
  descripcion   TEXT NOT NULL,
  estado        VARCHAR(20) NOT NULL DEFAULT 'abierto'
                  CHECK (estado IN ('abierto', 'en_revision', 'resuelto')),
  nota_admin    TEXT,
  creado_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  atendido_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_inquilino ON tickets(inquilino_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado);

CREATE TABLE IF NOT EXISTS cuotas_extra (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inquilino_id  UUID NOT NULL REFERENCES inquilinos(id) ON DELETE CASCADE,
  concepto      VARCHAR(200) NOT NULL,
  monto         NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  periodo       VARCHAR(7) NOT NULL,
  estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'pagado')),
  creado_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  pagado_en     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cuotas_inquilino ON cuotas_extra(inquilino_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado ON cuotas_extra(estado);

CREATE TABLE IF NOT EXISTS notificaciones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo        VARCHAR(200) NOT NULL,
  mensaje       TEXT NOT NULL,
  leido         BOOLEAN NOT NULL DEFAULT FALSE,
  tipo          VARCHAR(50) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leido ON notificaciones(leido);

CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(usuario_id, token)
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_usuario ON push_tokens(usuario_id);

-- Comprobante de pago en pagos
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS comprobante_url TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS comprobante_subido_en TIMESTAMPTZ;

-- Asegurar columnas y constraints actualizados en inquilinos
ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS deposito NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20) DEFAULT 'efectivo';
ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS deposito_tipo VARCHAR(50) DEFAULT 'ninguno';
ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS deposito_fechas JSONB DEFAULT '[]';
ALTER TABLE inquilinos DROP CONSTRAINT IF EXISTS inquilinos_metodo_pago_check;
ALTER TABLE inquilinos ADD CONSTRAINT inquilinos_metodo_pago_check
  CHECK (metodo_pago IS NULL OR metodo_pago IN ('efectivo', 'transferencia', 'ambos'));

-- Columnas de auditoría de escaneo en pagos
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS escaneado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS escaneado_en TIMESTAMPTZ;

-- Rol cobrador en usuarios
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('admin', 'inquilino', 'cobrador'));
`;

export async function initDB(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    await client.query(STARTUP_MIGRATIONS);
  } finally {
    client.release();
  }
}

// Helper para transacciones
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

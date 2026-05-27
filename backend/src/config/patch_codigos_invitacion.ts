/**
 * patch_codigos_invitacion.ts
 * Crea la tabla codigos_invitacion si no existe.
 * Seguro de correr múltiples veces.
 *
 * Uso en producción:
 *   npx ts-node src/config/patch_codigos_invitacion.ts
 */
import 'dotenv/config';
import { pool } from '../config/database';

async function patch() {
  console.log('🔄 Aplicando patch: tabla codigos_invitacion…');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS codigos_invitacion (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        codigo     VARCHAR(10) NOT NULL UNIQUE,
        rol        VARCHAR(20) NOT NULL DEFAULT 'inquilino'
                   CHECK (rol IN ('inquilino', 'cobrador')),
        expira_en  TIMESTAMPTZ NULL,
        usado      BOOLEAN NOT NULL DEFAULT FALSE,
        usado_en   TIMESTAMPTZ,
        usado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_codigo
        ON codigos_invitacion(codigo);
    `);
    console.log('✅ Patch aplicado correctamente.');
  } catch (err) {
    console.error('❌ Error al aplicar patch:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

patch();

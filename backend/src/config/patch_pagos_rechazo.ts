/**
 * patch_pagos_rechazo.ts
 * Migración incremental — agrega columnas de rechazo a la tabla pagos.
 * Seguro de correr múltiples veces (usa IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS).
 *
 * Cómo correr en producción:
 *   npx ts-node src/config/patch_pagos_rechazo.ts
 */
import 'dotenv/config';
import { pool } from '../config/database';

async function patch() {
  console.log('🔄 Aplicando patch: columnas de rechazo en pagos…');
  try {
    await pool.query(`
      ALTER TABLE pagos
        ADD COLUMN IF NOT EXISTS rechazado        BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS rechazado_en     TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS comentario_admin TEXT;
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

import 'dotenv/config';
import { pool } from '../config/database';

// Datos del Excel: BASE DE DATOS DEPAS TEX.xlsx
const departamentosData = Array.from({ length: 12 }, (_, i) => ({
  numero: i + 1,
  estado: 'disponible',
  ubicacion: 'Callejón Zaragoza s/n, San Juan Chiautla, C.P. 56030',
  inventario_base: [
    'Llaves',
    'Puertas en buen estado',
    'Muebles de baño en buen estado',
    'Instalaciones de electricidad completas con placas',
    'Focos funcionando',
    'Refrigerador funcionando',
    '2 sillas',
    '2 bancos',
    'Mesa',
    'Escritorio',
    'Parrilla de gas exterior limpia',
    'Tanque de gas',
    'Cama matrimonial',
  ],
}));

async function seed() {
  console.log('🌱 Ejecutando seed de datos iniciales...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Solo crear departamentos (sin admin_id — se asignará al primer admin que se registre)
    console.log('  📦 Insertando departamentos...');
    for (const depto of departamentosData) {
      await client.query(
        `INSERT INTO departamentos (admin_id, numero, estado, ubicacion, inventario_base)
         VALUES (NULL, $1, $2, $3, $4)
         ON CONFLICT (numero) DO NOTHING`,
        [depto.numero, depto.estado, depto.ubicacion, JSON.stringify(depto.inventario_base)]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Seed completado exitosamente');
    console.log('');
    console.log('📋 Base de datos limpia — sin usuarios');
    console.log('   Registra tu primera cuenta admin desde la app.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error en seed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

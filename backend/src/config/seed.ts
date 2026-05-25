import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { toTitleCase } from '../utils/formatters';

// Datos del Excel: BASE DE DATOS DEPAS TEX.xlsx
const departamentosData = Array.from({ length: 9 }, (_, i) => ({
  numero: i + 1,
  estado: 'ocupado',
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

// Datos tomados directamente del Excel
const inquilinosData = [
  {
    nombre_completo: toTitleCase('VALERIA IRENE ORTIZ VILLALOBOS'),
    depto_numero: 1,
    renta: 3000,
    renta_letra: toTitleCase('TRES MIL PESOS'),
    fecha_pago: '04 de cada mes',
    fecha_inicio: '2025-06-04',
    fecha_termino: '2026-06-04',
    fiador_nombre: toTitleCase('CARLOS ANTONIO ESTRADA LUNA'),
    tel_arrendatario: '5621884728',
    fiador_telefono: '5951012528',
    observaciones: toTitleCase('DEPOSITO EN 2 QUINCENAS'),
    estado: 'activo',
  },
  {
    nombre_completo: toTitleCase('ALVARADO MARTINEZ MARIA ALEJANDRA'),
    depto_numero: 2,
    renta: 3000,
    renta_letra: toTitleCase('TRES MIL PESOS'),
    fecha_pago: '21 de cada mes',
    fecha_inicio: '2025-12-21',
    fecha_termino: '2026-12-21',
    fiador_nombre: toTitleCase('JIMENEZ MITZIU JUAN ANTONIO'),
    tel_arrendatario: '5632769484',
    fiador_telefono: '5613922076',
    observaciones: toTitleCase('DEPOSITO EN 2 QUINCENAS'),
    estado: 'activo',
  },
  {
    nombre_completo: toTitleCase('SANCHEZ MIRANDA CARLOS OSCAR'),
    depto_numero: 3,
    renta: 3100,
    renta_letra: toTitleCase('TRES MIL CIEN PESOS'),
    fecha_pago: '03 de cada mes',
    fecha_inicio: '2026-05-03',
    fecha_termino: '2027-05-03',
    fiador_nombre: toTitleCase('ERANDI DENYSSE JUAREZ GUERRA'),
    tel_arrendatario: '5657201932',
    fiador_telefono: '5515120166',
    observaciones: toTitleCase('EL DEPOSITO SERA EN 2 PAGOS EL 10 Y 17 DE MAYO'),
    estado: 'activo',
  },
  {
    nombre_completo: toTitleCase('REYES CUELLAR LEONARDO'),
    depto_numero: 4,
    renta: 3000,
    renta_letra: toTitleCase('TRES MIL PESOS'),
    fecha_pago: '28 de cada mes',
    fecha_inicio: '2025-04-28',
    fecha_termino: '2025-04-28',
    fiador_nombre: toTitleCase('LOPEZ PORTUGUEZ LUIS PABLO'),
    tel_arrendatario: '5632940408',
    fiador_telefono: '5591429746',
    observaciones: toTitleCase('DEPOSITO EN LA SIGUIENTE RENTA'),
    estado: 'vencido',
  },
  {
    nombre_completo: toTitleCase('MORAN TAPIA CRISTIAN URIEL'),
    depto_numero: 5,
    renta: 3500,
    renta_letra: toTitleCase('TRES MIL QUINIENTOS PESOS'),
    fecha_pago: '30 de cada mes',
    fecha_inicio: '2026-01-30',
    fecha_termino: '2027-01-30',
    fiador_nombre: toTitleCase('VALENCIA BOJORGES PAOLA'),
    tel_arrendatario: '5613186557',
    fiador_telefono: '5518048943',
    observaciones: 'Depósito pendiente',
    estado: 'activo',
  },
  {
    nombre_completo: toTitleCase('EVARISTO REYES ALVARO'),
    depto_numero: 6,
    renta: 3300,
    renta_letra: toTitleCase('TRES MIL TRESCIENTOS PESOS'),
    fecha_pago: '11 de cada mes',
    fecha_inicio: '2026-04-11',
    fecha_termino: '2027-04-11',
    fiador_nombre: toTitleCase('HERNANDEZ BAUTISTA JOSE URIEL'),
    tel_arrendatario: '5572422369',
    fiador_telefono: '5637300042',
    observaciones: toTitleCase('EL DEPOSITO SERA EN 2 QUINCENAS'),
    estado: 'activo',
  },
  {
    nombre_completo: toTitleCase('RIOS CARTAGENA FRANKY JOHAN'),
    depto_numero: 7,
    renta: 3300,
    renta_letra: toTitleCase('TRES MIL TRESCIENTOS PESOS'),
    fecha_pago: '18 de cada mes',
    fecha_inicio: '2025-05-18',
    fecha_termino: '2026-05-18',
    fiador_nombre: toTitleCase('JORGE ALEXIS ARIAS VILLA'),
    tel_arrendatario: '5533913900',
    fiador_telefono: '5579980876',
    observaciones: null,
    estado: 'activo',
  },
  {
    nombre_completo: toTitleCase('ESPEJEL GONZALEZ ALVARO ALONSO'),
    depto_numero: 8,
    renta: 3300,
    renta_letra: toTitleCase('TRES MIL TRESCIENTOS PESOS'),
    fecha_pago: '01 de cada mes',
    fecha_inicio: '2026-02-01',
    fecha_termino: '2027-02-01',
    fiador_nombre: null,
    tel_arrendatario: '5647717880',
    fiador_telefono: null,
    observaciones: toTitleCase('EL DEPOSITO SERA EN 2 QUINCENAS'),
    estado: 'activo',
  },
  {
    nombre_completo: toTitleCase('ORTEGA HERNANDEZ DANIEL'),
    depto_numero: 9,
    renta: 3600,
    renta_letra: toTitleCase('TRES MIL SEISCIENTOS PESOS'),
    fecha_pago: '14 de cada mes',
    fecha_inicio: '2024-10-14',
    fecha_termino: '2025-10-14',
    fiador_nombre: toTitleCase('BARRIOS MARRERO KEILY'),
    tel_arrendatario: '5613917766',
    fiador_telefono: '9992572683',
    observaciones: null,
    estado: 'activo',
  },
];

const configInicial = [
  { clave: 'arrendador_nombre', valor: 'Alba Eunice Armijo Ogazon' },
  { clave: 'arrendador_direccion', valor: 'Callejón Zaragoza s/n, San Juan Chiautla, C.P. 56030' },
];

async function seed() {
  console.log('🌱 Ejecutando seed de datos iniciales...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Crear usuario administrador por defecto
    console.log('  🔑 Creando administrador por defecto...');
    const adminPassword = await bcrypt.hash('Admin2024!', 12);
    await client.query(
      `INSERT INTO usuarios (email, password_hash, nombre_completo, rol)
       VALUES ('admin@departamentos.local', $1, 'Administrador Principal', 'admin')
       ON CONFLICT (email) DO NOTHING`,
      [adminPassword]
    );

    const adminRes = await client.query(`SELECT id FROM usuarios WHERE email = 'admin@departamentos.local'`);
    const adminId = adminRes.rows[0].id;

    // 2. Insertar departamentos
    console.log('  📦 Insertando departamentos...');
    for (const depto of departamentosData) {
      await client.query(
        `INSERT INTO departamentos (admin_id, numero, estado, ubicacion, inventario_base)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (admin_id, numero) DO NOTHING`,
        [adminId, depto.numero, depto.estado, depto.ubicacion, JSON.stringify(depto.inventario_base)]
      );
    }

    // 3. Insertar inquilinos
    console.log('  👤 Insertando inquilinos desde el Excel...');
    for (const inq of inquilinosData) {
      await client.query(
        `INSERT INTO inquilinos (
          admin_id, nombre_completo, depto_numero, renta, renta_letra, fecha_pago,
          fecha_inicio, fecha_termino, fiador_nombre, tel_arrendatario,
          fiador_telefono, observaciones, estado, inventario
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'[]')
        ON CONFLICT DO NOTHING`,
        [
          adminId, inq.nombre_completo, inq.depto_numero, inq.renta, inq.renta_letra,
          inq.fecha_pago, inq.fecha_inicio, inq.fecha_termino,
          inq.fiador_nombre, inq.tel_arrendatario, inq.fiador_telefono,
          inq.observaciones, inq.estado,
        ]
      );
    }

    // 4. Insertar configuración base
    console.log('  ⚙️  Insertando configuración inicial...');
    for (const cfg of configInicial) {
      await client.query(
        `INSERT INTO configuracion (admin_id, clave, valor)
         VALUES ($1, $2, $3)
         ON CONFLICT (admin_id, clave) DO NOTHING`,
        [adminId, cfg.clave, cfg.valor]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Seed completado exitosamente');
    console.log('');
    console.log('📋 Credenciales del administrador:');
    console.log('   Email:      admin@departamentos.local');
    console.log('   Contraseña: Admin2024!');
    console.log('   ⚠️  Cambia la contraseña al primer inicio de sesión!');
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

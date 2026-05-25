import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './database';

async function createTenantUser() {
  console.log('🌱 Creando usuario de inquilino de prueba...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Buscar un inquilino activo
    const inquilinoRes = await client.query(
      `SELECT id, nombre_completo, depto_numero FROM inquilinos WHERE estado = 'activo' LIMIT 1`
    );

    if (inquilinoRes.rows.length === 0) {
      console.log('❌ No se encontró ningún inquilino activo en la base de datos.');
      console.log('ℹ️ Asegúrate de correr los seeds primero.');
      await client.query('ROLLBACK');
      return;
    }

    const inquilino = inquilinoRes.rows[0];
    console.log(`👤 Inquilino activo seleccionado: ${inquilino.nombre_completo} (Depto ${inquilino.depto_numero})`);

    // 2. Hashear la contraseña
    const email = 'inquilino@departamentos.local';
    const password = 'Inquilino2024!';
    const passwordHash = await bcrypt.hash(password, 12);

    // 3. Crear el usuario si no existe
    console.log(`🔑 Creando usuario '${email}'...`);
    const userRes = await client.query(
      `INSERT INTO usuarios (email, password_hash, nombre_completo, rol, activo)
       VALUES ($1, $2, $3, 'inquilino', true)
       ON CONFLICT (email) 
       DO UPDATE SET password_hash = EXCLUDED.password_hash, nombre_completo = EXCLUDED.nombre_completo
       RETURNING id`,
      [email, passwordHash, inquilino.nombre_completo]
    );

    const userId = userRes.rows[0].id;
    console.log(`✅ Usuario creado/actualizado con ID: ${userId}`);

    // 4. Vincular el usuario con el inquilino
    console.log(`🔗 Vinculando el usuario con el inquilino en la base de datos...`);
    await client.query(
      `UPDATE inquilinos SET usuario_id = $1 WHERE id = $2`,
      [userId, inquilino.id]
    );

    await client.query('COMMIT');
    console.log('\n🎉 ¡VINCULACIÓN EXITOSA! 🎉');
    console.log('----------------------------------------------------');
    console.log(`Inquilino:  ${inquilino.nombre_completo}`);
    console.log(`Departamento: ${inquilino.depto_numero}`);
    console.log(`Email:      ${email}`);
    console.log(`Contraseña: ${password}`);
    console.log('----------------------------------------------------');
    console.log('Ya puedes iniciar sesión en la aplicación móvil con estas credenciales.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error al crear/vincular el usuario de inquilino:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

createTenantUser();

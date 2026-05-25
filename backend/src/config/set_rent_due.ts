import 'dotenv/config';
import { pool } from './database';

async function setRentDue() {
  console.log('🌱 Configurando la renta de Valeria Irene Ortiz Villalobos como DEBIDA...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener el ID de Valeria Irene Ortiz Villalobos
    const inqRes = await client.query(
      `SELECT id, nombre_completo, depto_numero FROM inquilinos 
       WHERE nombre_completo ILIKE '%Valeria Irene Ortiz%' LIMIT 1`
    );

    if (inqRes.rows.length === 0) {
      console.log('❌ No se encontró al inquilino Valeria Irene Ortiz Villalobos.');
      await client.query('ROLLBACK');
      return;
    }

    const Valeria = inqRes.rows[0];
    console.log(`👤 Inquilino encontrado: ${Valeria.nombre_completo} (Depto ${Valeria.depto_numero})`);

    // 2. Determinar periodo actual (YYYY-MM)
    const now = new Date();
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    console.log(`📅 Periodo actual: ${periodo}`);

    // 3. Eliminar cualquier registro de pago para este periodo para que deba la renta
    console.log(`🗑️ Eliminando registros de pago para el periodo ${periodo}...`);
    const deleteRes = await client.query(
      `DELETE FROM pagos WHERE inquilino_id = $1 AND periodo = $2 RETURNING *`,
      [Valeria.id, periodo]
    );

    if (deleteRes.rows.length > 0) {
      console.log(`✅ Se eliminó un registro de pago anterior que estaba confirmado/pendiente.`);
    } else {
      console.log(`ℹ️ No había ningún registro de pago para este mes, por lo que ya debía la renta.`);
    }

    // 4. (Opcional) Podemos también resetear las cuotas extras a 'pendiente' si las hubiera, para que deba todo.
    console.log(`⚙️ Asegurando que las cuotas extras del mes estén pendientes...`);
    await client.query(
      `UPDATE cuotas_extra SET estado = 'pendiente', pagado_en = NULL 
       WHERE inquilino_id = $1`,
      [Valeria.id]
    );

    await client.query('COMMIT');
    console.log(`\n🎉 Renta de Valeria Irene Ortiz restablecida exitosamente.`);
    console.log(`Ahora, cuando inicie sesión en la app, verá su pago del mes de ${new Date().toLocaleDateString('es-MX', { month: 'long' })} como PENDIENTE de pago.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error al actualizar el estado de la renta:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

setRentDue();

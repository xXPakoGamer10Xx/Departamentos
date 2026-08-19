import cron from 'node-cron';
import { pool } from '../config/database';
import { createAndSendNotification } from './push.service';

function parseDiaPago(fechaPago: string): number | null {
  const match = fechaPago.match(/^(\d{1,2})/);
  return match ? parseInt(match[1], 10) : null;
}

function diasHastaFecha(targetDay: number): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();
  let target = new Date(anio, mes, targetDay);
  if (target < hoy) {
    target = new Date(anio, mes + 1, targetDay);
  }
  const diff = Math.round((target.getTime() - hoy.getTime()) / 86400000);
  return diff;
}

async function yaNotificadoHoy(usuarioId: string, tipo: string, subKey: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM notificaciones
     WHERE usuario_id = $1 AND tipo = $2 AND mensaje LIKE $3
       AND DATE(created_at) = CURRENT_DATE
     LIMIT 1`,
    [usuarioId, tipo, `%${subKey}%`]
  );
  return (res.rowCount ?? 0) > 0;
}

async function checkRentaReminders(): Promise<void> {
  try {
    const { rows: inquilinos } = await pool.query(
      `SELECT i.id, i.usuario_id, i.fecha_pago, i.nombre_completo, i.depto_numero, i.admin_id
       FROM inquilinos i
       WHERE i.estado = 'activo'`
    );

    const diasObjetivo = [7, 3, 2, 1, 0];

    for (const inq of inquilinos) {
      const diaPago = parseDiaPago(inq.fecha_pago);
      if (!diaPago) continue;

      const diasRestantes = diasHastaFecha(diaPago);
      if (!diasObjetivo.includes(diasRestantes)) continue;

      const subKey = `pago_dia_${diaPago}_dias_${diasRestantes}`;

      // Notificación al inquilino
      if (inq.usuario_id && !(await yaNotificadoHoy(inq.usuario_id, 'renta', subKey))) {
        const titulo = diasRestantes === 0 ? '🔔 Hoy es tu día de pago' : '📅 Recordatorio de pago';
        const msg = diasRestantes === 0
          ? `Hoy es tu día de pago — Recuerda pagar tu renta del depto ${inq.depto_numero}`
          : diasRestantes === 1
            ? `Tu pago de renta vence mañana — Depto ${inq.depto_numero}`
            : `Tu pago de renta vence en ${diasRestantes} días — Depto ${inq.depto_numero}`;
        await createAndSendNotification(inq.usuario_id, titulo, msg, 'renta');
      }

      // Notificación al admin
      if (inq.admin_id && !(await yaNotificadoHoy(inq.admin_id, 'renta', `admin_${subKey}_${inq.id}`))) {
        const adminMsg = diasRestantes === 0
          ? `Hoy vence el pago de ${inq.nombre_completo} (Depto ${inq.depto_numero})`
          : diasRestantes === 1
            ? `Mañana vence el pago de ${inq.nombre_completo} (Depto ${inq.depto_numero})`
            : `En ${diasRestantes} días vence el pago de ${inq.nombre_completo} (Depto ${inq.depto_numero})`;
        await createAndSendNotification(inq.admin_id, '💰 Vencimiento de renta próximo', adminMsg, 'renta');
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error en checkRentaReminders:', err);
  }
}

async function checkContratoExpiration(): Promise<void> {
  try {
    const diasObjetivo = [30, 7, 1];
    const maxDias = Math.max(...diasObjetivo);

    const { rows: inquilinos } = await pool.query(
      `SELECT i.id, i.usuario_id, i.fecha_termino, i.nombre_completo, i.depto_numero, i.admin_id
       FROM inquilinos i
       WHERE i.estado = 'activo'
         AND i.fecha_termino <= CURRENT_DATE + INTERVAL '${maxDias + 1} days'
         AND i.fecha_termino >= CURRENT_DATE`
    );

    for (const inq of inquilinos) {
      const fechaTermino = new Date(inq.fecha_termino);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const diasRestantes = Math.round((fechaTermino.getTime() - hoy.getTime()) / 86400000);

      if (!diasObjetivo.includes(diasRestantes)) continue;

      const subKey = `contrato_${inq.id}_dias_${diasRestantes}`;

      if (inq.usuario_id && !(await yaNotificadoHoy(inq.usuario_id, 'renta', subKey))) {
        const msg = diasRestantes === 1
          ? `Tu contrato vence mañana — Depto ${inq.depto_numero}`
          : `Tu contrato vence en ${diasRestantes} días — Depto ${inq.depto_numero}`;
        await createAndSendNotification(inq.usuario_id, '📋 Tu contrato está por vencer', msg, 'renta');
      }

      if (inq.admin_id && !(await yaNotificadoHoy(inq.admin_id, 'renta', `admin_${subKey}`))) {
        const adminMsg = diasRestantes === 1
          ? `El contrato de ${inq.nombre_completo} (Depto ${inq.depto_numero}) vence mañana`
          : `El contrato de ${inq.nombre_completo} (Depto ${inq.depto_numero}) vence en ${diasRestantes} días`;
        await createAndSendNotification(inq.admin_id, '📋 Contrato por vencer', adminMsg, 'renta');
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error en checkContratoExpiration:', err);
  }
}

async function checkDepositoReminders(): Promise<void> {
  try {
    const diasObjetivo = [3, 1, 0];

    const { rows: inquilinos } = await pool.query(
      `SELECT i.id, i.usuario_id, i.deposito_fechas, i.nombre_completo, i.depto_numero, i.admin_id
       FROM inquilinos i
       WHERE i.estado = 'activo'`
    );

    for (const inq of inquilinos) {
      if (!inq.deposito_fechas || !Array.isArray(inq.deposito_fechas)) continue;
      
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      for (const fechaStr of inq.deposito_fechas) {
        if (typeof fechaStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) continue;

        const targetDate = new Date(fechaStr + 'T12:00:00');
        targetDate.setHours(0, 0, 0, 0);

        const diasRestantes = Math.round((targetDate.getTime() - hoy.getTime()) / 86400000);

        if (!diasObjetivo.includes(diasRestantes)) continue;

        const subKey = `deposito_${inq.id}_${fechaStr}_dias_${diasRestantes}`;

        // Notificación al inquilino
        if (inq.usuario_id && !(await yaNotificadoHoy(inq.usuario_id, 'renta', subKey))) {
          const titulo = diasRestantes === 0 ? '🔔 Hoy es el pago de tu depósito diferido' : '📅 Recordatorio de depósito diferido';
          const msg = diasRestantes === 0
            ? `Hoy vence el pago de tu depósito diferido — Depto ${inq.depto_numero}`
            : diasRestantes === 1
              ? `Tu pago de depósito diferido vence mañana — Depto ${inq.depto_numero}`
              : `Tu pago de depósito diferido vence en ${diasRestantes} días — Depto ${inq.depto_numero}`;
          await createAndSendNotification(inq.usuario_id, titulo, msg, 'renta');
        }

        // Notificación al admin
        if (inq.admin_id && !(await yaNotificadoHoy(inq.admin_id, 'renta', `admin_${subKey}`))) {
          const adminMsg = diasRestantes === 0
            ? `Hoy vence el depósito diferido de ${inq.nombre_completo} (Depto ${inq.depto_numero})`
            : diasRestantes === 1
              ? `Mañana vence el depósito diferido de ${inq.nombre_completo} (Depto ${inq.depto_numero})`
              : `En ${diasRestantes} días vence el depósito diferido de ${inq.nombre_completo} (Depto ${inq.depto_numero})`;
          await createAndSendNotification(inq.admin_id, '💰 Vencimiento de depósito próximo', adminMsg, 'renta');
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error en checkDepositoReminders:', err);
  }
}

async function checkPromesaPagoReminders(): Promise<void> {
  try {
    const diasObjetivo = [1, 0];

    const { rows: pagos } = await pool.query(
      `SELECT p.id, p.fecha_promesa, p.periodo, i.admin_id, i.nombre_completo, i.depto_numero
       FROM pagos p JOIN inquilinos i ON i.id = p.inquilino_id
       WHERE p.confirmado = false AND p.fecha_promesa IS NOT NULL`
    );

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (const pago of pagos) {
      if (!pago.admin_id) continue;

      const fechaIso = pago.fecha_promesa instanceof Date
        ? pago.fecha_promesa.toISOString().slice(0, 10)
        : String(pago.fecha_promesa).slice(0, 10);
      const targetDate = new Date(`${fechaIso}T12:00:00`);
      targetDate.setHours(0, 0, 0, 0);

      const diasRestantes = Math.round((targetDate.getTime() - hoy.getTime()) / 86400000);
      if (!diasObjetivo.includes(diasRestantes)) continue;

      const subKey = `promesa_${pago.id}_dias_${diasRestantes}`;
      if (await yaNotificadoHoy(pago.admin_id, 'promesa', subKey)) continue;

      const titulo = diasRestantes === 0 ? '🤝 Hoy prometió pagar' : '🤝 Recordatorio de promesa de pago';
      const msg = diasRestantes === 0
        ? `Hoy es la fecha en que ${pago.nombre_completo} (Depto ${pago.depto_numero}) dijo que pagaría ${pago.periodo}`
        : `Mañana es la fecha en que ${pago.nombre_completo} (Depto ${pago.depto_numero}) dijo que pagaría ${pago.periodo}`;
      await createAndSendNotification(pago.admin_id, titulo, msg, 'promesa');
    }
  } catch (err) {
    console.error('[Scheduler] Error en checkPromesaPagoReminders:', err);
  }
}

export function initScheduler(): void {
  // Ejecutar todos los días a las 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[Scheduler] Ejecutando recordatorios de pago y contratos...');
    await Promise.all([checkRentaReminders(), checkContratoExpiration(), checkDepositoReminders(), checkPromesaPagoReminders()]);
    console.log('[Scheduler] Recordatorios enviados.');
  }, { timezone: 'America/Mexico_City' });

  console.log('✅ Scheduler de notificaciones configurado (diario 9:00 AM)');
}

import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { pool } from './database';

const execAsync = promisify(exec);

export async function runBackup(): Promise<{ archivo: string; tamano: number }> {
  const backupDir = process.env.BACKUP_DIR || './backups';

  // Crear directorio si no existe
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}.sql`;
  const filepath = path.join(backupDir, filename);

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'departamentos';
  const user = process.env.DB_USER || 'depas_user';
  const password = process.env.DB_PASSWORD || '';

  const env = { ...process.env, PGPASSWORD: password };
  const cmd = `pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} -F p -f "${filepath}"`;

  await execAsync(cmd, { env });

  const stats = fs.statSync(filepath);

  // Registrar en la base de datos
  await pool.query(
    `INSERT INTO backups (archivo, tamano_bytes, tipo, estado)
     VALUES ($1, $2, 'automatico', 'completado')`,
    [filename, stats.size]
  );

  // Limpiar backups con más de 30 días
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const files = fs.readdirSync(backupDir);
  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    const filePath = path.join(backupDir, file);
    const fileStat = fs.statSync(filePath);
    if (fileStat.mtime < cutoffDate) {
      fs.unlinkSync(filePath);
    }
  }

  console.log(`✅ Backup completado: ${filename} (${stats.size} bytes)`);
  return { archivo: filename, tamano: stats.size };
}

export function initBackupCron(): void {
  const cronExpression = process.env.BACKUP_CRON || '0 4 * * *'; // 4:00 AM

  cron.schedule(cronExpression, async () => {
    console.log(`🗄️  Iniciando backup automático (${new Date().toISOString()})...`);
    try {
      await runBackup();
    } catch (err) {
      console.error('❌ Error en backup automático:', err);
      // Registrar fallo en la DB
      await pool.query(
        `INSERT INTO backups (archivo, tamano_bytes, tipo, estado)
         VALUES ($1, 0, 'automatico', 'fallido')`,
        [`backup_fallido_${new Date().toISOString()}.sql`]
      );
    }
  }, {
    timezone: 'America/Mexico_City',
  });

  console.log(`⏰ Backup automático programado: ${cronExpression} (Hora CDMX)`);
}

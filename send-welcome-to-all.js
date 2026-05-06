import 'dotenv/config';
import db from '../backend/config/database.js';
import { sendWelcomeEmail } from './services/email/emailService.js';

const main = async () => {
    try {
        const result = await db.query(`SELECT name, email FROM users WHERE email IS NOT NULL AND (status = 'ativo' OR status = 'active' OR status IS NULL)`);
        const users = result.recordset || result.rows || [];
        console.log(`Encontrados ${users.length} usuários para envio.`);
        for (const user of users) {
            if (!user.email) continue;
            try {
                await sendWelcomeEmail({ nome: user.name, email: user.email });
                console.log(`[OK] E-mail enviado para: ${user.name} <${user.email}>`);
            } catch (err) {
                console.error(`[ERRO] Falha ao enviar para: ${user.name} <${user.email}>`, err);
            }
        }
        console.log('Processo concluído.');
    } catch (err) {
        console.error('Erro ao buscar usuários:', err);
    } finally {
        if (db.close) db.close();
    }
};

main();

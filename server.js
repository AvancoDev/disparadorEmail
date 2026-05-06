import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sendWelcomeEmail } from './services/email/emailService.js';
import db from './config/database.js';

const app = express();
const PORT = 5407;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Retorna lista de usuários ativos com e-mail
app.get('/api/usuarios', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT usuario_id AS id, nome AS name, email
       FROM usuarios_v2
       WHERE ativo = 1 AND email IS NOT NULL AND email <> ''
       ORDER BY nome`
    );
    res.json({ success: true, usuarios: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Dispara e-mail de boas-vindas para usuários selecionados (ou todos se nenhum ID enviado)
app.post('/api/disparar-bemvindo', async (req, res) => {
  try {
    const { userIds } = req.body || {};
    let query =
      `SELECT usuario_id AS id, nome AS name, email
       FROM usuarios_v2
       WHERE ativo = 1 AND email IS NOT NULL AND email <> ''`;
    if (Array.isArray(userIds) && userIds.length > 0) {
      const ids = userIds.map(id => parseInt(id, 10)).filter(Number.isFinite);
      query += ` AND usuario_id IN (${ids.join(',')})`;
    }
    const result = await db.query(query);
    const users = result.recordset || [];
    let successCount = 0;
    let failCount = 0;
    for (const user of users) {
      try {
        await sendWelcomeEmail({ nome: user.name, email: user.email });
        successCount++;
      } catch (err) {
        failCount++;
      }
    }
    res.json({ success: true, enviados: successCount, falhas: failCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor do disparador rodando em http://localhost:${PORT}`);
});


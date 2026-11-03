import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sendWelcomeEmail, sendTemplateEmail, getTemplatesList, readTemplateHtml, deleteTemplate, createNewsletterTemplate } from './services/email/emailService.js';
import db from './config/database.js';

const app = express();
const PORT = 5407;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
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

// Lista os templates disponíveis
app.get('/api/templates', (req, res) => {
  res.json({ success: true, templates: getTemplatesList() });
});

// Cria um novo template de newsletter
app.post('/api/template/newsletter', (req, res) => {
  try {
    const { title, subject, baseHtml } = req.body || {};
    const created = createNewsletterTemplate({ title, subject, baseHtml });
    res.status(201).json({ success: true, template: created });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Retorna o HTML bruto de um template (suporta IDs com subcategoria: csc/nomeTemplate)
app.get('/api/template/*', (req, res) => {
  try {
    const templateId = req.params[0];
    const html = readTemplateHtml(templateId);
    res.json({ success: true, html });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

// Dispara um template (padrão ou editado) para os usuários selecionados
app.post('/api/disparar', async (req, res) => {
  try {
    const { userIds, templateId, customHtml, subject } = req.body || {};

    // Valida assunto
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Assunto é obrigatório.' });
    }

    // Determina o HTML base
    let baseHtml;
    if (customHtml && typeof customHtml === 'string' && customHtml.trim()) {
      baseHtml = customHtml;
    } else if (templateId) {
      baseHtml = readTemplateHtml(templateId);
    } else {
      return res.status(400).json({ success: false, message: 'Informe templateId ou customHtml.' });
    }

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
        await sendTemplateEmail({ nome: user.name, email: user.email, subject: subject.trim(), html: baseHtml });
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

// Remove um template de newsletter
app.delete('/api/template/*', (req, res) => {
  try {
    const templateId = req.params[0];
    deleteTemplate(templateId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor do disparador rodando em http://localhost:${PORT}`);
});

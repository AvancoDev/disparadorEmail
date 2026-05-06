import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.OFFICE365_USER,
    pass: process.env.OFFICE365_PASS
  }
});

async function sendTestEmail(destino) {
  const templatePath = path.join(__dirname, 'services', 'email', 'templates', 'testeEmail.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  const mailOptions = {
    from: process.env.OFFICE365_USER,
    to: destino,
    subject: 'Teste de Disparo Automático',
    html
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`[SUCESSO] E-mail de teste enviado para ${destino}`);
  } catch (error) {
    console.error(`[ERRO] Falha ao enviar e-mail de teste para ${destino}:`, error);
  }
}

// Altere o e-mail abaixo para o destinatário de teste
const emailTeste = process.env.TEST_EMAIL || 'seu.email@dominio.com';
sendTestEmail(emailTeste);

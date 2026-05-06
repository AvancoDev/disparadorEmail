import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendWelcomeEmail({ nome, email }) {
    const templatePath = path.join(__dirname, 'templates', 'welcomeEmail.html');
    let html = fs.readFileSync(templatePath, 'utf8');
    html = html.replace(/{{NOME}}/g, nome);

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Bem-vindo ao Portal CSC - Avanço S/A',
        html,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[SUCESSO] E-mail enviado para ${email}`);
}

export { sendWelcomeEmail };

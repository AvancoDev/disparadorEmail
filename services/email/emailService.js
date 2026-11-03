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
    const templatePath = path.join(__dirname, 'templates', 'csc', 'welcomeEmail.html');
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

/**
 * Extrai imagens base64 do HTML, substitui por referências CID e retorna os attachments.
 * Necessário para compatibilidade com Outlook e clientes corporativos que bloqueiam data URLs.
 * @param {string} html
 * @returns {{ html: string, attachments: object[] }}
 */
function extractBase64Images(html) {
    const attachments = [];
    let index = 0;
    const modifiedHtml = html.replace(/src="(data:(image\/[^;]+);base64,([^"]+))"/g, (_match, _dataUrl, mimeType, base64Data) => {
        const cid = `img_inline_${index++}`;
        const ext = mimeType.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
        attachments.push({
            filename: `${cid}.${ext}`,
            cid,
            content: base64Data,
            encoding: 'base64',
            contentType: mimeType,
        });
        return `src="cid:${cid}"`;
    });
    return { html: modifiedHtml, attachments };
}

/**
 * Envia um e-mail usando um template ou HTML customizado.
 * @param {object} opts
 * @param {string} opts.nome - Nome do destinatário (substitui {{NOME}})
 * @param {string} opts.email - E-mail do destinatário
 * @param {string} opts.subject - Assunto do e-mail
 * @param {string} opts.html - HTML já pronto para envio (com {{NOME}} já substituído ou não)
 */
async function sendTemplateEmail({ nome, email, subject, html }) {
    const processedHtml = html.replace(/{{NOME}}/g, nome);
    const { html: finalHtml, attachments } = extractBase64Images(processedHtml);

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,
        html: finalHtml,
        attachments,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[SUCESSO] E-mail "${subject}" enviado para ${email}`);
}

/**
 * Converte o nome do arquivo de newsletter em um label legível.
 * Exemplos:
 *   newsletter-22-05-2026.html → "Newsletter – 22/05/2026"
 *   newsletter22052026.html    → "Newsletter – 22/05/2026"
 *   newsletterMaio2026.html    → "Newsletter – Maio 2026"
 */
function formatNewsletterLabel(filename) {
    let name = filename.replace(/\.html$/i, '');
    name = name.replace(/^newsletter[-_]?/i, '');

    // DD-MM-YYYY ou DD_MM_YYYY
    if (/^\d{2}[-_]\d{2}[-_]\d{4}$/.test(name)) {
        return 'Newsletter – ' + name.replace(/[-_]/g, '/');
    }
    // DDMMYYYY
    if (/^\d{8}$/.test(name)) {
        return `Newsletter – ${name.slice(0, 2)}/${name.slice(2, 4)}/${name.slice(4)}`;
    }
    // CamelCase ou texto livre
    name = name.replace(/[-_]/g, ' ').trim();
    name = name.replace(/([a-záéíóúàâêôãõç])([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ])/g, '$1 $2');
    return 'Newsletter – ' + name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Retorna os templates disponíveis com seus metadados, agrupados por categoria.
 * Newsletters são descobertas automaticamente em templates/csc/newsletters/.
 */
function getTemplatesList() {
    const templates = [
        {
            id: 'csc/welcomeEmail',
            category: 'Portal CSC',
            label: 'Boas-vindas ao Portal CSC',
            subject: 'Bem-vindo ao Portal CSC - Avanço S/A',
            description: 'E-mail de boas-vindas enviado a novos usuários do Portal CSC.',
        },
    ];

    const newslettersDir = path.join(__dirname, 'templates', 'csc', 'newsletters');
    if (fs.existsSync(newslettersDir)) {
        const files = fs.readdirSync(newslettersDir)
            .filter(f => f.toLowerCase().endsWith('.html'))
            .sort()
            .reverse(); // mais recente primeiro

        for (const file of files) {
            const label = formatNewsletterLabel(file);
            const dateMatch = label.match(/(\d{2}\/\d{2}\/\d{4})/);
            const subject = dateMatch
                ? `Portal CSC – Newsletter ${dateMatch[1]}`
                : `Portal CSC – ${label.replace('Newsletter – ', '')}`;

            templates.push({
                id: `csc/newsletters/${file.replace(/\.html$/i, '')}`,
                category: 'Newsletters – Portal CSC',
                label,
                subject,
                description: `Newsletter do Portal CSC · ${label.replace('Newsletter – ', '')}`,
            });
        }
    }

    return templates;
}

/**
 * Lê o HTML bruto de um template pelo id (suporta subcategoria: "csc/welcomeEmail").
 * Qualquer arquivo dentro de templates/ é permitido; path traversal é bloqueado.
 * @param {string} templateId
 * @returns {string} conteúdo HTML
 */
function readTemplateHtml(templateId) {
    const normalized = templateId.replace(/\\/g, '/');
    if (normalized.includes('..') || /[<>:"|?*]/.test(normalized)) {
        throw new Error('Template inválido');
    }

    const templatesBase = path.resolve(__dirname, 'templates');
    const templatePath = path.resolve(templatesBase, `${normalized}.html`);

    if (!templatePath.startsWith(templatesBase + path.sep)) {
        throw new Error('Template não encontrado');
    }
    if (!fs.existsSync(templatePath)) {
        throw new Error('Template não encontrado');
    }

    return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Remove um arquivo de newsletter da pasta newsletters.
 * Só permite excluir arquivos dentro de csc/newsletters/.
 * @param {string} templateId
 */
function deleteTemplate(templateId) {
    const normalized = templateId.replace(/\\/g, '/');
    if (normalized.includes('..') || /[<>:"|?*]/.test(normalized)) {
        throw new Error('Template inválido');
    }
    if (!normalized.startsWith('csc/newsletters/')) {
        throw new Error('Apenas newsletters podem ser removidas');
    }

    const templatesBase = path.resolve(__dirname, 'templates');
    const templatePath = path.resolve(templatesBase, `${normalized}.html`);

    if (!templatePath.startsWith(templatesBase + path.sep)) {
        throw new Error('Template inválido');
    }
    if (!fs.existsSync(templatePath)) {
        throw new Error('Template não encontrado');
    }

    fs.unlinkSync(templatePath);
}

function slugifyNewsletterName(name) {
    return (name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function buildNewsletterStarterHtml(title) {
    const safeTitle = (title || 'Nova Newsletter').replace(/[<>]/g, '').trim() || 'Nova Newsletter';
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
    <style>
        body { margin: 0; padding: 0; background: #f5f5f5; font-family: Arial, sans-serif; color: #1f2937; }
        .container { max-width: 640px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; }
        .header { background: #003f8a; color: #ffffff; padding: 28px 24px; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 28px 24px; line-height: 1.6; font-size: 14px; }
        .imagem-placeholder { margin: 18px 0; padding: 32px; border: 2px dashed #93c5fd; border-radius: 6px; text-align: center; color: #1d4ed8; background: #eff6ff; }
        .footer { padding: 18px 24px; background: #f8fafc; color: #64748b; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${safeTitle}</h1>
        </div>
        <div class="content">
            <p>Olá <strong>{{NOME}}</strong>,</p>
            <p>Escreva aqui o conteúdo principal da newsletter.</p>
            <div class="imagem-placeholder">Clique no preview para inserir imagem</div>
            <p>Adicione aqui os destaques, links e chamadas para ação.</p>
        </div>
        <div class="footer">
            Portal CSC - Avanço S/A
        </div>
    </div>
</body>
</html>`;
}

/**
 * Cria um novo template de newsletter em templates/csc/newsletters/.
 * @param {object} opts
 * @param {string} opts.title - Título exibido da newsletter
 * @param {string} [opts.subject] - Assunto padrão (opcional)
 * @param {string} [opts.baseHtml] - HTML base (opcional)
 * @returns {{ id: string, filename: string, subject: string, title: string }}
 */
function createNewsletterTemplate({ title, subject, baseHtml }) {
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) {
        throw new Error('Título da newsletter é obrigatório');
    }

    const slug = slugifyNewsletterName(cleanTitle);
    if (!slug) {
        throw new Error('Título inválido para criar o template');
    }

    const newslettersDir = path.resolve(__dirname, 'templates', 'csc', 'newsletters');
    if (!fs.existsSync(newslettersDir)) {
        fs.mkdirSync(newslettersDir, { recursive: true });
    }

    const filename = `${slug}.html`;
    const filePath = path.resolve(newslettersDir, filename);
    if (!filePath.startsWith(newslettersDir + path.sep)) {
        throw new Error('Nome de arquivo inválido');
    }
    if (fs.existsSync(filePath)) {
        throw new Error('Já existe uma newsletter com esse nome');
    }

    const html = (typeof baseHtml === 'string' && baseHtml.trim())
        ? baseHtml
        : buildNewsletterStarterHtml(cleanTitle);

    fs.writeFileSync(filePath, html, 'utf8');

    return {
        id: `csc/newsletters/${slug}`,
        filename,
        title: cleanTitle,
        subject: (subject || '').trim() || `Portal CSC - ${cleanTitle}`,
    };
}

export { sendWelcomeEmail, sendTemplateEmail, getTemplatesList, readTemplateHtml, deleteTemplate, createNewsletterTemplate };

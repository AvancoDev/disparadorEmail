import sql from 'mssql';
import 'dotenv/config';

// Suporte a instância nomeada (ex: SERVER\SQLEXPRESS) — usa porta 1433 diretamente
// pois o SQL Server Browser (porta UDP 1434) pode estar indisponível
const serverRaw = process.env.DB_SERVER || '';
const serverHost = serverRaw.includes('\\') ? serverRaw.split('\\')[0] : serverRaw;

const config = {
  server: serverHost,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'master',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

async function query(queryString) {
  const p = await getPool();
  return p.request().query(queryString);
}

export default { query, sql };

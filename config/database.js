import sql from 'mssql';
import 'dotenv/config';

const config = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'master',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: undefined,
  },
  port: 1433,
};

// Suporte a instância nomeada (ex: SERVER\SQLEXPRESS)
if (config.server && config.server.includes('\\')) {
  const parts = config.server.split('\\');
  config.server = parts[0];
  config.options.instanceName = parts[1];
  delete config.port;
}

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

import sql from 'mssql';
const cfg = { server: 'NTB-AVAN-086', user: 'sa', password: 'A@avanco1212', database: 'portal_csc_v2', options: { encrypt: false, trustServerCertificate: true, instanceName: 'SQLEXPRESS' } };
const pool = await new sql.ConnectionPool(cfg).connect();
const r = await pool.request().query("SELECT COUNT(*) as total FROM usuarios_v2 WHERE ativo=1 AND email IS NOT NULL AND email<>''");
console.log(r.recordset[0].total + ' usuarios ativos com email');
const sample = await pool.request().query("SELECT TOP 3 nome, email FROM usuarios_v2 WHERE ativo=1 AND email IS NOT NULL AND email<>''");
console.log(JSON.stringify(sample.recordset));
await pool.close();

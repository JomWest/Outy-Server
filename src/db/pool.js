const useWindowsAuth = (process.env.SQLSERVER_AUTH || '').toLowerCase() === 'windows';
const sql = useWindowsAuth ? require('mssql/msnodesqlv8') : require('mssql');

const baseOptions = {
  encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
  trustServerCertificate: process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE === 'true',
  enableArithAbort: true,
};

const poolCfg = { max: 15, min: 1, idleTimeoutMillis: 30000 };

const config = useWindowsAuth
  ? {
      driver: 'msnodesqlv8',
      connectionString:
        `Driver={ODBC Driver 17 for SQL Server};Server=${process.env.SQLSERVER_SERVER};Database=${process.env.SQLSERVER_DATABASE};Trusted_Connection=Yes;`,
      options: baseOptions,
      pool: poolCfg,
    }
  : {
      server: process.env.SQLSERVER_SERVER || 'localhost',
      database: process.env.SQLSERVER_DATABASE,
      user: process.env.SQLSERVER_USER,
      password: process.env.SQLSERVER_PASSWORD,
      options: baseOptions,
      pool: poolCfg,
    };

let poolPromise;

async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then(pool => {
        console.log('Connected to SQL Server', useWindowsAuth ? '(Windows Auth)' : '(SQL Login)');
        return pool;
      })
      .catch(err => {
        console.error('SQL Server connection error:', err);
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
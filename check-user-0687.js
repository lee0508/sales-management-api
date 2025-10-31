const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || 1433),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
  }
};

(async () => {
  try {
    await sql.connect(config);
    console.log('✅ DB 연결 성공');

    const result = await sql.query`SELECT 사용자코드, 사용자명 FROM 사용자 WHERE 사용자코드 = '0687'`;
    console.log('사용자 0687 정보:', result.recordset);

    // 모든 사용자 확인
    const allUsers = await sql.query`SELECT 사용자코드, 사용자명 FROM 사용자 WHERE 사용구분 = 0 ORDER BY 사용자코드`;
    console.log('\n전체 사용자 목록:');
    allUsers.recordset.forEach(user => {
      console.log(`  ${user.사용자코드}: ${user.사용자명}`);
    });

    await sql.close();
  } catch (err) {
    console.error('❌ 에러:', err.message);
  }
})();

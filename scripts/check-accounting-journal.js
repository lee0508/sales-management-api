const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

async function checkTable() {
  try {
    console.log('🔌 SQL Server 연결 중...');
    const pool = await sql.connect(config);

    // 테이블 구조 확인
    const result = await pool.request().query(`
      SELECT
        COLUMN_NAME as 컬럼명,
        DATA_TYPE as 타입,
        CHARACTER_MAXIMUM_LENGTH as 길이,
        IS_NULLABLE as NULL허용,
        COLUMN_DEFAULT as 기본값
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '회계전표내역'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('📋 회계전표내역 테이블 구조:');
    console.table(result.recordset);

    // 데이터 확인
    const count = await pool.request().query('SELECT COUNT(*) as cnt FROM 회계전표내역');
    console.log('\n📊 현재 데이터 건수:', count.recordset[0].cnt);

    // 인덱스 확인
    const indexes = await pool.request().query(`
      SELECT
        i.name as 인덱스명,
        c.name as 컬럼명,
        i.is_primary_key as PK여부,
        i.is_unique as 유일여부
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('dbo.회계전표내역')
      ORDER BY i.name, ic.index_column_id
    `);

    console.log('\n📊 인덱스 목록:');
    console.table(indexes.recordset);

    await pool.close();
    console.log('\n✅ 확인 완료');
  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
    process.exit(1);
  }
}

checkTable();

const sql = require('mssql');
require('dotenv').config();

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

async function checkMaterialFK() {
  try {
    await sql.connect(config);

    // 자재 존재 여부 확인
    const result = await sql.query`
      SELECT * FROM 자재
      WHERE 분류코드 = 'CO' AND 세부코드 LIKE '%DE40832%'
    `;

    console.log('===== 자재 테이블 조회 결과 =====');
    console.log(JSON.stringify(result.recordset, null, 2));

    // 자재원장 FK 확인
    const fkResult = await sql.query`
      SELECT
        fk.name AS FK_Name,
        OBJECT_NAME(fk.parent_object_id) AS Table_Name,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Column_Name,
        OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS Referenced_Column
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fkc
        ON fk.object_id = fkc.constraint_object_id
      WHERE fk.name = 'FK_자재원장_자재'
      ORDER BY fkc.constraint_column_id
    `;

    console.log('\n===== FK_자재원장_자재 제약조건 =====');
    console.log(JSON.stringify(fkResult.recordset, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.close();
  }
}

checkMaterialFK();

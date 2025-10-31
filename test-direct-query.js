require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

async function testQuery() {
  try {
    const pool = await sql.connect(config);

    console.log('Testing exact query from file:\n');
    
    const result = await pool.request().query(`
      SELECT [사업장코드]
            ,[분류코드]
            ,[세부코드]
            ,[입출고구분]
            ,[입출고일자]
            ,[입출고시간]
            ,[입고수량]
            ,[입고단가]
            ,[입고부가]
            ,[출고수량]
            ,[출고단가]
            ,[출고부가]
            ,[매입처코드]
            ,[매출처코드]
            ,[원래입출고일자]
            ,[직송구분]
            ,[발견일자]
            ,[발견번호]
            ,[거래일자]
            ,[거래번호]
            ,[계산서발행여부]
            ,[현금구분]
            ,[감가구분]
            ,[적요]
            ,[작성년도]
            ,[책번호]
            ,[일련번호]
            ,[사용구분]
            ,[수정일자]
            ,[사용자코드]
            ,[재고이동사업장코드]
        FROM [YmhDB].[dbo].[자재입출내역]
        WHERE [거래일자] = '20251031'
    `);
    
    console.log(`Found ${result.recordset.length} records`);
    if (result.recordset.length > 0) {
      console.log('\nFirst record:');
      console.log(result.recordset[0]);
    }

    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testQuery();

const sql = require('mssql');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

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

async function createTable() {
  try {
    console.log('🔌 SQL Server 연결 중...');
    const pool = await sql.connect(config);

    console.log('📋 회계전표내역 테이블 생성 중...');

    // 테이블 생성
    await pool.request().query(`
      CREATE TABLE dbo.회계전표내역
      (
          전표번호        VARCHAR(20)   NOT NULL,
          전표순번        INT           NOT NULL,
          사업장코드      VARCHAR(2)    NOT NULL,
          전표일자        VARCHAR(8)    NOT NULL,
          전표시간        VARCHAR(6)    NULL,

          계정코드        VARCHAR(4)    NOT NULL,
          차대구분        CHAR(1)       NOT NULL,
          금액            MONEY         NOT NULL,

          적요            VARCHAR(200)  NULL,
          참조전표        VARCHAR(20)   NULL,

          작성자코드      VARCHAR(4)    NOT NULL,
          작성일시        DATETIME      NOT NULL DEFAULT GETDATE(),
          수정자코드      VARCHAR(4)    NULL,
          수정일시        DATETIME      NULL,

          사용구분        TINYINT       NOT NULL DEFAULT 0,

          CONSTRAINT PK_회계전표내역 PRIMARY KEY (전표번호, 전표순번)
      );
    `);

    console.log('✅ 회계전표내역 테이블 생성 완료');

    // 인덱스 생성
    console.log('📊 인덱스 생성 중...');

    await pool.request().query(`
      CREATE INDEX IDX_회계전표내역_사업장전표일자
      ON dbo.회계전표내역(사업장코드, 전표일자);
    `);
    console.log('  ✓ 사업장전표일자 인덱스 생성');

    await pool.request().query(`
      CREATE INDEX IDX_회계전표내역_참조전표
      ON dbo.회계전표내역(참조전표);
    `);
    console.log('  ✓ 참조전표 인덱스 생성');

    await pool.request().query(`
      CREATE INDEX IDX_회계전표내역_계정코드
      ON dbo.회계전표내역(계정코드);
    `);
    console.log('  ✓ 계정코드 인덱스 생성');

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

    console.log('\n📋 생성된 테이블 구조:');
    console.table(result.recordset);

    await pool.close();
    console.log('\n✅ 모든 작업이 완료되었습니다.');
  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
    process.exit(1);
  }
}

createTable();

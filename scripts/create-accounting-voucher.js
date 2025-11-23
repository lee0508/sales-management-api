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

async function createTable() {
  try {
    console.log('🔌 SQL Server 연결 중...');
    const pool = await sql.connect(config);

    console.log('📋 회계전표 테이블 생성 중...');

    // 테이블 생성
    await pool.request().query(`
      CREATE TABLE dbo.회계전표
      (
          전표번호        VARCHAR(20)   NOT NULL,   -- 전표 묶음 번호 (예: 20250201-001)
          전표순번        INT           NOT NULL,   -- 같은 전표번호 내에서 1,2,3... 순번
          사업장코드      VARCHAR(2)    NOT NULL,   -- 사업장
          전표일자        VARCHAR(8)    NOT NULL,   -- YYYYMMDD
          전표시간        VARCHAR(6)    NULL,       -- HHMMSS

          계정코드        VARCHAR(4)    NOT NULL,   -- 계정과목 (계정과목 테이블 참조)
          차대구분        CHAR(1)       NOT NULL,   -- D=차변 , C=대변
          금액            MONEY         NOT NULL,   -- 금액(차변/대변 구분은 차대구분으로 판단)

          적요            VARCHAR(200)  NULL,       -- 전표 설명
          참조전표        VARCHAR(20)   NULL,       -- 매입전표번호 / 세금계산서번호 / 출고번호 등 자동전표 연동

          작성자코드      VARCHAR(4)    NOT NULL,
          작성일시        DATETIME      NOT NULL DEFAULT GETDATE(),
          수정자코드      VARCHAR(4)    NULL,
          수정일시        DATETIME      NULL,

          사용구분        TINYINT       NOT NULL DEFAULT 0, -- 0=사용 , 1=미사용

          CONSTRAINT PK_회계전표 PRIMARY KEY (전표번호, 전표순번)
      );
    `);

    console.log('✅ 회계전표 테이블 생성 완료');

    // 인덱스 생성
    console.log('📊 인덱스 생성 중...');

    await pool.request().query(`
      CREATE INDEX IDX_회계전표_사업장전표일자
      ON dbo.회계전표(사업장코드, 전표일자);
    `);
    console.log('  ✓ 사업장전표일자 인덱스 생성');

    await pool.request().query(`
      CREATE INDEX IDX_회계전표_참조전표
      ON dbo.회계전표(참조전표);
    `);
    console.log('  ✓ 참조전표 인덱스 생성');

    await pool.request().query(`
      CREATE INDEX IDX_회계전표_계정코드
      ON dbo.회계전표(계정코드);
    `);
    console.log('  ✓ 계정코드 인덱스 생성');

    await pool.request().query(`
      CREATE INDEX IDX_회계전표_차대구분
      ON dbo.회계전표(차대구분);
    `);
    console.log('  ✓ 차대구분 인덱스 생성');

    // 테이블 구조 확인
    const result = await pool.request().query(`
      SELECT
        COLUMN_NAME as 컬럼명,
        DATA_TYPE as 타입,
        CHARACTER_MAXIMUM_LENGTH as 길이,
        IS_NULLABLE as NULL허용,
        COLUMN_DEFAULT as 기본값
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '회계전표'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\n📋 생성된 테이블 구조:');
    console.table(result.recordset);

    // 샘플 데이터 설명
    console.log('\n📝 자동전표 생성 예시:');
    console.log('═══════════════════════════════════════════════');
    console.log('1️⃣  매입전표 작성 시:');
    console.log('    - 차변: 매입 / 대변: 미지급금');
    console.log('    - 참조전표: "매입-20250201-001"');
    console.log('');
    console.log('2️⃣  거래명세서 작성 시:');
    console.log('    - 차변: 미수금 / 대변: 매출');
    console.log('    - 참조전표: "출고-20250201-001"');
    console.log('');
    console.log('3️⃣  현금출납 등록 시:');
    console.log('    - 입금: 차변: 현금 / 대변: 미수금');
    console.log('    - 출금: 차변: 미지급금 / 대변: 현금');
    console.log('    - 참조전표: "현금-20250201-001"');
    console.log('');
    console.log('4️⃣  세금계산서 작성 시:');
    console.log('    - 차변: 미수금 / 대변: 매출, 부가세예수금');
    console.log('    - 참조전표: "세금-20250201-001"');
    console.log('═══════════════════════════════════════════════');

    await pool.close();
    console.log('\n✅ 모든 작업이 완료되었습니다.');
  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
    if (err.message.includes('already an object')) {
      console.log('\n💡 테이블이 이미 존재합니다. check-accounting-voucher.js로 확인하세요.');
    }
    process.exit(1);
  }
}

createTable();

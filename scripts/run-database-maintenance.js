/**
 * 데이터베이스 유지보수 실행 스크립트
 *
 * 목적: SQL 유지보수 작업을 Node.js에서 실행
 */

require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
  }
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function runMaintenance(taskMode) {
  let pool;

  try {
    console.log('✅ 데이터베이스 연결 중...\n');
    pool = await sql.connect(config);

    console.log('========================================');
    console.log('🔧 데이터베이스 유지보수');
    console.log('========================================\n');

    // 작업 모드에 따라 실행
    if (taskMode === 'all' || taskMode === 'log') {
      await compressLogTable(pool);
    }

    if (taskMode === 'all' || taskMode === 'index') {
      await rebuildIndexes(pool);
    }

    if (taskMode === 'all' || taskMode === 'stats') {
      await updateStatistics(pool);
    }

    if (taskMode === 'all' || taskMode === 'create-index') {
      await createMissingIndexes(pool);
    }

    console.log('\n========================================');
    console.log('✅ 유지보수 완료!');
    console.log('========================================\n');

  } catch (err) {
    console.error('❌ 오류 발생:', err);
  } finally {
    if (pool) {
      await pool.close();
    }
    rl.close();
  }
}

async function compressLogTable(pool) {
  console.log('1️⃣ 로그 테이블 압축\n');

  // 현재 상태 확인
  const beforeQuery = `
    SELECT
      COUNT(*) AS 총레코드수,
      COUNT(CASE WHEN 수정일자 < '20200101' OR 수정일자 = '' OR 수정일자 IS NULL THEN 1 END) AS 삭제대상,
      COUNT(CASE WHEN 수정일자 >= '20200101' THEN 1 END) AS 보존대상
    FROM 로그
  `;

  const before = await pool.request().query(beforeQuery);
  console.log('📊 압축 전 상태:');
  console.table(before.recordset);

  const deleteCount = before.recordset[0].삭제대상;

  if (deleteCount === 0) {
    console.log('✅ 삭제할 레코드가 없습니다.\n');
    return;
  }

  console.log(`⚠️ ${deleteCount.toLocaleString()}건의 로그를 삭제합니다.`);
  const confirm = await question('계속하시겠습니까? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ 작업을 취소했습니다.\n');
    return;
  }

  // 삭제 실행
  const deleteQuery = `
    DELETE FROM 로그
    WHERE 수정일자 < '20200101'
       OR 수정일자 = ''
       OR 수정일자 IS NULL
  `;

  const result = await pool.request().query(deleteQuery);
  console.log(`✅ ${result.rowsAffected[0].toLocaleString()}건 삭제 완료\n`);

  // 압축 후 상태
  const after = await pool.request().query(beforeQuery);
  console.log('📊 압축 후 상태:');
  console.table(after.recordset);
  console.log('');
}

async function rebuildIndexes(pool) {
  console.log('2️⃣ 인덱스 재구성\n');

  const indexQuery = `
    SELECT
      t.name AS 테이블명,
      i.name AS 인덱스명
    FROM
      sys.indexes i
    INNER JOIN
      sys.tables t ON i.object_id = t.object_id
    WHERE
      t.name IN ('자재입출내역', '견적', '견적내역', '발주', '발주내역', '자재', '자재시세', '자재원장')
      AND i.name IS NOT NULL
      AND i.type > 0
  `;

  const indexes = await pool.request().query(indexQuery);

  console.log(`📋 총 ${indexes.recordset.length}개의 인덱스를 재구성합니다.\n`);

  let successCount = 0;
  let failCount = 0;

  for (const idx of indexes.recordset) {
    console.log(`�� 재구성 중: ${idx.테이블명}.${idx.인덱스명}`);

    try {
      await pool.request().query(`
        ALTER INDEX [${idx.인덱스명}] ON [${idx.테이블명}] REBUILD
      `);
      successCount++;
      console.log('   ✅ 완료');
    } catch (err) {
      failCount++;
      console.error(`   ❌ 오류: ${err.message}`);
    }
  }

  console.log(`\n📊 재구성 완료: 성공 ${successCount}개, 실패 ${failCount}개\n`);
}

async function updateStatistics(pool) {
  console.log('3️⃣ 통계 업데이트\n');

  const tables = ['자재입출내역', '견적', '견적내역', '발주', '발주내역', '자재', '자재시세', '자재원장', '로그'];

  console.log(`📋 ${tables.length}개 테이블의 통계를 업데이트합니다.\n`);

  let successCount = 0;
  let failCount = 0;

  for (const tableName of tables) {
    console.log(`📊 통계 업데이트 중: ${tableName}`);

    try {
      await pool.request().query(`UPDATE STATISTICS [${tableName}] WITH FULLSCAN`);
      successCount++;
      console.log('   ✅ 완료');
    } catch (err) {
      failCount++;
      console.error(`   ❌ 오류: ${err.message}`);
    }
  }

  console.log(`\n📊 업데이트 완료: 성공 ${successCount}개, 실패 ${failCount}개\n`);
}

async function createMissingIndexes(pool) {
  console.log('4️⃣ 필수 인덱스 확인 및 생성\n');

  const indexes = [
    {
      table: '자재입출내역',
      name: 'IX_매입처코드',
      sql: `CREATE NONCLUSTERED INDEX IX_매입처코드
            ON 자재입출내역 (사업장코드, 매입처코드, 입출고구분)
            INCLUDE (거래일자, 거래번호, 입고수량, 입고단가, 입고부가)`
    },
    {
      table: '자재입출내역',
      name: 'IX_매출처코드',
      sql: `CREATE NONCLUSTERED INDEX IX_매출처코드
            ON 자재입출내역 (사업장코드, 매출처코드, 입출고구분)
            INCLUDE (거래일자, 거래번호, 출고수량, 출고단가, 출고부가)`
    },
    {
      table: '자재입출내역',
      name: 'IX_자재코드',
      sql: `CREATE NONCLUSTERED INDEX IX_자재코드
            ON 자재입출내역 (분류코드, 세부코드, 사업장코드, 입출고구분)
            INCLUDE (거래일자, 입고수량, 출고수량, 입고단가, 출고단가)`
    },
    {
      table: '견적',
      name: 'IX_견적_매출처코드',
      sql: `CREATE NONCLUSTERED INDEX IX_견적_매출처코드
            ON 견적 (매출처코드, 사업장코드)
            INCLUDE (견적일자, 견적번호, 공급가액, 부가세, 합계금액)`
    },
    {
      table: '발주',
      name: 'IX_발주_매입처코드',
      sql: `CREATE NONCLUSTERED INDEX IX_발주_매입처코드
            ON 발주 (매입처코드, 사업장코드)
            INCLUDE (발주일자, 발주번호, 공급가액, 부가세, 합계금액)`
    }
  ];

  let existingCount = 0;
  let createdCount = 0;
  let failCount = 0;

  for (const idx of indexes) {
    console.log(`🔍 확인 중: ${idx.table}.${idx.name}`);

    const checkQuery = `
      SELECT 1 FROM sys.indexes
      WHERE name = '${idx.name}'
        AND object_id = OBJECT_ID('${idx.table}')
    `;

    const exists = await pool.request().query(checkQuery);

    if (exists.recordset.length > 0) {
      console.log('   ✅ 이미 존재함');
      existingCount++;
    } else {
      console.log('   🔧 생성 중...');
      try {
        await pool.request().query(idx.sql);
        console.log('   ✅ 생성 완료');
        createdCount++;
      } catch (err) {
        console.error(`   ❌ 오류: ${err.message}`);
        failCount++;
      }
    }
  }

  console.log(`\n📊 인덱스 확인 완료: 기존 ${existingCount}개, 생성 ${createdCount}개, 실패 ${failCount}개\n`);
}

// 메인 실행
(async () => {
  console.log('========================================');
  console.log('🔧 데이터베이스 유지보수 도구');
  console.log('========================================\n');

  console.log('작업 선택:');
  console.log('1. 로그 테이블 압축 (5년 이상 데이터 삭제)');
  console.log('2. 인덱스 재구성');
  console.log('3. 통계 업데이트');
  console.log('4. 필수 인덱스 생성');
  console.log('5. 전체 작업 (1+2+3+4)');
  console.log('0. 종료\n');

  const choice = await question('선택 (0-5): ');

  const taskMap = {
    '1': 'log',
    '2': 'index',
    '3': 'stats',
    '4': 'create-index',
    '5': 'all'
  };

  if (choice === '0') {
    console.log('\n프로그램을 종료합니다.\n');
    rl.close();
    return;
  }

  const taskMode = taskMap[choice];

  if (!taskMode) {
    console.log('\n❌ 잘못된 선택입니다.\n');
    rl.close();
    return;
  }

  await runMaintenance(taskMode);
})();

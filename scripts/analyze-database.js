/**
 * 데이터베이스 분석 스크립트
 *
 * 목적: 30년 데이터베이스의 테이블, 인덱스, 통계 정보 분석
 */

require('dotenv').config();
const sql = require('mssql');

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

async function analyzeDatabase() {
  let pool;

  try {
    console.log('✅ 데이터베이스 연결 중...\n');
    pool = await sql.connect(config);

    console.log('========================================');
    console.log('📊 데이터베이스 분석');
    console.log('========================================\n');

    // 1. 테이블 크기 및 레코드 수 분석
    console.log('1️⃣ 테이블 크기 및 레코드 수:\n');

    const tableSizeQuery = `
      SELECT
        t.NAME AS 테이블명,
        p.rows AS 레코드수,
        SUM(a.total_pages) * 8 AS 총크기KB,
        SUM(a.used_pages) * 8 AS 사용크기KB,
        SUM(a.data_pages) * 8 AS 데이터크기KB
      FROM
        sys.tables t
      INNER JOIN
        sys.indexes i ON t.OBJECT_ID = i.object_id
      INNER JOIN
        sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id
      INNER JOIN
        sys.allocation_units a ON p.partition_id = a.container_id
      WHERE
        t.NAME NOT LIKE 'dt%'
        AND t.is_ms_shipped = 0
        AND i.OBJECT_ID > 255
      GROUP BY
        t.Name, p.Rows
      ORDER BY
        SUM(a.total_pages) DESC
    `;

    const tableSizes = await pool.request().query(tableSizeQuery);

    console.log('Top 20 테이블 (크기순):\n');
    console.table(tableSizes.recordset.slice(0, 20).map(row => ({
      테이블명: row.테이블명,
      레코드수: row.레코드수.toLocaleString(),
      총크기MB: (row.총크기KB / 1024).toFixed(2),
      사용크기MB: (row.사용크기KB / 1024).toFixed(2),
      데이터크기MB: (row.데이터크기KB / 1024).toFixed(2)
    })));

    // 2. 인덱스 분석
    console.log('\n2️⃣ 인덱스 현황:\n');

    const indexQuery = `
      SELECT
        t.name AS 테이블명,
        i.name AS 인덱스명,
        i.type_desc AS 인덱스유형,
        COL_NAME(ic.object_id, ic.column_id) AS 컬럼명,
        i.is_unique AS 유니크여부,
        i.is_primary_key AS 기본키여부
      FROM
        sys.indexes i
      INNER JOIN
        sys.tables t ON i.object_id = t.object_id
      LEFT JOIN
        sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      WHERE
        t.is_ms_shipped = 0
        AND i.type > 0
      ORDER BY
        t.name, i.name, ic.key_ordinal
    `;

    const indexes = await pool.request().query(indexQuery);

    // 테이블별 인덱스 그룹화
    const indexByTable = {};
    indexes.recordset.forEach(row => {
      if (!indexByTable[row.테이블명]) {
        indexByTable[row.테이블명] = [];
      }
      indexByTable[row.테이블명].push(row);
    });

    console.log('주요 테이블 인덱스:\n');
    const mainTables = ['자재입출내역', '견적', '견적내역', '발주', '발주내역', '자재', '자재시세', '자재원장', '로그'];

    mainTables.forEach(tableName => {
      if (indexByTable[tableName]) {
        console.log(`📋 ${tableName}:`);
        const uniqueIndexes = [...new Set(indexByTable[tableName].map(idx => idx.인덱스명))];
        uniqueIndexes.forEach(idxName => {
          const indexInfo = indexByTable[tableName].filter(i => i.인덱스명 === idxName);
          const columns = indexInfo.map(i => i.컬럼명).filter(c => c).join(', ');
          const type = indexInfo[0].인덱스유형;
          const isPK = indexInfo[0].기본키여부 ? ' [PK]' : '';
          const isUnique = indexInfo[0].유니크여부 ? ' [UNIQUE]' : '';
          console.log(`   - ${idxName || '(없음)'}: ${columns} (${type})${isPK}${isUnique}`);
        });
        console.log('');
      } else {
        console.log(`📋 ${tableName}: ⚠️ 인덱스 없음\n`);
      }
    });

    // 3. 로그 테이블 분석 (압축 대상)
    console.log('\n3️⃣ 로그 테이블 분석:\n');

    const logAnalysisQuery = `
      SELECT
        COUNT(*) AS 총레코드수,
        COUNT(DISTINCT 테이블명) AS 테이블명종류,
        MIN(수정일자) AS 최초일자,
        MAX(수정일자) AS 최종일자,
        COUNT(CASE WHEN 수정일자 < '20200101' THEN 1 END) AS 오래된레코드_5년전
      FROM 로그
    `;

    const logAnalysis = await pool.request().query(logAnalysisQuery);
    console.table(logAnalysis.recordset);

    const logSampleQuery = `
      SELECT TOP 10
        테이블명,
        베이스코드,
        최종로그,
        최종로그1,
        수정일자,
        사용자코드
      FROM 로그
      ORDER BY 수정일자 DESC
    `;

    const logSamples = await pool.request().query(logSampleQuery);
    console.log('\n최근 로그 샘플:\n');
    console.table(logSamples.recordset);

    // 4. 조각화 분석
    console.log('\n4️⃣ 인덱스 조각화 분석 (상위 20개):\n');

    const fragmentationQuery = `
      SELECT TOP 20
        OBJECT_NAME(ips.object_id) AS 테이블명,
        i.name AS 인덱스명,
        ips.index_type_desc AS 인덱스유형,
        ips.avg_fragmentation_in_percent AS 조각화율,
        ips.page_count AS 페이지수
      FROM
        sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
      INNER JOIN
        sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
      WHERE
        ips.avg_fragmentation_in_percent > 10
        AND ips.page_count > 1000
      ORDER BY
        ips.avg_fragmentation_in_percent DESC
    `;

    const fragmentation = await pool.request().query(fragmentationQuery);

    if (fragmentation.recordset.length > 0) {
      console.table(fragmentation.recordset.map(row => ({
        테이블명: row.테이블명,
        인덱스명: row.인덱스명,
        조각화율: row.조각화율.toFixed(2) + '%',
        페이지수: row.페이지수.toLocaleString()
      })));
    } else {
      console.log('✅ 조각화가 심한 인덱스 없음\n');
    }

    // 5. 통계 정보 분석
    console.log('\n5️⃣ 통계 업데이트 필요 여부:\n');

    const statsQuery = `
      SELECT
        OBJECT_NAME(s.object_id) AS 테이블명,
        s.name AS 통계명,
        STATS_DATE(s.object_id, s.stats_id) AS 마지막업데이트,
        DATEDIFF(DAY, STATS_DATE(s.object_id, s.stats_id), GETDATE()) AS 경과일수
      FROM
        sys.stats s
      INNER JOIN
        sys.tables t ON s.object_id = t.object_id
      WHERE
        t.is_ms_shipped = 0
        AND STATS_DATE(s.object_id, s.stats_id) IS NOT NULL
      ORDER BY
        STATS_DATE(s.object_id, s.stats_id) ASC
    `;

    const stats = await pool.request().query(statsQuery);

    const outdatedStats = stats.recordset.filter(row => row.경과일수 > 30);

    if (outdatedStats.length > 0) {
      console.log('⚠️ 30일 이상 업데이트 안된 통계 (상위 10개):\n');
      console.table(outdatedStats.slice(0, 10).map(row => ({
        테이블명: row.테이블명,
        통계명: row.통계명,
        마지막업데이트: row.마지막업데이트 ? row.마지막업데이트.toISOString().split('T')[0] : 'N/A',
        경과일수: row.경과일수 + '일'
      })));
    } else {
      console.log('✅ 모든 통계가 최신 상태입니다.\n');
    }

    // 6. 권장 사항 요약
    console.log('\n========================================');
    console.log('💡 권장 사항');
    console.log('========================================\n');

    const totalSize = tableSizes.recordset.reduce((sum, row) => sum + row.총크기KB, 0);
    console.log(`📊 데이터베이스 총 크기: ${(totalSize / 1024 / 1024).toFixed(2)} GB`);
    console.log(`📋 총 테이블 수: ${tableSizes.recordset.length}개`);
    console.log(`🔍 총 인덱스 수: ${[...new Set(indexes.recordset.map(i => i.인덱스명))].filter(n => n).length}개\n`);

    console.log('🔧 필요한 작업:\n');

    // 인덱스 누락 확인
    const tablesWithoutIndex = mainTables.filter(t => !indexByTable[t] || indexByTable[t].length === 0);
    if (tablesWithoutIndex.length > 0) {
      console.log(`1. ⚠️ 인덱스 누락 테이블: ${tablesWithoutIndex.join(', ')}`);
    } else {
      console.log('1. ✅ 주요 테이블 모두 인덱스 보유');
    }

    // 조각화 확인
    if (fragmentation.recordset.length > 0) {
      console.log(`2. ⚠️ 조각화된 인덱스 ${fragmentation.recordset.length}개 재구성 필요`);
    } else {
      console.log('2. ✅ 인덱스 조각화 양호');
    }

    // 통계 업데이트
    if (outdatedStats.length > 0) {
      console.log(`3. ⚠️ 오래된 통계 ${outdatedStats.length}개 업데이트 필요`);
    } else {
      console.log('3. ✅ 통계 정보 최신');
    }

    // 로그 테이블 압축
    const oldLogs = logAnalysis.recordset[0].오래된레코드_5년전;
    if (oldLogs > 0) {
      console.log(`4. ⚠️ 로그 테이블 압축 필요 (5년 이상 된 레코드 ${oldLogs.toLocaleString()}개)`);
    } else {
      console.log('4. ✅ 로그 테이블 관리 양호');
    }

    console.log('\n✅ 분석 완료!\n');

  } catch (err) {
    console.error('❌ 오류 발생:', err);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

analyzeDatabase();

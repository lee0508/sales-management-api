// server.js - 판매 관리 서버
require('dotenv').config(); // 환경변수 로드

const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
const PORT = process.env.PORT || 3000;

const path = require('path');

// CORS 설정 - 환경변수에서 허용 도메인 로드
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

// 미들웨어 설정
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname))); // index.html 및 css/js 제공

// SQL Server 연결 설정 - 환경변수 사용
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// 환경변수 검증
if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_SERVER) {
  console.error('❌ 필수 환경변수가 설정되지 않았습니다!');
  console.error('DB_USER, DB_PASSWORD, DB_SERVER를 .env 파일에 설정해주세요.');
  process.exit(1);
}

// 데이터베이스 연결 풀
let pool;

// const pool = new sql.ConnectionPool(dbConfig);
// const poolConnect = pool.connect();
// app.locals.pool = pool;

// 데이터베이스 연결 함수
async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ SQL Server 연결 성공');
    return pool;
  } catch (err) {
    console.error('❌ SQL Server 연결 실패:', err);
    throw err;
  }
}

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running at http://127.0.0.1:${PORT}`);
      console.log('✅ Static files served from project root (index.html 포함)');
    });
  })
  .catch((err) => {
    console.error('❌ 서버 기동 중 DB 연결 실패로 종료:', err);
    process.exit(1);
  });

// ==================== 인증 API ====================

// 로그인
app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        message: '아이디와 비밀번호를 입력해주세요.',
      });
    }

    // 사용자 테이블에서 인증
    const result = await pool
      .request()
      .input('사용자코드', sql.VarChar(4), userId)
      .input('로그인비밀번호', sql.VarChar(4), password).query(`
                SELECT 
                    u.사용자코드, u.사용자명, u.사용자권한, u.사업장코드,
                    s.사업장명, s.사업자번호, s.대표자명
                FROM 사용자 u
                LEFT JOIN 사업장 s ON u.사업장코드 = s.사업장코드
                WHERE u.사용자코드 = @사용자코드 
                AND u.로그인비밀번호 = @로그인비밀번호
                AND u.사용구분 = 0
            `);

    if (result.recordset.length > 0) {
      const user = result.recordset[0];

      // 로그인 시간 업데이트
      const 시작일시 = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');

      await pool
        .request()
        .input('사용자코드', sql.VarChar(4), userId)
        .input('시작일시', sql.VarChar(17), 시작일시).query(`
                    UPDATE 사용자 
                    SET 시작일시 = @시작일시, 로그인여부 = 'Y'
                    WHERE 사용자코드 = @사용자코드
                `);

      res.json({
        success: true,
        message: '로그인 성공',
        data: {
          사용자코드: user.사용자코드,
          사용자명: user.사용자명,
          사용자권한: user.사용자권한,
          사업장코드: user.사업장코드,
          사업장명: user.사업장명,
          token: 'jwt-token-' + userId, // 실제로는 JWT 토큰 생성
        },
      });
    } else {
      res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      });
    }
  } catch (err) {
    console.error('로그인 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 로그아웃
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { userId } = req.body;

    const 종료일시 = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');

    await pool
      .request()
      .input('사용자코드', sql.VarChar(4), userId)
      .input('종료일시', sql.VarChar(17), 종료일시).query(`
                UPDATE 사용자 
                SET 종료일시 = @종료일시, 로그인여부 = 'N'
                WHERE 사용자코드 = @사용자코드
            `);

    res.json({
      success: true,
      message: '로그아웃 되었습니다.',
    });
  } catch (err) {
    console.error('로그아웃 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ==================== 사업장 API ====================

// 사업장 목록 조회
app.get('/api/workplaces', async (req, res) => {
  try {
    const result = await pool.request().query(`
                SELECT 
                    사업장코드, 사업장명, 사업자번호, 법인번호,
                    대표자명, 전화번호, 팩스번호, 주소, 번지,
                    업태, 업종, 이메일주소, 사용구분
                FROM 사업장
                ORDER BY 사업장코드
            `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('사업장 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 사업장 상세 조회
app.get('/api/workplaces/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), code)
      .query('SELECT * FROM 사업장 WHERE 사업장코드 = @사업장코드');

    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0],
      });
    } else {
      res.status(404).json({
        success: false,
        message: '사업장을 찾을 수 없습니다.',
      });
    }
  } catch (err) {
    console.error('사업장 상세 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

//---------------------------------------------
// ✅ 매출처관리 - 신규 매출처코드 생성 API
//---------------------------------------------
app.get('/api/customer_new', async (req, res) => {
  try {
    console.log('===== 신규 매출처코드 생성 요청 =====');

    // 1. 현재 가장 큰 매출처코드 조회
    const query = `
      SELECT TOP 1 매출처코드
      FROM 매출처
      ORDER BY 매출처코드 DESC
    `;

    const result = await pool.request().query(query);

    let newCode;

    if (result.recordset.length > 0) {
      const lastCode = result.recordset[0].매출처코드;
      console.log('마지막 매출처코드:', lastCode);

      // 2. 영문 1자리 + 숫자 7자리 = 총 8자리 형식
      const prefix = lastCode.charAt(0); // 첫 글자 (영문)
      const numPart = lastCode.substring(1); // 나머지 숫자 부분

      // 3. 숫자 +1 증가
      const nextNum = parseInt(numPart) + 1;

      // 4. 영문 1자리 + 숫자 7자리 = 총 8자리로 포맷
      newCode = prefix + String(nextNum).padStart(7, '0');

      console.log(`  - 접두사: ${prefix}`);
      console.log(`  - 숫자 부분: ${numPart} -> ${nextNum}`);
    } else {
      // 매출처가 하나도 없으면 A0000001부터 시작 (영문 1자리 + 숫자 7자리)
      newCode = 'A0000001';
    }

    console.log('✅ 생성된 매출처코드:', newCode, `(총 ${newCode.length}자리)`);

    res.json({
      success: true,
      data: {
        매출처코드: newCode,
      },
    });
  } catch (err) {
    console.error('❌ /api/customer_new 오류:', err);
    res.status(500).json({ success: false, message: '매출처코드 생성 실패' });
  }
});

//---------------------------------------------
// ✅ 매출처관리 - 고객 목록 조회 API (SQL Injection 수정)
//---------------------------------------------
app.get('/api/customers', async (req, res) => {
  try {
    const { page = 1, pageSize = 500, search = '' } = req.query;
    const offset = (page - 1) * pageSize;
    const limit = Number(pageSize);

    const request = pool.request();

    let query = `
      SELECT 매출처코드, 매출처명, 대표자명, 사업자번호, 전화번호, 사용구분, 수정일자
      FROM (
        SELECT ROW_NUMBER() OVER (ORDER BY 매출처코드) AS RowNum,
              매출처코드, 매출처명, 대표자명, 사업자번호, 전화번호, 사용구분, 수정일자
        FROM 매출처
        WHERE 1=1
    `;

    // 검색어가 있으면 매출처명 또는 매출처코드로 검색 (Parameterized Query 사용)
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      query += ` AND (매출처명 LIKE @search OR 매출처코드 LIKE @search)`;
    }

    query += `
      ) AS T
      WHERE RowNum BETWEEN @startRow AND @endRow;
    `;

    request.input('startRow', sql.Int, offset + 1);
    request.input('endRow', sql.Int, offset + limit);

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error('❌ /api/customers 오류:', err);
    res.status(500).json({ success: false, message: '매출처 조회 실패' });
  }
});

// 매출처 상세 조회
app.get('/api/customers/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool
      .request()
      .input('매출처코드', sql.VarChar(8), code)
      .query('SELECT * FROM 매출처 WHERE 매출처코드 = @매출처코드');

    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0],
      });
    } else {
      res.status(404).json({
        success: false,
        message: '매출처를 찾을 수 없습니다.',
      });
    }
  } catch (err) {
    console.error('매출처 상세 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 매출처 신규 등록
app.post('/api/customers', async (req, res) => {
  try {
    const {
      매출처코드,
      매출처명,
      사업자번호,
      법인번호,
      대표자명,
      대표자주민번호,
      개업일자,
      우편번호,
      주소,
      번지,
      업태,
      업종,
      전화번호,
      팩스번호,
      은행코드,
      계좌번호,
      담당자명,
      사용구분,
      비고란,
    } = req.body;

    console.log('===== 매출처 신규 등록 요청 =====');
    console.log('매출처코드:', 매출처코드);
    console.log('매출처명:', 매출처명);

    // 수정일자 (YYYYMMDD 형식)
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('매출처코드', sql.VarChar(8), 매출처코드)
      .input('매출처명', sql.VarChar(30), 매출처명)
      .input('사업자번호', sql.VarChar(14), 사업자번호 || '')
      .input('법인번호', sql.VarChar(14), 법인번호 || '')
      .input('대표자명', sql.VarChar(30), 대표자명 || '')
      .input('대표자주민번호', sql.VarChar(14), 대표자주민번호 || '')
      .input('개업일자', sql.VarChar(8), 개업일자 || '')
      .input('우편번호', sql.VarChar(7), 우편번호 || '')
      .input('주소', sql.VarChar(60), 주소 || '')
      .input('번지', sql.VarChar(60), 번지 || '')
      .input('업태', sql.VarChar(30), 업태 || '')
      .input('업종', sql.VarChar(30), 업종 || '')
      .input('전화번호', sql.VarChar(20), 전화번호 || '')
      .input('팩스번호', sql.VarChar(14), 팩스번호 || '')
      .input('은행코드', sql.VarChar(2), 은행코드 || '')
      .input('계좌번호', sql.VarChar(20), 계좌번호 || '')
      .input('담당자명', sql.VarChar(30), 담당자명 || '')
      .input('사용구분', sql.TinyInt, 사용구분 || 0)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('비고란', sql.VarChar(100), 비고란 || '').query(`
        INSERT INTO 매출처 (
          매출처코드, 매출처명, 사업자번호, 법인번호, 대표자명, 대표자주민번호,
          개업일자, 우편번호, 주소, 번지, 업태, 업종, 전화번호, 팩스번호,
          은행코드, 계좌번호, 담당자명, 사용구분, 수정일자, 비고란
        ) VALUES (
          @매출처코드, @매출처명, @사업자번호, @법인번호, @대표자명, @대표자주민번호,
          @개업일자, @우편번호, @주소, @번지, @업태, @업종, @전화번호, @팩스번호,
          @은행코드, @계좌번호, @담당자명, @사용구분, @수정일자, @비고란
        )
      `);

    console.log('✅ 매출처 등록 완료');

    res.json({
      success: true,
      message: '매출처가 등록되었습니다.',
    });
  } catch (err) {
    console.error('❌ 매출처 등록 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 매출처 수정
app.put('/api/customers/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const {
      매출처명,
      사업자번호,
      법인번호,
      대표자명,
      대표자주민번호,
      개업일자,
      우편번호,
      주소,
      번지,
      업태,
      업종,
      전화번호,
      팩스번호,
      은행코드,
      계좌번호,
      담당자명,
      사용구분,
      비고란,
    } = req.body;

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('매출처코드', sql.VarChar(8), code)
      .input('매출처명', sql.VarChar(30), 매출처명)
      .input('사업자번호', sql.VarChar(14), 사업자번호 || '')
      .input('법인번호', sql.VarChar(14), 법인번호 || '')
      .input('대표자명', sql.VarChar(30), 대표자명 || '')
      .input('대표자주민번호', sql.VarChar(14), 대표자주민번호 || '')
      .input('개업일자', sql.VarChar(8), 개업일자 || '')
      .input('우편번호', sql.VarChar(7), 우편번호 || '')
      .input('주소', sql.VarChar(60), 주소 || '')
      .input('번지', sql.VarChar(60), 번지 || '')
      .input('업태', sql.VarChar(30), 업태 || '')
      .input('업종', sql.VarChar(30), 업종 || '')
      .input('전화번호', sql.VarChar(20), 전화번호 || '')
      .input('팩스번호', sql.VarChar(14), 팩스번호 || '')
      .input('은행코드', sql.VarChar(2), 은행코드 || '')
      .input('계좌번호', sql.VarChar(20), 계좌번호 || '')
      .input('담당자명', sql.VarChar(30), 담당자명 || '')
      .input('사용구분', sql.TinyInt, 사용구분 || 0)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('비고란', sql.VarChar(100), 비고란 || '').query(`
        UPDATE 매출처 SET
          매출처명 = @매출처명,
          사업자번호 = @사업자번호,
          법인번호 = @법인번호,
          대표자명 = @대표자명,
          대표자주민번호 = @대표자주민번호,
          개업일자 = @개업일자,
          우편번호 = @우편번호,
          주소 = @주소,
          번지 = @번지,
          업태 = @업태,
          업종 = @업종,
          전화번호 = @전화번호,
          팩스번호 = @팩스번호,
          은행코드 = @은행코드,
          계좌번호 = @계좌번호,
          담당자명 = @담당자명,
          사용구분 = @사용구분,
          수정일자 = @수정일자,
          비고란 = @비고란
        WHERE 매출처코드 = @매출처코드
      `);

    res.json({
      success: true,
      message: '매출처가 수정되었습니다.',
    });
  } catch (err) {
    console.error('매출처 수정 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 매출처 삭제
app.delete('/api/customers/:code', async (req, res) => {
  try {
    const { code } = req.params;

    await pool
      .request()
      .input('매출처코드', sql.VarChar(8), code)
      .query('DELETE FROM 매출처 WHERE 매출처코드 = @매출처코드');

    res.json({
      success: true,
      message: '매출처가 삭제되었습니다.',
    });
  } catch (err) {
    console.error('매출처 삭제 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ==================== 매입처 API ====================

// 매입처 리스트
app.get('/api/suppliers', async (req, res) => {
  try {
    /**
        const { search, 사업장코드 } = req.query;
        
        let query = `
            SELECT 
                사업장코드, 매입처코드, 매입처명, 사업자번호,
                대표자명, 전화번호, 사용구분, 수정일자, 담당자명, 비고란
            FROM 매입처
            WHERE 1=1
        `;
        
        if (사업장코드) {
            query += ` AND 사업장코드 = '${사업장코드}'`;
        }
        
        if (search) {
            query += ` AND (매입처명 LIKE '%${search}%' OR 사업자번호 LIKE '%${search}%')`;
        }
        
        query += ` ORDER BY 매입처코드`;
        
        const result = await pool.request().query(query);
        
        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        }); **/
    // ✅ page, pageSize 파라미터 추가 (SQL Injection 수정)
    const { search = '', 사업장코드, page = 1, pageSize = 10 } = req.query;
    const offset = (page - 1) * pageSize;
    const limit = Number(pageSize);

    // ✅ 총 레코드 수 계산 (Parameterized Query)
    const countRequest = pool.request();
    let countQuery = `
            SELECT COUNT(*) AS totalCount
            FROM 매입처
            WHERE 1=1
        `;

    if (사업장코드) {
      countRequest.input('사업장코드', sql.VarChar(2), 사업장코드);
      countQuery += ` AND 사업장코드 = @사업장코드`;
    }
    if (search) {
      countRequest.input('search', sql.NVarChar, `%${search}%`);
      countQuery += ` AND (매입처명 LIKE @search OR 사업자번호 LIKE @search)`;
    }

    const countResult = await countRequest.query(countQuery);
    const totalCount = countResult.recordset[0].totalCount;

    // ✅ ROW_NUMBER()로 효율적인 페이지네이션 (Parameterized Query)
    const dataRequest = pool.request();
    let query = `
            SELECT *
            FROM (
                SELECT
                    ROW_NUMBER() OVER (ORDER BY 매입처코드 ASC) AS RowNum,
                    사업장코드, 매입처코드, 매입처명, 사업자번호,
                    대표자명, 전화번호, 사용구분, 수정일자, 담당자명, 비고란
                FROM 매입처
                WHERE 1=1
        `;

    if (사업장코드) {
      dataRequest.input('사업장코드', sql.VarChar(2), 사업장코드);
      query += ` AND 사업장코드 = @사업장코드`;
    }
    if (search) {
      dataRequest.input('search', sql.NVarChar, `%${search}%`);
      query += ` AND (매입처명 LIKE @search OR 사업자번호 LIKE @search)`;
    }

    query += `
            ) AS Result
            WHERE RowNum BETWEEN @startRow AND @endRow
            ORDER BY RowNum
        `;

    dataRequest.input('startRow', sql.Int, offset + 1);
    dataRequest.input('endRow', sql.Int, offset + limit);

    const result = await dataRequest.query(query);

    // ✅ 페이지네이션 정보와 함께 응답
    res.json({
      success: true,
      data: result.recordset,
      total: totalCount,
      currentPage: Number(page),
      totalPages: Math.ceil(totalCount / pageSize),
    });
  } catch (err) {
    console.error('매입처 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 매입처 코드 조회
app.get('/api/suppliers_search_code/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool
      .request()
      .input('매입처코드', sql.VarChar(8), code)
      .query('SELECT * FROM 매입처 WHERE 매입처코드 = @매입처코드');

    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0],
      });
    } else {
      res.status(404).json({
        success: false,
        message: '매입처를 찾을 수 없습니다.',
      });
    }
  } catch (err) {
    console.error('매입처 상세 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 매입처 신규 등록
app.post('/api/suppliers_new', async (req, res) => {
  try {
    const {
      사업장코드,
      매입처코드,
      매입처명,
      사업자번호,
      법인번호,
      대표자명,
      대표자주민번호,
      개업일자,
      우편번호,
      주소,
      번지,
      업태,
      업종,
      전화번호,
      팩스번호,
      은행코드,
      계좌번호,
      계산서발행여부,
      계산서발행율,
      담당자명,
      사용구분,
      비고란,
      단가구분,
    } = req.body;

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드 || '')
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .input('매입처명', sql.VarChar(30), 매입처명)
      .input('사업자번호', sql.VarChar(14), 사업자번호 || '')
      .input('법인번호', sql.VarChar(14), 법인번호 || '')
      .input('대표자명', sql.VarChar(30), 대표자명 || '')
      .input('대표자주민번호', sql.VarChar(14), 대표자주민번호 || '')
      .input('개업일자', sql.VarChar(8), 개업일자 || '')
      .input('우편번호', sql.VarChar(7), 우편번호 || '')
      .input('주소', sql.VarChar(60), 주소 || '')
      .input('번지', sql.VarChar(60), 번지 || '')
      .input('업태', sql.VarChar(30), 업태 || '')
      .input('업종', sql.VarChar(30), 업종 || '')
      .input('전화번호', sql.VarChar(20), 전화번호 || '')
      .input('팩스번호', sql.VarChar(14), 팩스번호 || '')
      .input('은행코드', sql.VarChar(2), 은행코드 || '')
      .input('계좌번호', sql.VarChar(20), 계좌번호 || '')
      .input('계산서발행여부', sql.TinyInt, 계산서발행여부 || 1)
      .input('계산서발행율', sql.Money, 계산서발행율 || 100)
      .input('담당자명', sql.VarChar(30), 담당자명 || '')
      .input('사용구분', sql.TinyInt, 사용구분 || 0)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), '')
      .input('비고란', sql.VarChar(100), 비고란 || '')
      .input('단가구분', sql.TinyInt, 단가구분 || 1).query(`
                INSERT INTO 매입처 (
                    사업장코드, 매입처코드, 매입처명, 사업자번호, 법인번호,
                    대표자명, 대표자주민번호, 개업일자, 우편번호, 주소, 번지,
                    업태, 업종, 전화번호, 팩스번호, 은행코드, 계좌번호,
                    계산서발행여부, 계산서발행율, 담당자명, 사용구분,
                    수정일자, 사용자코드, 비고란, 단가구분
                ) VALUES (
                    @사업장코드, @매입처코드, @매입처명, @사업자번호, @법인번호,
                    @대표자명, @대표자주민번호, @개업일자, @우편번호, @주소, @번지,
                    @업태, @업종, @전화번호, @팩스번호, @은행코드, @계좌번호,
                    @계산서발행여부, @계산서발행율, @담당자명, @사용구분,
                    @수정일자, @사용자코드, @비고란, @단가구분
                )
            `);

    res.json({
      success: true,
      message: '매입처가 등록되었습니다.',
    });
  } catch (err) {
    console.error('매입처 등록 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 매입처 수정
app.put('/api/suppliers_edit/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const {
      매입처명,
      사업자번호,
      법인번호,
      대표자명,
      대표자주민번호,
      개업일자,
      우편번호,
      주소,
      번지,
      업태,
      업종,
      전화번호,
      팩스번호,
      은행코드,
      계좌번호,
      계산서발행여부,
      계산서발행율,
      담당자명,
      사용구분,
      비고란,
      단가구분,
    } = req.body;

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('매입처코드', sql.VarChar(8), code)
      .input('매입처명', sql.VarChar(30), 매입처명)
      .input('사업자번호', sql.VarChar(14), 사업자번호 || '')
      .input('법인번호', sql.VarChar(14), 법인번호 || '')
      .input('대표자명', sql.VarChar(30), 대표자명 || '')
      .input('대표자주민번호', sql.VarChar(14), 대표자주민번호 || '')
      .input('개업일자', sql.VarChar(8), 개업일자 || '')
      .input('우편번호', sql.VarChar(7), 우편번호 || '')
      .input('주소', sql.VarChar(60), 주소 || '')
      .input('번지', sql.VarChar(60), 번지 || '')
      .input('업태', sql.VarChar(30), 업태 || '')
      .input('업종', sql.VarChar(30), 업종 || '')
      .input('전화번호', sql.VarChar(20), 전화번호 || '')
      .input('팩스번호', sql.VarChar(14), 팩스번호 || '')
      .input('은행코드', sql.VarChar(2), 은행코드 || '')
      .input('계좌번호', sql.VarChar(20), 계좌번호 || '')
      .input('계산서발행여부', sql.TinyInt, 계산서발행여부 || 1)
      .input('계산서발행율', sql.Money, 계산서발행율 || 100)
      .input('담당자명', sql.VarChar(30), 담당자명 || '')
      .input('사용구분', sql.TinyInt, 사용구분 || 0)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('비고란', sql.VarChar(100), 비고란 || '')
      .input('단가구분', sql.TinyInt, 단가구분 || 1).query(`
                UPDATE 매입처 SET
                    매입처명 = @매입처명,
                    사업자번호 = @사업자번호,
                    법인번호 = @법인번호,
                    대표자명 = @대표자명,
                    대표자주민번호 = @대표자주민번호,
                    개업일자 = @개업일자,
                    우편번호 = @우편번호,
                    주소 = @주소,
                    번지 = @번지,
                    업태 = @업태,
                    업종 = @업종,
                    전화번호 = @전화번호,
                    팩스번호 = @팩스번호,
                    은행코드 = @은행코드,
                    계좌번호 = @계좌번호,
                    계산서발행여부 = @계산서발행여부,
                    계산서발행율 = @계산서발행율,
                    담당자명 = @담당자명,
                    사용구분 = @사용구분,
                    수정일자 = @수정일자,
                    비고란 = @비고란,
                    단가구분 = @단가구분
                WHERE 매입처코드 = @매입처코드
            `);

    res.json({
      success: true,
      message: '매입처가 수정되었습니다.',
    });
  } catch (err) {
    console.error('매입처 수정 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 매입처 삭제
app.delete('/api/suppliers_delete/:code', async (req, res) => {
  try {
    const { code } = req.params;

    await pool
      .request()
      .input('매입처코드', sql.VarChar(8), code)
      .query('DELETE FROM 매입처 WHERE 매입처코드 = @매입처코드');

    res.json({
      success: true,
      message: '매입처가 삭제되었습니다.',
    });
  } catch (err) {
    console.error('매입처 삭제 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ==================== 견적 API ====================

// 견적 리스트
app.get('/api/quotations', async (req, res) => {
  try {
    const { search, 사업장코드, 상태코드 } = req.query;
    const startDate = req.query.startDate || req.query.start;
    const endDate = req.query.endDate || req.query.end;

    let query = `
            SELECT 
                q.사업장코드, q.견적일자, q.견적번호, q.매출처코드,
                c.매출처명, q.출고희망일자, q.제목, q.적요, q.상태코드,
                q.수정일자, u.사용자명
            FROM 견적 q
            LEFT JOIN 매출처 c ON q.매출처코드 = c.매출처코드
            LEFT JOIN 사용자 u ON q.사용자코드 = u.사용자코드
            WHERE q.사용구분 = 0
        `;

    if (사업장코드) {
      query += ` AND q.사업장코드 = '${사업장코드}'`;
    }

    if (상태코드) {
      query += ` AND q.상태코드 = ${상태코드}`;
    }

    if (startDate && endDate) {
      query += ` AND q.견적일자 BETWEEN '${startDate}' AND '${endDate}'`;
    }

    if (search) {
      query += ` AND (c.매출처명 LIKE '%${search}%' OR q.제목 LIKE '%${search}%')`;
    }

    query += ` ORDER BY q.견적일자 DESC, q.견적번호 DESC`;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('견적 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 견적 상세 조회 (마스터 + 디테일)
app.get('/api/quotations/:date/:no', async (req, res) => {
  try {
    const { date, no } = req.params;

    // 마스터 조회
    const master = await pool
      .request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Real, parseFloat(no)).query(`
                SELECT q.*, c.매출처명, c.사업자번호, c.대표자명
                FROM 견적 q
                LEFT JOIN 매출처 c ON q.매출처코드 = c.매출처코드
                WHERE q.견적일자 = @견적일자 AND q.견적번호 = @견적번호
            `);

    // 디테일 조회
    const detail = await pool
      .request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Real, parseFloat(no)).query(`
                SELECT
                    qd.견적일자, qd.견적번호, qd.견적시간,
                    qd.자재코드,
                    qd.수량, qd.출고단가, qd.출고부가,
                    (qd.수량 * qd.출고단가) as 금액,
                    m.자재명, m.규격, m.단위,
                    s.매입처명
                FROM 견적내역 qd
                LEFT JOIN 자재 m ON qd.자재코드 = (m.분류코드 + m.세부코드)
                LEFT JOIN 매입처 s ON qd.매입처코드 = s.매입처코드
                WHERE qd.견적일자 = @견적일자 AND qd.견적번호 = @견적번호
                AND qd.사용구분 = 0
                ORDER BY qd.견적시간
            `);

    if (master.recordset.length > 0) {
      res.json({
        success: true,
        data: {
          master: master.recordset[0],
          detail: detail.recordset,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        message: '견적을 찾을 수 없습니다.',
      });
    }
  } catch (err) {
    console.error('견적 상세 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 견적 신규 등록
app.post('/api/quotations_add', async (req, res) => {
  try {
    const { master, details } = req.body;

    // 견적번호 생성 (로그 테이블 사용)
    const logResult = await pool
      .request()
      .input('테이블명', sql.VarChar(50), '견적')
      .input('베이스코드', sql.VarChar(50), master.견적일자).query(`
                SELECT 최종로그 FROM 로그 
                WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
            `);

    let 견적번호 = 1;
    if (logResult.recordset.length > 0) {
      견적번호 = logResult.recordset[0].최종로그 + 1;
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 마스터 등록
    await pool
      .request()
      .input('사업장코드', sql.VarChar(2), master.사업장코드)
      .input('견적일자', sql.VarChar(8), master.견적일자)
      .input('견적번호', sql.Real, 견적번호)
      .input('매출처코드', sql.VarChar(8), master.매출처코드)
      .input('출고희망일자', sql.VarChar(8), master.출고희망일자 || '')
      .input('결제방법', sql.TinyInt, master.결제방법 || 0)
      .input('결제예정일자', sql.VarChar(8), master.결제예정일자 || '')
      .input('유효일수', sql.Int, master.유효일수 || 0)
      .input('제목', sql.VarChar(30), master.제목 || '')
      .input('적요', sql.VarChar(50), master.적요 || '')
      .input('상태코드', sql.TinyInt, master.상태코드 || 1)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), master.사용자코드 || '').query(`
                INSERT INTO 견적 (
                    사업장코드, 견적일자, 견적번호, 매출처코드, 출고희망일자,
                    결제방법, 결제예정일자, 유효일수, 제목, 적요, 상태코드,
                    입고일자, 출고일자, 사용구분, 수정일자, 사용자코드
                ) VALUES (
                    @사업장코드, @견적일자, @견적번호, @매출처코드, @출고희망일자,
                    @결제방법, @결제예정일자, @유효일수, @제목, @적요, @상태코드,
                    '', '', 0, @수정일자, @사용자코드
                )
            `);

    // 디테일 등록
    for (const detail of details) {
      const 견적시간 = new Date()
        .toISOString()
        .replace(/[-:T]/g, '')
        .replace(/\..+/, '')
        .substring(8);

      await pool
        .request()
        .input('사업장코드', sql.VarChar(2), master.사업장코드)
        .input('견적일자', sql.VarChar(8), master.견적일자)
        .input('견적번호', sql.Real, 견적번호)
        .input('견적시간', sql.VarChar(9), 견적시간)
        .input('자재코드', sql.VarChar(18), detail.자재코드)
        .input('매입처코드', sql.VarChar(8), detail.매입처코드 || '')
        .input('수량', sql.Money, detail.수량)
        .input('매출처코드', sql.VarChar(8), master.매출처코드)
        .input('계산서발행여부', sql.TinyInt, detail.계산서발행여부 || 1)
        .input('입고단가', sql.Money, detail.입고단가 || 0)
        .input('입고부가', sql.Money, detail.입고부가 || 0)
        .input('출고단가', sql.Money, detail.출고단가 || 0)
        .input('출고부가', sql.Money, detail.출고부가 || 0)
        .input('적요', sql.VarChar(50), detail.적요 || '')
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), master.사용자코드 || '').query(`
                    INSERT INTO 견적내역 (
                        사업장코드, 견적일자, 견적번호, 견적시간, 자재코드,
                        매입처코드, 수량, 매출처코드, 계산서발행여부, 입고단가,
                        입고부가, 출고단가, 출고부가, 상태코드, 입고일자, 출고일자,
                        적요, 사용구분, 수정일자, 사용자코드
                    ) VALUES (
                        @사업장코드, @견적일자, @견적번호, @견적시간, @자재코드,
                        @매입처코드, @수량, @매출처코드, @계산서발행여부, @입고단가,
                        @입고부가, @출고단가, @출고부가, 1, '', '',
                        @적요, 0, @수정일자, @사용자코드
                    )
                `);
    }

    // 로그 업데이트
    if (logResult.recordset.length > 0) {
      await pool
        .request()
        .input('테이블명', sql.VarChar(50), '견적')
        .input('베이스코드', sql.VarChar(50), master.견적일자)
        .input('최종로그', sql.Money, 견적번호)
        .input('수정일자', sql.VarChar(8), 수정일자).query(`
                    UPDATE 로그 SET 최종로그 = @최종로그, 수정일자 = @수정일자
                    WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
                `);
    } else {
      await pool
        .request()
        .input('테이블명', sql.VarChar(50), '견적')
        .input('베이스코드', sql.VarChar(50), master.견적일자)
        .input('최종로그', sql.Money, 견적번호)
        .input('수정일자', sql.VarChar(8), 수정일자).query(`
                    INSERT INTO 로그 (테이블명, 베이스코드, 최종로그, 최종로그1, 수정일자, 사용자코드)
                    VALUES (@테이블명, @베이스코드, @최종로그, 0, @수정일자, '')
                `);
    }

    res.json({
      success: true,
      message: '견적이 등록되었습니다.',
      data: { 견적일자: master.견적일자, 견적번호 },
    });
  } catch (err) {
    console.error('견적 등록 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

//---------------------------------------------
// ✅ 견적 상세 품목 목록 조회 (일자 + 번호로 조회)
//---------------------------------------------
app.get('/api/quotations/:date/:no/details', async (req, res) => {
  try {
    const { date, no } = req.params;

    const result = await pool
      .request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Real, parseFloat(no)).query(`
        SELECT
          qd.*,
          (m.분류코드 + m.세부코드) as 자재코드,
          m.자재명, m.규격, m.단위,
          s.매입처명,
          (qd.출고단가 * qd.수량) AS 금액
        FROM 견적내역 qd
        LEFT JOIN 자재 m ON qd.자재코드 = (m.분류코드 + m.세부코드)
        LEFT JOIN 매입처 s ON qd.매입처코드 = s.매입처코드
        WHERE qd.견적일자 = @견적일자
          AND qd.견적번호 = @견적번호
          AND qd.사용구분 = 0
        ORDER BY qd.견적시간
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('❌ 견적 상세 조회 오류:', err);
    res.status(500).json({ success: false, message: '견적 상세 조회 실패' });
  }
});

//---------------------------------------------
// ✅ 견적 삭제 (소프트 삭제 - 사용구분 변경)
//---------------------------------------------
app.delete('/api/quotations/:date/:no', async (req, res) => {
  try {
    const { date, no } = req.params;
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 마스터 삭제 (사용구분 = 1)
    await pool
      .request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Real, parseFloat(no))
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 견적
        SET 사용구분 = 1, 수정일자 = @수정일자
        WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호
      `);

    // 디테일 삭제 (사용구분 = 1)
    await pool
      .request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Real, parseFloat(no))
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 견적내역
        SET 사용구분 = 1, 수정일자 = @수정일자
        WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호
      `);

    res.json({
      success: true,
      message: '견적이 삭제되었습니다.',
    });
  } catch (err) {
    console.error('견적 삭제 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

//---------------------------------------------
// ✅ 견적 승인 (상태코드 변경: 1 -> 2)
//---------------------------------------------
app.put('/api/quotations/:date/:no/approve', async (req, res) => {
  try {
    const { date, no } = req.params;
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Real, parseFloat(no))
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 견적
        SET 상태코드 = 2, 수정일자 = @수정일자
        WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호
      `);

    res.json({
      success: true,
      message: '견적이 승인되었습니다.',
    });
  } catch (err) {
    console.error('견적 승인 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

//---------------------------------------------
// ✅ 견적 수정 (마스터 정보만)
//---------------------------------------------
app.put('/api/quotations/:date/:no', async (req, res) => {
  try {
    const { date, no } = req.params;
    const { 매출처코드, 출고희망일자, 결제방법, 결제예정일자, 유효일수, 제목, 적요 } = req.body;
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Real, parseFloat(no))
      .input('매출처코드', sql.VarChar(8), 매출처코드 || '')
      .input('출고희망일자', sql.VarChar(8), 출고희망일자 || '')
      .input('결제방법', sql.TinyInt, 결제방법 || 0)
      .input('결제예정일자', sql.VarChar(8), 결제예정일자 || '')
      .input('유효일수', sql.Int, 유효일수 || 0)
      .input('제목', sql.VarChar(30), 제목 || '')
      .input('적요', sql.VarChar(50), 적요 || '')
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 견적
        SET
          매출처코드 = @매출처코드,
          출고희망일자 = @출고희망일자,
          결제방법 = @결제방법,
          결제예정일자 = @결제예정일자,
          유효일수 = @유효일수,
          제목 = @제목,
          적요 = @적요,
          수정일자 = @수정일자
        WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호
      `);

    res.json({
      success: true,
      message: '견적이 수정되었습니다.',
    });
  } catch (err) {
    console.error('견적 수정 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

//------------------------------------------------------------
// ✅ 견적내역 수정 API
// PUT /api/quotations/:date/:no/details
//------------------------------------------------------------
app.put('/api/quotations/:date/:no/details', async (req, res) => {
  let transaction;
  try {
    const { date, no } = req.params;
    const details = req.body; // [{ 자재코드, 수량, 출고단가, 금액, ... }]

    if (!Array.isArray(details) || details.length === 0) {
      return res.status(400).json({ success: false, message: '수정할 내역이 없습니다.' });
    }

    // 견적 마스터 정보 조회 (사업장코드, 매출처코드 가져오기)
    const masterResult = await pool.request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Int, no)
      .query('SELECT 사업장코드, 매출처코드 FROM 견적 WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호');

    if (masterResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '견적을 찾을 수 없습니다.' });
    }

    const { 사업장코드, 매출처코드 } = masterResult.recordset[0];

    // 트랜잭션 시작
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);

    // 기존 내역 삭제 후 재삽입 방식 (단순화)
    await request
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Int, no)
      .query('DELETE FROM 견적내역 WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호');

    // 현재 시간 생성
    const now = new Date();
    const 수정일자 = now.toISOString().slice(0, 10).replace(/-/g, '');

    // 새로운 내역 삽입
    for (let i = 0; i < details.length; i++) {
      const item = details[i];
      // 견적시간은 varchar(9)이므로 9자리로 제한 (HHMMSSmmm 형식)
      const 견적시간 = now.toISOString().replace(/[-:]/g, '').replace('T', '').slice(8, 17);

      const insertRequest = new sql.Request(transaction);
      await insertRequest
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('견적일자', sql.VarChar(8), date)
        .input('견적번호', sql.Real, parseFloat(no))
        .input('견적시간', sql.VarChar(17), 견적시간)
        .input('자재코드', sql.VarChar(18), item.자재코드)
        .input('매입처코드', sql.VarChar(8), '')
        .input('수량', sql.Real, parseFloat(item.수량) || 0)
        .input('매출처코드', sql.VarChar(8), 매출처코드)
        .input('계산서발행여부', sql.TinyInt, 1)
        .input('입고단가', sql.Money, 0)
        .input('입고부가', sql.Money, 0)
        .input('출고단가', sql.Money, parseFloat(item.출고단가) || 0)
        .input('출고부가', sql.Money, 0)
        .input('적요', sql.VarChar(50), '')
        .input('사용구분', sql.TinyInt, 0)
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), '')
        .query(`
          INSERT INTO 견적내역 (
            사업장코드, 견적일자, 견적번호, 견적시간, 자재코드,
            매입처코드, 수량, 매출처코드, 계산서발행여부, 입고단가,
            입고부가, 출고단가, 출고부가, 상태코드, 입고일자, 출고일자,
            적요, 사용구분, 수정일자, 사용자코드
          )
          VALUES (
            @사업장코드, @견적일자, @견적번호, @견적시간, @자재코드,
            @매입처코드, @수량, @매출처코드, @계산서발행여부, @입고단가,
            @입고부가, @출고단가, @출고부가, 1, '', '',
            @적요, @사용구분, @수정일자, @사용자코드
          )
        `);
    }

    await transaction.commit();

    res.json({ success: true, message: '견적 내역이 수정되었습니다.' });
  } catch (err) {
    console.error('견적내역 수정 에러:', err);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('트랜잭션 롤백 에러:', rollbackErr);
      }
    }
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

//------------------------------------------------------------
// ✅ 자재 출고단가 이력 조회 API (자재입출내역 테이블 기반)
// GET /api/materials/:materialCode/price-history/:customerCode
//------------------------------------------------------------
app.get('/api/materials/:materialCode/price-history/:customerCode', async (req, res) => {
  try {
    const { materialCode, customerCode } = req.params;

    // 자재코드 분리 (분류코드 2자리 + 세부코드)
    const 분류코드 = materialCode.substring(0, 2);
    const 세부코드 = materialCode.substring(2);

    // 자재입출내역 테이블에서 출고 이력 조회 (최근 10건)
    const result = await pool.request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드)
      .input('매출처코드', sql.VarChar(8), customerCode)
      .query(`
        SELECT TOP 10
          입출고일자,
          입출고시간,
          출고수량,
          출고단가,
          출고부가,
          (출고수량 * 출고단가) AS 금액,
          적요
        FROM 자재입출내역
        WHERE 분류코드 = @분류코드
          AND 세부코드 = @세부코드
          AND 매출처코드 = @매출처코드
          AND 입출고구분 = 2
          AND 출고수량 > 0
          AND 사용구분 = 0
        ORDER BY 입출고일자 DESC, 입출고시간 DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });
  } catch (err) {
    console.error('출고단가 이력 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

//------------------------------------------------------------
// ✅ 견적 제안가 이력 조회 API (견적내역 테이블 기반)
// GET /api/materials/:materialCode/quotation-history/:customerCode
//------------------------------------------------------------
app.get('/api/materials/:materialCode/quotation-history/:customerCode', async (req, res) => {
  try {
    const { materialCode, customerCode } = req.params;

    // 견적내역 + 견적 테이블에서 견적 이력 조회 (최근 10건)
    const result = await pool.request()
      .input('자재코드', sql.VarChar(18), materialCode)
      .input('매출처코드', sql.VarChar(8), customerCode)
      .query(`
        SELECT TOP 10
          q.견적일자,
          q.견적번호,
          qd.출고단가,
          qd.수량,
          (qd.수량 * qd.출고단가) AS 금액,
          q.상태코드
        FROM 견적내역 qd
        INNER JOIN 견적 q ON qd.견적일자 = q.견적일자 AND qd.견적번호 = q.견적번호
        WHERE qd.자재코드 = @자재코드
          AND q.매출처코드 = @매출처코드
          AND qd.사용구분 = 0
          AND q.사용구분 = 0
        ORDER BY q.견적일자 DESC, q.견적번호 DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });
  } catch (err) {
    console.error('견적 제안가 이력 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// ==================== 발주 API ====================

// 발주 리스트
app.get('/api/orders', async (req, res) => {
  try {
    const { search, 사업장코드, 상태코드, startDate, endDate } = req.query;

    let query = `
            SELECT 
                o.사업장코드, o.발주일자, o.발주번호, o.매입처코드,
                s.매입처명, o.입고희망일자, o.제목, o.적요, o.상태코드,
                o.수정일자, u.사용자명
            FROM 발주 o
            LEFT JOIN 매입처 s ON o.매입처코드 = s.매입처코드
            LEFT JOIN 사용자 u ON o.사용자코드 = u.사용자코드
            WHERE o.사용구분 = 0
        `;

    if (사업장코드) {
      query += ` AND o.사업장코드 = '${사업장코드}'`;
    }

    if (상태코드) {
      query += ` AND o.상태코드 = ${상태코드}`;
    }

    if (startDate && endDate) {
      query += ` AND o.발주일자 BETWEEN '${startDate}' AND '${endDate}'`;
    }

    if (search) {
      query += ` AND (s.매입처명 LIKE '%${search}%' OR o.제목 LIKE '%${search}%')`;
    }

    query += ` ORDER BY o.발주일자 DESC, o.발주번호 DESC`;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('발주 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 발주 상세 조회
app.get('/api/orders/:date/:no', async (req, res) => {
  try {
    const { date, no } = req.params;

    // 마스터 조회
    const master = await pool
      .request()
      .input('발주일자', sql.VarChar(8), date)
      .input('발주번호', sql.Real, parseFloat(no)).query(`
                SELECT o.*, s.매입처명, s.사업자번호, s.대표자명
                FROM 발주 o
                LEFT JOIN 매입처 s ON o.매입처코드 = s.매입처코드
                WHERE o.발주일자 = @발주일자 AND o.발주번호 = @발주번호
            `);

    // 디테일 조회
    const detail = await pool
      .request()
      .input('발주일자', sql.VarChar(8), date)
      .input('발주번호', sql.Real, parseFloat(no)).query(`
                SELECT 
                    od.*, 
                    (m.분류코드 + m.세부코드) as 자재코드,
                    m.자재명, m.규격, m.단위,
                    s.매입처명
                FROM 발주내역 od
                LEFT JOIN 자재 m ON od.자재코드 = (m.분류코드 + m.세부코드)
                LEFT JOIN 매입처 s ON od.매입처코드 = s.매입처코드
                WHERE od.발주일자 = @발주일자 AND od.발주번호 = @발주번호
                AND od.사용구분 = 0
                ORDER BY od.발주시간
            `);

    if (master.recordset.length > 0) {
      res.json({
        success: true,
        data: {
          master: master.recordset[0],
          detail: detail.recordset,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        message: '발주를 찾을 수 없습니다.',
      });
    }
  } catch (err) {
    console.error('발주 상세 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 자재 리스트
app.get('/api/materials', async (req, res) => {
  try {
    const { search, 분류코드 } = req.query;

    let query = `
            SELECT
                (m.분류코드 + m.세부코드) as 자재코드,
                m.분류코드, m.세부코드, m.자재명, m.규격, m.단위,
                m.바코드, m.과세구분, m.적요,
                c.분류명,
                ml.출고단가1, ml.출고단가2, ml.출고단가3
            FROM 자재 m
            LEFT JOIN 자재분류 c ON m.분류코드 = c.분류코드
            LEFT JOIN 자재원장 ml ON m.분류코드 = ml.분류코드 AND m.세부코드 = ml.세부코드 AND ml.사업장코드 = '01'
            WHERE m.사용구분 = 0
        `;

    if (분류코드) {
      query += ` AND m.분류코드 = '${분류코드}'`;
    }

    if (search) {
      query += ` AND (m.자재명 LIKE '%${search}%' OR m.규격 LIKE '%${search}%')`;
    }

    query += ` ORDER BY m.분류코드, m.세부코드`;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('자재 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 자재 상세 조회 (재고 정보 포함)
app.get('/api/materials/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const 분류코드 = code.substring(0, 2);
    const 세부코드 = code.substring(2);

    // 자재 정보
    const material = await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
                SELECT 
                    (m.분류코드 + m.세부코드) as 자재코드,
                    m.*, c.분류명
                FROM 자재 m
                LEFT JOIN 자재분류 c ON m.분류코드 = c.분류코드
                WHERE m.분류코드 = @분류코드 AND m.세부코드 = @세부코드
            `);

    // 자재원장 (재고 정보)
    const ledger = await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
                SELECT * FROM 자재원장
                WHERE 분류코드 = @분류코드 AND 세부코드 = @세부코드
            `);

    if (material.recordset.length > 0) {
      res.json({
        success: true,
        data: {
          material: material.recordset[0],
          ledger: ledger.recordset,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        message: '자재를 찾을 수 없습니다.',
      });
    }
  } catch (err) {
    console.error('자재 상세 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 자재 등록
app.post('/api/materials', async (req, res) => {
  try {
    const { 분류코드, 세부코드, 자재명, 바코드, 규격, 단위, 폐기율, 과세구분, 적요 } = req.body;

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드)
      .input('자재명', sql.VarChar(30), 자재명)
      .input('바코드', sql.VarChar(13), 바코드 || '')
      .input('규격', sql.VarChar(30), 규격 || '')
      .input('단위', sql.VarChar(20), 단위 || '')
      .input('폐기율', sql.Money, 폐기율 || 0)
      .input('과세구분', sql.TinyInt, 과세구분 || 1)
      .input('적요', sql.VarChar(60), 적요 || '')
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
                INSERT INTO 자재 (
                    분류코드, 세부코드, 자재명, 바코드, 규격, 단위,
                    폐기율, 과세구분, 적요, 사용구분, 수정일자, 사용자코드
                ) VALUES (
                    @분류코드, @세부코드, @자재명, @바코드, @규격, @단위,
                    @폐기율, @과세구분, @적요, 0, @수정일자, ''
                )
            `);

    res.json({
      success: true,
      message: '자재가 등록되었습니다.',
    });
  } catch (err) {
    console.error('자재 등록 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 자재 수정
app.put('/api/materials/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const 분류코드 = code.substring(0, 2);
    const 세부코드 = code.substring(2);

    const { 자재명, 바코드, 규격, 단위, 폐기율, 과세구분, 적요 } = req.body;

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드)
      .input('자재명', sql.VarChar(30), 자재명)
      .input('바코드', sql.VarChar(13), 바코드 || '')
      .input('규격', sql.VarChar(30), 규격 || '')
      .input('단위', sql.VarChar(20), 단위 || '')
      .input('폐기율', sql.Money, 폐기율 || 0)
      .input('과세구분', sql.TinyInt, 과세구분 || 1)
      .input('적요', sql.VarChar(60), 적요 || '')
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
                UPDATE 자재 SET
                    자재명 = @자재명,
                    바코드 = @바코드,
                    규격 = @규격,
                    단위 = @단위,
                    폐기율 = @폐기율,
                    과세구분 = @과세구분,
                    적요 = @적요,
                    수정일자 = @수정일자
                WHERE 분류코드 = @분류코드 AND 세부코드 = @세부코드
            `);

    res.json({
      success: true,
      message: '자재가 수정되었습니다.',
    });
  } catch (err) {
    console.error('자재 수정 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 자재 삭제
app.delete('/api/materials/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const 분류코드 = code.substring(0, 2);
    const 세부코드 = code.substring(2);

    await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
                UPDATE 자재 SET 사용구분 = 1
                WHERE 분류코드 = @분류코드 AND 세부코드 = @세부코드
            `);

    res.json({
      success: true,
      message: '자재가 삭제되었습니다.',
    });
  } catch (err) {
    console.error('자재 삭제 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 자재 분류 목록 조회
app.get('/api/material-categories', async (req, res) => {
  try {
    const result = await pool.request().query(`
                SELECT 분류코드, 분류명, 적요
                FROM 자재분류
                WHERE 사용구분 = 0
                ORDER BY 분류코드
            `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error('자재분류 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 재고 현황 조회
app.get('/api/inventory/:workplace', async (req, res) => {
  try {
    const { workplace } = req.params;

    const result = await pool.request().input('사업장코드', sql.VarChar(2), workplace).query(`
                SELECT 
                    (i.분류코드 + i.세부코드) as 자재코드,
                    m.자재명, m.규격, m.단위,
                    SUM(CASE WHEN i.입출고구분 = 1 THEN i.입고수량 ELSE 0 END) as 총입고,
                    SUM(CASE WHEN i.입출고구분 = 2 THEN i.출고수량 ELSE 0 END) as 총출고,
                    SUM(CASE WHEN i.입출고구분 = 1 THEN i.입고수량 ELSE -i.출고수량 END) as 현재고,
                    l.적정재고, l.최저재고,
                    l.최종입고일자, l.최종출고일자
                FROM 자재입출내역 i
                LEFT JOIN 자재 m ON i.분류코드 = m.분류코드 AND i.세부코드 = m.세부코드
                LEFT JOIN 자재원장 l ON i.사업장코드 = l.사업장코드 
                    AND i.분류코드 = l.분류코드 AND i.세부코드 = l.세부코드
                WHERE i.사업장코드 = @사업장코드 AND i.사용구분 = 0
                GROUP BY i.분류코드, i.세부코드, m.자재명, m.규격, m.단위,
                    l.적정재고, l.최저재고, l.최종입고일자, l.최종출고일자
                ORDER BY i.분류코드, i.세부코드
            `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('재고 현황 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// --------------------------
// 거래명세서(Transactions) API 추가 (MS SQL 2008 호환)
// --------------------------

/*
  1) 거래명세서 목록 조회
     - 쿼리는 자재입출내역(i)에서 출고(입출고구분 = 2) 기준으로 그룹화하여 헤더 리스트 반환
     - 입력: startDate (YYYYMMDD), endDate (YYYYMMDD), customerCode (매출처코드, optional)
*/
app.get('/api/transactions', async (req, res) => {
  try {
    // const { startDate, endDate, customerCode } = req.query;

    const { startDate, endDate, customerCode, transactionNo } = req.query;

    // 기본 WHERE 조건 (출고, 사용구분=0)
    // SQL Server 2008에서는 파라미터를 사용해 안전하게 쿼리 실행
    let sqlQuery = `
      SELECT 
        i.입출고일자, i.입출고번호, c.매출처명,
        SUM(i.출고수량 * i.출고단가) AS 공급가액,
        SUM(i.출고부가) AS 부가세,
        SUM(i.출고수량 * i.출고단가) + SUM(i.출고부가) AS 합계금액
      FROM 자재입출내역 i
      LEFT JOIN 매출처 c ON i.매출처코드 = c.매출처코드
      WHERE i.입출고구분 = 2 AND i.사용구분 = 0
    `;

    if (transactionNo) {
      sqlQuery += ` AND i.입출고번호 = @transactionNo`;
    } else {
      if (startDate && endDate) sqlQuery += ` AND i.입출고일자 BETWEEN @startDate AND @endDate`;
      if (customerCode) sqlQuery += ` AND i.매출처코드 = @customerCode`;
    }

    sqlQuery += `
      GROUP BY i.입출고일자, i.입출고번호, c.매출처명
      ORDER BY i.입출고일자 DESC, i.입출고번호 DESC
    `;

    const request = pool.request();
    if (startDate) request.input('startDate', sql.VarChar(8), startDate);
    if (endDate) request.input('endDate', sql.VarChar(8), endDate);
    if (customerCode) request.input('customerCode', sql.VarChar(8), customerCode);
    if (transactionNo) request.input('transactionNo', sql.Int, transactionNo);

    const result = await request.query(sqlQuery);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('거래명세서 조회 오류:', err);
    res.status(500).json({ success: false, message: 'DB 조회 실패' });
  }
});

/*
  2) 거래명세서 상세 조회 (마스터의 날짜,번호로 디테일 조회)
     - 경로: /api/transactions/:date/:no
     - date: YYYYMMDD, no: 입출고번호 (정수 or 실수)
*/
app.get('/api/transactions/:date/:no', async (req, res) => {
  try {
    const { date, no } = req.params;

    const result = await pool
      .request()
      .input('입출고일자', sql.VarChar(8), date)
      .input('입출고번호', sql.Real, parseFloat(no)).query(`
        SELECT 
          i.분류코드, i.세부코드, 
          (i.분류코드 + i.세부코드) AS 자재코드,
          m.자재명, m.규격, m.단위,
          ISNULL(i.출고수량,0) AS 수량,
          ISNULL(i.출고단가,0) AS 단가,
          ISNULL(i.출고수량,0) * ISNULL(i.출고단가,0) AS 공급가액,
          ISNULL(i.출고부가,0) AS 부가세,
          (ISNULL(i.출고수량,0) * ISNULL(i.출고단가,0)) + ISNULL(i.출고부가,0) AS 합계금액,
          i.적요
        FROM 자재입출내역 i
        LEFT JOIN 자재 m ON i.분류코드 = m.분류코드 AND i.세부코드 = m.세부코드
        WHERE i.입출고일자 = @입출고일자 AND i.입출고번호 = @입출고번호
        ORDER BY m.자재명
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('거래명세서 상세 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

/*
  3) 단가 이력 조회 (최근 1년) — 특정 매출처 + 자재코드 기준
     - 쿼리는 BETWEEN을 사용하여 최근 1년 범위로 데이터 조회
     - materialCode는 '분류코드+세부코드' 형태
*/
app.get('/api/transactions/price-history', async (req, res) => {
  try {
    const { customerCode, materialCode } = req.query;
    if (!customerCode || !materialCode) {
      return res
        .status(400)
        .json({ success: false, message: 'customerCode와 materialCode가 필요합니다.' });
    }

    // 오늘 및 1년 전 날짜 계산 (JS에서 YYYYMMDD 문자열로 만든 뒤 파라미터로 전달)
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const startDate = lastYear.toISOString().slice(0, 10).replace(/-/g, '');

    const 분류코드 = materialCode.substring(0, 2);
    const 세부코드 = materialCode.substring(2);

    const result = await pool
      .request()
      .input('startDate', sql.VarChar(8), startDate)
      .input('endDate', sql.VarChar(8), endDate)
      .input('customerCode', sql.VarChar(8), customerCode)
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
        SELECT 
          i.입출고일자, c.매출처명, (i.분류코드 + i.세부코드) AS 자재코드,
          m.자재명, ISNULL(i.출고수량,0) AS 수량, ISNULL(i.출고단가,0) AS 단가
        FROM 자재입출내역 i
        LEFT JOIN 매출처 c ON i.매출처코드 = c.매출처코드
        LEFT JOIN 자재 m ON i.분류코드 = m.분류코드 AND i.세부코드 = m.세부코드
        WHERE i.입출고구분 = 2
          AND i.입출고일자 BETWEEN @startDate AND @endDate
          AND i.매출처코드 = @customerCode
          AND i.분류코드 = @분류코드 AND i.세부코드 = @세부코드
        ORDER BY i.입출고일자 DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('단가 이력 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 세금계산서 발행 API

app.post('/api/taxinvoice/create', async (req, res) => {
  try {
    const { date, no } = req.body;
    if (!date || !no) {
      return res.status(400).json({ success: false, message: '거래명세서 정보가 없습니다.' });
    }

    const tx = await pool
      .request()
      .input('입출고일자', sql.VarChar(8), date)
      .input('입출고번호', sql.Real, parseFloat(no)).query(`
        SELECT TOP 1 i.매출처코드, c.매출처명,
          SUM(i.출고수량 * i.출고단가) AS 공급가액,
          SUM(i.출고부가) AS 세액
        FROM 자재입출내역 i
        LEFT JOIN 매출처 c ON i.매출처코드 = c.매출처코드
        WHERE i.입출고일자 = @입출고일자 AND i.입출고번호 = @입출고번호
        GROUP BY i.매출처코드, c.매출처명
      `);

    const data = tx.recordset[0];
    if (!data)
      return res.status(404).json({ success: false, message: '거래명세서를 찾을 수 없습니다.' });

    const 공급가액 = data.공급가액 || 0;
    const 세액 = data.세액 || 0;
    const 합계 = 공급가액 + 세액;

    // 단순히 세금계산서 테이블에 insert (실무에서는 전자세금계산서 API 연동)
    const invReq = await pool
      .request()
      .input('매출처코드', sql.VarChar(8), data.매출처코드)
      .input('발행일자', sql.VarChar(8), date)
      .input('거래일자', sql.VarChar(8), date)
      .input('공급가액', sql.Decimal(12, 2), 공급가액)
      .input('세액', sql.Decimal(12, 2), 세액)
      .input('합계금액', sql.Decimal(12, 2), 합계).query(`
        INSERT INTO 세금계산서 (매출처코드, 발행일자, 거래일자, 공급가액, 세액, 합계금액)
        OUTPUT INSERTED.세금계산서번호
        VALUES (@매출처코드, @발행일자, @거래일자, @공급가액, @세액, @합계금액)
      `);

    const invoiceNo = invReq.recordset[0].세금계산서번호;
    res.json({ success: true, data: { invoiceNo } });
  } catch (err) {
    console.error('세금계산서 발행 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 거래명세서 인쇄용 데이터 조회
app.get('/api/transactions/:date/:no/print', async (req, res) => {
  try {
    const { date, no } = req.params;
    const resultHeader = await pool
      .request()
      .input('입출고일자', sql.VarChar(8), date)
      .input('입출고번호', sql.Real, parseFloat(no)).query(`
        SELECT TOP 1 i.입출고일자, i.입출고번호, i.매출처코드, c.매출처명,
          SUM(i.출고수량 * i.출고단가) AS 공급가액,
          SUM(i.출고부가) AS 부가세,
          SUM((i.출고수량 * i.출고단가) + i.출고부가) AS 총합계
        FROM 자재입출내역 i
        LEFT JOIN 매출처 c ON i.매출처코드 = c.매출처코드
        WHERE i.입출고일자 = @입출고일자 AND i.입출고번호 = @입출고번호
        GROUP BY i.입출고일자, i.입출고번호, i.매출처코드, c.매출처명
      `);

    const resultDetail = await pool
      .request()
      .input('입출고일자', sql.VarChar(8), date)
      .input('입출고번호', sql.Real, parseFloat(no)).query(`
        SELECT (i.분류코드 + i.세부코드) AS 자재코드, m.자재명, m.규격, m.단위,
          i.출고수량 AS 수량, i.출고단가 AS 단가,
          (i.출고수량 * i.출고단가) AS 공급가액,
          i.출고부가 AS 부가세,
          (i.출고수량 * i.출고단가 + i.출고부가) AS 합계금액
        FROM 자재입출내역 i
        LEFT JOIN 자재 m ON i.분류코드 = m.분류코드 AND i.세부코드 = m.세부코드
        WHERE i.입출고일자 = @입출고일자 AND i.입출고번호 = @입출고번호
      `);

    res.json({
      success: true,
      data: {
        header: resultHeader.recordset[0],
        details: resultDetail.recordset,
      },
    });
  } catch (err) {
    console.error('거래명세서 인쇄 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ==================== 대시보드 통계 API ====================

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const { 사업장코드 } = req.query;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const thisMonth = today.substring(0, 6);

    // 오늘 매출 (출고 기준)
    const todaySales = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드 || '01')
      .input('입출고일자', sql.VarChar(8), today).query(`
                SELECT SUM((출고수량 * 출고단가) + 출고부가) as 매출
                FROM 자재입출내역
                WHERE 사업장코드 = @사업장코드 
                AND 입출고일자 = @입출고일자
                AND 입출고구분 = 2
            `);

    // 이번달 매출
    const monthlySales = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드 || '01')
      .input('년월', sql.VarChar(6), thisMonth).query(`
                SELECT SUM((출고수량 * 출고단가) + 출고부가) as 매출
                FROM 자재입출내역
                WHERE 사업장코드 = @사업장코드 
                AND LEFT(입출고일자, 6) = @년월
                AND 입출고구분 = 2
            `);

    // 재고 건수
    const inventory = await pool.request().input('사업장코드', sql.VarChar(2), 사업장코드 || '01')
      .query(`
                SELECT COUNT(DISTINCT (분류코드 + 세부코드)) as 건수
                FROM 자재입출내역
                WHERE 사업장코드 = @사업장코드
            `);

    res.json({
      success: true,
      data: {
        todaySales: todaySales.recordset[0]?.매출 || 0,
        monthlySales: monthlySales.recordset[0]?.매출 || 0,
        unpaidAmount: 0, // 미수금은 별도 테이블 필요
        inventoryCount: inventory.recordset[0]?.건수 || 0,
      },
    });
  } catch (err) {
    console.error('대시보드 통계 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ==================== 서버 시작 ====================

// 루트 경로
app.get('/', (req, res) => {
  res.json({
    message: '판매관리 시스템 API 서버',
    version: '1.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
      },
      workplaces: 'GET /api/workplaces',
      customers: 'GET /api/customers',
      suppliers: 'GET /api/suppliers',
      dashboard: 'GET /api/dashboard/stats',
    },
  });
});

// 서버 시작 - connectDB()에서 직접 처리하므로 별도 함수 불필요
// (이미 53~63줄에서 connectDB().then(() => app.listen(...))으로 서버 시작)

// 프로세스 종료시 연결 해제
process.on('SIGINT', async () => {
  try {
    await pool.close();
    console.log('데이터베이스 연결 종료');
    process.exit(0);
  } catch (err) {
    console.error('종료 에러:', err);
    process.exit(1);
  }
});

// startServer(); // ❌ 중복 호출 제거 - 이미 53~63줄에서 connectDB()로 서버 시작됨
// app.listen(8000, () => console.log('✅ Server running on http://127.0.0.1:8000')); // ❌ 중복 포트 바인딩 제거

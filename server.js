// server.js - 판매 관리 서버
require('dotenv').config(); // 환경변수 로드

const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = process.env.BASE_PATH || '/sales-management-api';

const path = require('path');

// CORS 설정 - 환경변수에서 허용 도메인 로드
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

// 미들웨어 설정
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션 설정
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24시간
      // 개발 환경: sameSite와 secure 제거하여 크로스 오리진 허용
    },
  }),
);

// 정적 파일을 동적 베이스 경로에서 제공
app.use(BASE_PATH, express.static(path.join(__dirname))); // index.html 및 css/js 제공

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
    enableArithAbort: true,
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
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
      console.log(`✅ Network access available at http://<SERVER_IP>:${PORT}`);
      console.log(`✅ Static files served at: http://localhost:${PORT}${BASE_PATH}/index.html`);
      console.log(`✅ API endpoints at: http://localhost:${PORT}/api/*`);
    });
  })
  .catch((err) => {
    console.error('❌ 서버 기동 중 DB 연결 실패로 종료:', err);
    process.exit(1);
  });

// ==================== 인증 미들웨어 ====================

/**
 * 인증 확인 미들웨어
 * 로그인된 사용자만 API에 접근할 수 있도록 제한
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: '로그인이 필요합니다.',
  });
}

/**
 * 권한 확인 미들웨어
 * @param {string|string[]} allowedRoles - 허용된 권한 (예: 'admin' 또는 ['admin', 'manager'])
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    const userRole = req.session.user.사용자권한;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.',
      });
    }

    next();
  };
}

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

    // 사용자 정보 조회 (비밀번호 및 로그인 상태 포함)
    const userResult = await pool.request().input('사용자코드', sql.VarChar(4), userId).query(`
                SELECT
                    u.사용자코드, u.사용자명, u.사용자권한, u.사업장코드, u.로그인비밀번호,
                    u.로그인여부, u.사용구분, u.시작일시,
                    s.사업장명, s.사업자번호, s.대표자명
                FROM 사용자 u
                LEFT JOIN 사업장 s ON u.사업장코드 = s.사업장코드
                WHERE u.사용자코드 = @사용자코드
                AND u.사용구분 = 0
            `);

    if (userResult.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    const user = userResult.recordset[0];

    // 중복 로그인 체크
    if (user.로그인여부 === 'Y') {
      return res.status(403).json({
        success: false,
        message: '이미 로그인되어 있습니다. 다른 세션에서 로그아웃 후 다시 시도해주세요.',
      });
    }
    const storedPassword = user.로그인비밀번호;
    let isPasswordValid = false;

    // 비밀번호 검증: bcrypt 해시 또는 평문 지원 (하위 호환성)
    if (storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2a$')) {
      // bcrypt 해시된 비밀번호
      isPasswordValid = await bcrypt.compare(password, storedPassword);
    } else {
      // 평문 비밀번호 (레거시 지원)
      isPasswordValid = password === storedPassword;
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      });
    }

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

    // 세션에 사용자 정보 저장
    req.session.user = {
      사용자코드: user.사용자코드,
      사용자명: user.사용자명,
      사용자권한: user.사용자권한,
      사업장코드: user.사업장코드,
      사업장명: user.사업장명,
    };

    console.log('✅ 로그인 성공 - 세션 ID:', req.sessionID);
    console.log('✅ 로그인 성공 - 세션에 사용자 정보 저장:', req.session.user);

    res.json({
      success: true,
      message: '로그인 성공',
      data: {
        사용자코드: user.사용자코드,
        사용자명: user.사용자명,
        사용자권한: user.사용자권한,
        사업장코드: user.사업장코드,
        사업장명: user.사업장명,
      },
    });
  } catch (err) {
    console.error('로그인 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 로그아웃
app.post('/api/auth/logout', async (req, res) => {
  try {
    // 세션에서 사용자 정보 가져오기
    const userId = req.session?.user?.사용자코드 || req.body?.userId;

    if (!userId) {
      // 세션이 없어도 로그아웃 성공 처리 (이미 로그아웃 상태)
      return res.json({
        success: true,
        message: '로그아웃 되었습니다.',
      });
    }

    const 종료일시 = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');

    // 사용자 테이블 업데이트
    await pool
      .request()
      .input('사용자코드', sql.VarChar(4), userId)
      .input('종료일시', sql.VarChar(17), 종료일시).query(`
                UPDATE 사용자
                SET 종료일시 = @종료일시, 로그인여부 = 'N'
                WHERE 사용자코드 = @사용자코드
            `);

    console.log(`✅ 로그아웃 성공 - 사용자코드: ${userId}`);

    // 세션 삭제
    req.session.destroy((err) => {
      if (err) {
        console.error('세션 삭제 에러:', err);
      }
    });

    res.json({
      success: true,
      message: '로그아웃 되었습니다.',
    });
  } catch (err) {
    console.error('로그아웃 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 현재 로그인한 사용자 정보 조회
app.get('/api/auth/me', (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    res.json({
      success: true,
      data: req.session.user,
    });
  } catch (err) {
    console.error('사용자 정보 조회 에러:', err);
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

    // 1. 현재 가장 큰 매출처코드 조회 (영문 접두사별로, 숫자 부분 기준 정렬)
    const query = `
      SELECT TOP 1 매출처코드
      FROM 매출처
      WHERE LEN(매출처코드) = 8
      ORDER BY
        SUBSTRING(매출처코드, 1, 1) DESC,
        CAST(SUBSTRING(매출처코드, 2, 7) AS INT) DESC
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
      // 매출처가 하나도 없으면 Y0000001부터 시작 (영문 1자리 + 숫자 7자리)
      newCode = 'Y0000001';
      console.log('  - 첫 매출처 생성');
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
app.post('/api/customers', requireAuth, async (req, res) => {
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

    // 세션에서 사용자코드 가져오기
    console.log('세션 ID:', req.sessionID);
    console.log('세션 정보:', req.session);
    console.log('세션 사용자:', req.session?.user);
    const 사용자코드 = req.session?.user?.사용자코드;
    console.log('사용자코드:', 사용자코드);

    if (!사용자코드) {
      console.log('❌ 세션에 사용자코드 없음 - 401 반환');
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    console.log('✅ 세션 인증 성공 - 사용자코드:', 사용자코드);

    // 세션에서 사업장코드 가져오기
    const 사업장코드 = req.session?.user?.사업장코드;
    console.log('사업장코드:', 사업장코드);

    // 중복 체크 및 자동 증가 로직
    let 최종매출처코드 = 매출처코드;

    // 1. 중복 확인
    const checkQuery = `
      SELECT COUNT(*) as cnt
      FROM 매출처
      WHERE 사업장코드 = @사업장코드 AND 매출처코드 = @매출처코드
    `;

    const checkResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매출처코드', sql.VarChar(8), 매출처코드)
      .query(checkQuery);

    // 2. 중복이면 다음 코드 자동 생성
    if (checkResult.recordset[0].cnt > 0) {
      console.log('⚠️ 매출처코드 중복 감지 - 자동 증가 처리');

      const maxQuery = `
        SELECT TOP 1 매출처코드
        FROM 매출처
        WHERE 사업장코드 = @사업장코드
          AND LEN(매출처코드) = 4
        ORDER BY
          SUBSTRING(매출처코드, 1, 1) DESC,
          CAST(SUBSTRING(매출처코드, 2, 3) AS INT) DESC
      `;

      const maxResult = await pool.request()
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .query(maxQuery);

      if (maxResult.recordset.length > 0) {
        const lastCode = maxResult.recordset[0].매출처코드;
        let prefix = lastCode.charAt(0); // 영문 부분 (예: "A")
        const numPart = lastCode.substring(1); // 숫자 부분 (예: "999")
        let nextNum = parseInt(numPart) + 1;

        // 숫자가 999를 초과하면 다음 영문자로 변경하고 숫자를 001로 리셋
        if (nextNum > 999) {
          const nextCharCode = prefix.charCodeAt(0) + 1;

          // Z를 넘어가면 A로 돌아감
          if (nextCharCode > 90) { // 'Z'의 ASCII 코드는 90
            prefix = 'A';
          } else {
            prefix = String.fromCharCode(nextCharCode);
          }

          nextNum = 1;
          console.log(`  숫자 999 초과 → 영문 변경: ${lastCode.charAt(0)} → ${prefix}, 숫자 리셋: 001`);
        }

        최종매출처코드 = prefix + String(nextNum).padStart(3, '0');

        console.log(`  기존 코드: ${매출처코드} → 새 코드: ${최종매출처코드}`);
      }
    }

    // 수정일자 (YYYYMMDD 형식)
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('매출처코드', sql.VarChar(8), 최종매출처코드)
      .input('사업장코드', sql.VarChar(2), 사업장코드)
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
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('비고란', sql.VarChar(100), 비고란 || '').query(`
        INSERT INTO 매출처 (
          매출처코드, 사업장코드, 매출처명, 사업자번호, 법인번호, 대표자명, 대표자주민번호,
          개업일자, 우편번호, 주소, 번지, 업태, 업종, 전화번호, 팩스번호,
          은행코드, 계좌번호, 담당자명, 사용구분, 수정일자, 사용자코드, 비고란
        ) VALUES (
          @매출처코드, @사업장코드, @매출처명, @사업자번호, @법인번호, @대표자명, @대표자주민번호,
          @개업일자, @우편번호, @주소, @번지, @업태, @업종, @전화번호, @팩스번호,
          @은행코드, @계좌번호, @담당자명, @사용구분, @수정일자, @사용자코드, @비고란
        )
      `);

    console.log('✅ 매출처 등록 완료 - 매출처코드:', 최종매출처코드);

    res.json({
      success: true,
      message: 최종매출처코드 !== 매출처코드
        ? `매출처가 등록되었습니다. (코드: ${최종매출처코드})`
        : '매출처가 등록되었습니다.',
      data: {
        매출처코드: 최종매출처코드,
      },
    });
  } catch (err) {
    console.error('❌ 매출처 등록 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 매출처 수정
app.put('/api/customers/:code', requireAuth, async (req, res) => {
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

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

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
      .input('사용자코드', sql.VarChar(4), 사용자코드)
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
          사용자코드 = @사용자코드,
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

// 매출처 삭제 (Soft Delete)
app.delete('/api/customers/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('매출처코드', sql.VarChar(8), code)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .query(`
        UPDATE 매출처 SET
          사용구분 = 1,
          사용자코드 = @사용자코드,
          수정일자 = @수정일자
        WHERE 매출처코드 = @매출처코드
      `);

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
      countQuery += ` AND (매입처코드 LIKE @search OR 매입처명 LIKE @search OR 사업자번호 LIKE @search)`;
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
      query += ` AND (매입처코드 LIKE @search OR 매입처명 LIKE @search OR 사업자번호 LIKE @search)`;
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

// 매입처 상세 조회 (REST API 표준)
app.get('/api/suppliers/:code', async (req, res) => {
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

// 매입처 코드 조회 (하위 호환성)
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

// 매입처 신규 등록 (REST API 표준)
app.post('/api/suppliers', requireAuth, async (req, res) => {
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

    console.log('===== 매입처 신규 등록 요청 =====');
    console.log('매입처코드:', 매입처코드);
    console.log('매입처명:', 매입처명);

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    console.log('✅ 세션 인증 성공 - 사용자코드:', 사용자코드);

    // 세션에서 사업장코드 가져오기
    const session사업장코드 = req.session?.user?.사업장코드;
    const 최종사업장코드 = 사업장코드 || session사업장코드;
    console.log('사업장코드:', 최종사업장코드);

    // 중복 체크 및 자동 증가 로직
    let 최종매입처코드 = 매입처코드;

    // 1. 중복 확인
    const checkQuery = `
      SELECT COUNT(*) as cnt
      FROM 매입처
      WHERE 사업장코드 = @사업장코드 AND 매입처코드 = @매입처코드
    `;

    const checkResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 최종사업장코드)
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .query(checkQuery);

    // 2. 중복이면 다음 코드 자동 생성
    if (checkResult.recordset[0].cnt > 0) {
      console.log('⚠️ 매입처코드 중복 감지 - 자동 증가 처리');

      const maxQuery = `
        SELECT TOP 1 매입처코드
        FROM 매입처
        WHERE 사업장코드 = @사업장코드
          AND LEN(매입처코드) = 4
        ORDER BY
          SUBSTRING(매입처코드, 1, 1) DESC,
          CAST(SUBSTRING(매입처코드, 2, 3) AS INT) DESC
      `;

      const maxResult = await pool.request()
        .input('사업장코드', sql.VarChar(2), 최종사업장코드)
        .query(maxQuery);

      if (maxResult.recordset.length > 0) {
        const lastCode = maxResult.recordset[0].매입처코드;
        let prefix = lastCode.charAt(0); // 영문 부분 (예: "A")
        const numPart = lastCode.substring(1); // 숫자 부분 (예: "999")
        let nextNum = parseInt(numPart) + 1;

        // 숫자가 999를 초과하면 다음 영문자로 변경하고 숫자를 001로 리셋
        if (nextNum > 999) {
          const nextCharCode = prefix.charCodeAt(0) + 1;

          // Z를 넘어가면 A로 돌아감
          if (nextCharCode > 90) { // 'Z'의 ASCII 코드는 90
            prefix = 'A';
          } else {
            prefix = String.fromCharCode(nextCharCode);
          }

          nextNum = 1;
          console.log(`  숫자 999 초과 → 영문 변경: ${lastCode.charAt(0)} → ${prefix}, 숫자 리셋: 001`);
        }

        최종매입처코드 = prefix + String(nextNum).padStart(3, '0');

        console.log(`  기존 코드: ${매입처코드} → 새 코드: ${최종매입처코드}`);
      }
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 최종사업장코드)
      .input('매입처코드', sql.VarChar(8), 최종매입처코드)
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
      .input('사용자코드', sql.VarChar(4), 사용자코드)
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

    console.log('✅ 매입처 등록 완료 - 매입처코드:', 최종매입처코드);

    res.json({
      success: true,
      message: 최종매입처코드 !== 매입처코드
        ? `매입처가 등록되었습니다. (코드: ${최종매입처코드})`
        : '매입처가 등록되었습니다.',
      data: {
        매입처코드: 최종매입처코드,
      },
    });
  } catch (err) {
    console.error('매입처 등록 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 매입처 신규 등록 (하위 호환성)
app.post('/api/suppliers_new', requireAuth, async (req, res) => {
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

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

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
      .input('사용자코드', sql.VarChar(4), 사용자코드)
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
app.put('/api/suppliers_edit/:code', requireAuth, async (req, res) => {
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

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

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
      .input('사용자코드', sql.VarChar(4), 사용자코드)
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
                    사용자코드 = @사용자코드,
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

// 매입처 수정 (REST API 표준)
app.put('/api/suppliers/:code', requireAuth, async (req, res) => {
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

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

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
      .input('사용자코드', sql.VarChar(4), 사용자코드)
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
                    사용자코드 = @사용자코드,
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

// 매입처 삭제 (REST API 표준)
app.delete('/api/suppliers/:code', requireAuth, async (req, res) => {
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

// 매입처 삭제 (하위 호환성)
app.delete('/api/suppliers_delete/:code', requireAuth, async (req, res) => {
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
    const { search, 사업장코드, 상태코드, startDate, endDate } = req.query;
    //const startDate = req.query.startDate || req.query.start;
    //const endDate = req.query.endDate || req.query.end;

    let query = `
            SELECT
                q.사업장코드, q.견적일자, q.견적번호, q.매출처코드,
                c.매출처명, q.출고희망일자, q.제목, q.적요, q.상태코드,
                q.수정일자, u.사용자명,
                (SELECT SUM(ISNULL(수량,0) * ISNULL(출고단가,0) + ISNULL(출고부가,0))
                 FROM 견적내역 qd
                 WHERE qd.견적일자 = q.견적일자 AND qd.견적번호 = q.견적번호) AS 합계금액
            FROM 견적 q
            LEFT JOIN 매출처 c ON q.매출처코드 = c.매출처코드
            LEFT JOIN 사용자 u ON q.사용자코드 = u.사용자코드
            WHERE q.사용구분 = 0
        `;

    const request = pool.request();

    if (사업장코드) {
      request.input('사업장코드', sql.VarChar(2), 사업장코드);
      query += ` AND q.사업장코드 = @사업장코드`;
    }

    if (상태코드) {
      request.input('상태코드', sql.Int, parseInt(상태코드));
      query += ` AND q.상태코드 = @상태코드`;
    }

    if (startDate && endDate) {
      request.input('startDate', sql.VarChar(8), startDate);
      request.input('endDate', sql.VarChar(8), endDate);
      query += ` AND q.견적일자 BETWEEN @startDate AND @endDate`;
    }

    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      query += ` AND (c.매출처명 LIKE @search OR q.제목 LIKE @search)`;
    }

    query += ` ORDER BY q.견적일자 DESC, q.견적번호 DESC`;

    const result = await request.query(query);

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
app.post('/api/quotations_add', requireAuth, async (req, res) => {
  const transaction = new sql.Transaction(pool);

  try {
    const { master, details } = req.body;

    // 세션에서 사용자 정보 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    const 사업장코드 = req.session?.user?.사업장코드;

    if (!사용자코드 || !사업장코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    console.log('✅ 견적 등록 - 세션 정보:', { 사용자코드, 사업장코드 });

    // 트랜잭션 시작
    await transaction.begin();

    // 견적번호 생성 (로그 테이블 사용)
    const logResult = await new sql.Request(transaction)
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
    await new sql.Request(transaction)
      .input('사업장코드', sql.VarChar(2), 사업장코드)
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
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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

      await new sql.Request(transaction)
        .input('사업장코드', sql.VarChar(2), 사업장코드)
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
        .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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
      await new sql.Request(transaction)
        .input('테이블명', sql.VarChar(50), '견적')
        .input('베이스코드', sql.VarChar(50), master.견적일자)
        .input('최종로그', sql.Money, 견적번호)
        .input('사용자코드', sql.VarChar(4), 사용자코드)
        .input('수정일자', sql.VarChar(8), 수정일자).query(`
                    UPDATE 로그 SET 최종로그 = @최종로그, 사용자코드 = @사용자코드, 수정일자 = @수정일자
                    WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
                `);
    } else {
      await new sql.Request(transaction)
        .input('테이블명', sql.VarChar(50), '견적')
        .input('베이스코드', sql.VarChar(50), master.견적일자)
        .input('최종로그', sql.Money, 견적번호)
        .input('사용자코드', sql.VarChar(4), 사용자코드)
        .input('수정일자', sql.VarChar(8), 수정일자).query(`
                    INSERT INTO 로그 (테이블명, 베이스코드, 최종로그, 최종로그1, 사용자코드, 수정일자)
                    VALUES (@테이블명, @베이스코드, @최종로그, 0, @사용자코드, @수정일자)
                `);
    }

    // 사용자명 조회
    const userResult = await new sql.Request(transaction)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`SELECT 사용자명 FROM 사용자 WHERE 사용자코드 = @사용자코드`);

    const 사용자명 = userResult.recordset.length > 0 ? userResult.recordset[0].사용자명 : '알 수 없음';

    // 매출처명 조회
    const customerResult = await new sql.Request(transaction)
      .input('매출처코드', sql.VarChar(8), master.매출처코드)
      .query(`SELECT 매출처명 FROM 매출처 WHERE 매출처코드 = @매출처코드`);

    const 매출처명 = customerResult.recordset.length > 0 ? customerResult.recordset[0].매출처명 : '';

    // 트랜잭션 커밋
    await transaction.commit();

    res.json({
      success: true,
      message: '견적이 등록되었습니다.',
      data: {
        견적일자: master.견적일자,
        견적번호,
        사용자코드,
        사용자명,
        매출처코드: master.매출처코드,
        매출처명,
      },
    });
  } catch (err) {
    console.error('견적 등록 에러:', err);

    // 트랜잭션 롤백
    if (transaction._aborted === false) {
      await transaction.rollback();
    }

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
app.delete('/api/quotations/:date/:no', requireAuth, async (req, res) => {
  try {
    const { date, no } = req.params;

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 마스터 삭제 (사용구분 = 1)
    await pool
      .request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Real, parseFloat(no))
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 견적
        SET 사용구분 = 1, 사용자코드 = @사용자코드, 수정일자 = @수정일자
        WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호
      `);

    // 디테일 삭제 (사용구분 = 1)
    await pool
      .request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Real, parseFloat(no))
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 견적내역
        SET 사용구분 = 1, 사용자코드 = @사용자코드, 수정일자 = @수정일자
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
app.put('/api/quotations/:date/:no/approve', requireAuth, async (req, res) => {
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
app.put('/api/quotations/:date/:no', requireAuth, async (req, res) => {
  try {
    const { date, no } = req.params;
    const { 매출처코드, 출고희망일자, 결제방법, 결제예정일자, 유효일수, 제목, 적요 } = req.body;

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

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
      .input('사용자코드', sql.VarChar(4), 사용자코드)
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
          사용자코드 = @사용자코드,
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
app.put('/api/quotations/:date/:no/details', requireAuth, async (req, res) => {
  let transaction;
  try {
    const { date, no } = req.params;
    const details = req.body; // [{ 자재코드, 수량, 출고단가, 금액, ... }]

    if (!Array.isArray(details) || details.length === 0) {
      return res.status(400).json({ success: false, message: '수정할 내역이 없습니다.' });
    }

    // 견적 마스터 정보 조회 (사업장코드, 매출처코드 가져오기)
    const masterResult = await pool
      .request()
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Int, no)
      .query(
        'SELECT 사업장코드, 매출처코드 FROM 견적 WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호',
      );

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
        .input('사용자코드', sql.VarChar(4), '').query(`
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
    const result = await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(18), 세부코드)
      .input('매출처코드', sql.VarChar(8), customerCode).query(`
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
      total: result.recordset.length,
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
    const result = await pool
      .request()
      .input('자재코드', sql.VarChar(18), materialCode)
      .input('매출처코드', sql.VarChar(8), customerCode).query(`
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
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('견적 제안가 이력 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

//------------------------------------------------------------
// ✅ 발주 입고단가 이력 조회 API (자재입출내역 테이블 기반 - 매입처 기준)
// GET /api/materials/:materialCode/purchase-price-history/:supplierCode
//------------------------------------------------------------
app.get('/api/materials/:materialCode/purchase-price-history/:supplierCode', async (req, res) => {
  try {
    const { materialCode, supplierCode } = req.params;

    // 자재코드 분리 (분류코드 2자리 + 세부코드)
    const 분류코드 = materialCode.substring(0, 2);
    const 세부코드 = materialCode.substring(2);

    // 자재입출내역 테이블에서 입고 이력 조회 (최근 10건)
    const result = await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(18), 세부코드)
      .input('매입처코드', sql.VarChar(8), supplierCode).query(`
        SELECT TOP 10
          입출고일자,
          입출고시간,
          입고수량,
          입고단가,
          입고부가,
          (입고수량 * 입고단가) AS 금액,
          적요
        FROM 자재입출내역
        WHERE 분류코드 = @분류코드
          AND 세부코드 = @세부코드
          AND 매입처코드 = @매입처코드
          AND 입출고구분 = 1
          AND 입고수량 > 0
          AND 사용구분 = 0
        ORDER BY 입출고일자 DESC, 입출고시간 DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('입고단가 이력 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

//------------------------------------------------------------
// ✅ 발주 제안가 이력 조회 API (발주내역 테이블 기반 - 매입처 기준)
// GET /api/materials/:materialCode/order-history/:supplierCode
//------------------------------------------------------------
app.get('/api/materials/:materialCode/order-history/:supplierCode', async (req, res) => {
  try {
    const { materialCode, supplierCode } = req.params;

    // 발주내역 + 발주 테이블에서 발주 이력 조회 (최근 10건)
    const result = await pool
      .request()
      .input('자재코드', sql.VarChar(18), materialCode)
      .input('매입처코드', sql.VarChar(8), supplierCode).query(`
        SELECT TOP 10
          o.발주일자,
          o.발주번호,
          od.입고단가,
          od.발주량,
          (od.발주량 * od.입고단가) AS 금액,
          o.상태코드
        FROM 발주내역 od
        INNER JOIN 발주 o ON od.발주일자 = o.발주일자 AND od.발주번호 = o.발주번호
        WHERE od.자재코드 = @자재코드
          AND o.매입처코드 = @매입처코드
          AND od.사용구분 = 0
          AND o.사용구분 = 0
        ORDER BY o.발주일자 DESC, o.발주번호 DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('발주 제안가 이력 조회 에러:', err);
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
                o.수정일자, u.사용자명,
                (SELECT SUM(ISNULL(발주량,0) * ISNULL(입고단가,0))
                 FROM 발주내역 od
                 WHERE od.발주일자 = o.발주일자 AND od.발주번호 = o.발주번호) AS 합계금액
            FROM 발주 o
            LEFT JOIN 매입처 s ON o.매입처코드 = s.매입처코드
            LEFT JOIN 사용자 u ON o.사용자코드 = u.사용자코드
            WHERE o.사용구분 = 0
        `;

    const request = pool.request();

    if (사업장코드) {
      request.input('사업장코드', sql.VarChar(2), 사업장코드);
      query += ` AND o.사업장코드 = @사업장코드`;
    }

    if (상태코드) {
      request.input('상태코드', sql.Int, parseInt(상태코드));
      query += ` AND o.상태코드 = @상태코드`;
    }

    if (startDate && endDate) {
      request.input('startDate', sql.VarChar(8), startDate);
      request.input('endDate', sql.VarChar(8), endDate);
      query += ` AND o.발주일자 BETWEEN @startDate AND @endDate`;
    }

    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      query += ` AND (s.매입처명 LIKE @search OR o.제목 LIKE @search)`;
    }

    query += ` ORDER BY o.발주일자 DESC, o.발주번호 DESC`;

    const result = await request.query(query);

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
                    od.발주일자,
                    od.발주번호,
                    od.발주시간,
                    od.자재코드,
                    od.매입처코드,
                    od.발주량,
                    od.입고단가,
                    od.출고단가,
                    od.사용구분,
                    m.자재명,
                    m.규격,
                    m.단위,
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

// 발주 생성 (마스터 + 디테일)
app.post('/api/orders', async (req, res) => {
  const transaction = new sql.Transaction(pool);

  try {
    const { master, details } = req.body;

    console.log('📝 발주서 저장 요청 받음:', { master, details });

    // 세션 검증 - 견적서와 동일하게 처리
    const 사용자코드 = req.session?.user?.사용자코드;
    const 사업장코드 = req.session?.user?.사업장코드;

    if (!사용자코드 || !사업장코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    // 트랜잭션 시작
    await transaction.begin();

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 1. 발주번호 생성 (로그 테이블에서 최종번호 조회)
    const logResult = await new sql.Request(transaction)
      .input('테이블명', sql.VarChar(20), '발주')
      .input('베이스코드', sql.VarChar(20), master.발주일자).query(`
        SELECT 최종로그
        FROM 로그
        WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
      `);

    let 발주번호 = 1;
    if (logResult.recordset.length > 0) {
      발주번호 = logResult.recordset[0].최종로그 + 1;
    }

    console.log('✅ 발주번호 생성:', { 발주일자: master.발주일자, 발주번호 });

    // 2. 발주 마스터 삽입
    await new sql.Request(transaction)
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('발주일자', sql.VarChar(8), master.발주일자)
      .input('발주번호', sql.Real, 발주번호)
      .input('매입처코드', sql.VarChar(8), master.매입처코드)
      .input('입고희망일자', sql.VarChar(8), master.입고희망일자 || '')
      .input('결제방법', sql.VarChar(20), master.결제방법 || '')
      .input('제목', sql.VarChar(30), master.제목 || '')
      .input('적요', sql.VarChar(50), master.적요 || '')
      .input('상태코드', sql.Int, master.상태코드 || 0)
      .input('사용구분', sql.Int, 0)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        INSERT INTO 발주 (
          사업장코드, 발주일자, 발주번호, 매입처코드, 입고희망일자, 결제방법,
          제목, 적요, 상태코드, 사용구분, 수정일자, 사용자코드
        )
        VALUES (
          @사업장코드, @발주일자, @발주번호, @매입처코드, @입고희망일자, @결제방법,
          @제목, @적요, @상태코드, @사용구분, @수정일자, @사용자코드
        )
      `);

    // 3. 발주 디테일 삽입
    for (let i = 0; i < details.length; i++) {
      const detail = details[i];
      const 발주시간 = new Date()
        .toISOString()
        .replace(/[-:T]/g, '')
        .replace(/\..+/, '')
        .substring(8);

      await new sql.Request(transaction)
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('발주일자', sql.VarChar(8), master.발주일자)
        .input('발주번호', sql.Real, 발주번호)
        .input('발주시간', sql.VarChar(9), 발주시간)
        .input('자재코드', sql.VarChar(18), detail.자재코드)
        .input('매입처코드', sql.VarChar(8), master.매입처코드)
        .input('발주량', sql.Real, detail.발주량 || 0)
        .input('입고단가', sql.Real, detail.입고단가 || 0)
        .input('출고단가', sql.Real, detail.출고단가 || 0)
        .input('상태코드', sql.Int, 0)
        .input('사용구분', sql.Int, 0)
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
          INSERT INTO 발주내역 (
            사업장코드, 발주일자, 발주번호, 발주시간, 자재코드, 매입처코드,
            발주량, 입고단가, 출고단가, 상태코드, 사용구분, 수정일자, 사용자코드
          )
          VALUES (
            @사업장코드, @발주일자, @발주번호, @발주시간, @자재코드, @매입처코드,
            @발주량, @입고단가, @출고단가, @상태코드, @사용구분, @수정일자, @사용자코드
          )
        `);
    }

    // 4. 로그 테이블 업데이트
    if (logResult.recordset.length > 0) {
      await new sql.Request(transaction)
        .input('테이블명', sql.VarChar(50), '발주')
        .input('베이스코드', sql.VarChar(50), master.발주일자)
        .input('최종로그', sql.Money, 발주번호)
        .input('사용자코드', sql.VarChar(4), 사용자코드)
        .input('수정일자', sql.VarChar(8), 수정일자).query(`
          UPDATE 로그
          SET 최종로그 = @최종로그, 사용자코드 = @사용자코드, 수정일자 = @수정일자
          WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
        `);
    } else {
      await new sql.Request(transaction)
        .input('테이블명', sql.VarChar(50), '발주')
        .input('베이스코드', sql.VarChar(50), master.발주일자)
        .input('최종로그', sql.Money, 발주번호)
        .input('사용자코드', sql.VarChar(4), 사용자코드)
        .input('수정일자', sql.VarChar(8), 수정일자).query(`
          INSERT INTO 로그 (테이블명, 베이스코드, 최종로그, 사용자코드, 수정일자)
          VALUES (@테이블명, @베이스코드, @최종로그, @사용자코드, @수정일자)
        `);
    }

    console.log('✅ 발주서 저장 완료:', { 발주일자: master.발주일자, 발주번호 });

    // 사용자명 조회
    const userResult = await new sql.Request(transaction)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`SELECT 사용자명 FROM 사용자 WHERE 사용자코드 = @사용자코드`);

    const 사용자명 = userResult.recordset.length > 0 ? userResult.recordset[0].사용자명 : '알 수 없음';

    // 매입처명 조회
    const supplierResult = await new sql.Request(transaction)
      .input('매입처코드', sql.VarChar(8), master.매입처코드)
      .query(`SELECT 매입처명 FROM 매입처 WHERE 매입처코드 = @매입처코드`);

    const 매입처명 = supplierResult.recordset.length > 0 ? supplierResult.recordset[0].매입처명 : '';

    // 트랜잭션 커밋
    await transaction.commit();

    res.json({
      success: true,
      message: '발주가 생성되었습니다.',
      data: {
        발주일자: master.발주일자,
        발주번호,
        사용자코드,
        사용자명,
        매입처코드: master.매입처코드,
        매입처명,
      },
    });
  } catch (err) {
    // 트랜잭션 롤백
    if (transaction._aborted === false) {
      await transaction.rollback();
    }
    console.error('❌ 발주 생성 에러:', err);
    console.error('에러 상세:', err.message);
    console.error('에러 스택:', err.stack);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 발주 수정 (마스터 + 품목)
app.put('/api/orders/:date/:no', requireAuth, async (req, res) => {
  const transaction = pool.transaction();

  try {
    const { date, no } = req.params;
    const { 입고희망일자, 결제방법, 제목, 적요, 상태코드, details } = req.body;

    console.log('📝 발주 수정 요청:', {
      date,
      no,
      입고희망일자: 입고희망일자,
      입고희망일자길이: 입고희망일자?.length,
      결제방법: 결제방법,
      결제방법길이: 결제방법?.length,
      제목: 제목,
      제목길이: 제목?.length,
      적요: 적요,
      적요길이: 적요?.length,
      상태코드,
      품목수: details?.length
    });

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const 발주시간기본 = Date.now().toString().slice(-9); // 타임스탬프 마지막 9자리

    await transaction.begin();

    // 0. 기존 마스터 정보 조회 (사업장코드, 매입처코드 필요)
    const masterInfo = await transaction
      .request()
      .input('발주일자', sql.VarChar(8), date)
      .input('발주번호', sql.Real, parseFloat(no)).query(`
        SELECT 사업장코드, 매입처코드
        FROM 발주
        WHERE 발주일자 = @발주일자 AND 발주번호 = @발주번호
      `);

    const 사업장코드 = masterInfo.recordset[0]?.사업장코드 || '01';
    const 매입처코드 = masterInfo.recordset[0]?.매입처코드 || '';
    const 사용자코드 = req.session?.user?.사용자코드 || '8080'; // 세션에서 가져오기, 없으면 기본값

    // 1. 마스터 정보 수정
    await transaction
      .request()
      .input('발주일자', sql.VarChar(8), date)
      .input('발주번호', sql.Real, parseFloat(no))
      .input('입고희망일자', sql.VarChar(8), 입고희망일자)
      .input('결제방법', sql.TinyInt, 결제방법 ? parseInt(결제방법) : 0)
      .input('제목', sql.VarChar(30), 제목)
      .input('적요', sql.VarChar(50), 적요)
      .input('상태코드', sql.Int, 상태코드)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 발주
        SET 입고희망일자 = @입고희망일자,
            결제방법 = @결제방법,
            제목 = @제목,
            적요 = @적요,
            상태코드 = @상태코드,
            사용자코드 = @사용자코드,
            수정일자 = @수정일자
        WHERE 발주일자 = @발주일자 AND 발주번호 = @발주번호
      `);

    // 2. 품목 정보가 전달된 경우, 기존 품목 삭제 후 재등록
    if (details && Array.isArray(details)) {
      // 2-1. 기존 품목 삭제
      await transaction
        .request()
        .input('발주일자', sql.VarChar(8), date)
        .input('발주번호', sql.Real, parseFloat(no)).query(`
          DELETE FROM 발주내역
          WHERE 발주일자 = @발주일자 AND 발주번호 = @발주번호
        `);

      // 2-2. 새로운 품목 등록
      for (let i = 0; i < details.length; i++) {
        const detail = details[i];

        // 자재코드 검증 및 문자열 변환 (배열인 경우 첫 번째 값 사용)
        let 자재코드 = detail.자재코드;
        if (Array.isArray(자재코드)) {
          자재코드 = 자재코드[0];
        }
        자재코드 = 자재코드 ? String(자재코드).trim() : '';

        console.log(`🔍 품목 ${i + 1}:`, {
          원본자재코드: detail.자재코드,
          변환된자재코드: 자재코드,
          자재코드길이: 자재코드.length,
          자재코드타입: typeof 자재코드,
          발주량: detail.발주량,
          입고단가: detail.입고단가,
          출고단가: detail.출고단가,
        });

        if (!자재코드 || 자재코드 === '') {
          console.warn('⚠️ 자재코드가 없는 품목 건너뜀:', detail);
          continue;
        }

        // 각 품목마다 고유한 발주시간 생성 (9자리)
        const 발주시간 = (parseInt(발주시간기본) + i).toString().slice(-9);

        await transaction
          .request()
          .input('사업장코드', sql.VarChar(2), 사업장코드)
          .input('발주일자', sql.VarChar(8), date)
          .input('발주번호', sql.Real, parseFloat(no))
          .input('발주시간', sql.VarChar(9), 발주시간)
          .input('자재코드', sql.VarChar(18), 자재코드)
          .input('매입처코드', sql.VarChar(8), 매입처코드)
          .input('발주량', sql.Real, parseFloat(detail.발주량) || 0)
          .input('입고단가', sql.Real, parseFloat(detail.입고단가) || 0)
          .input('출고단가', sql.Real, parseFloat(detail.출고단가) || 0)
          .input('상태코드', sql.Int, 0)
          .input('사용구분', sql.Int, 0)
          .input('수정일자', sql.VarChar(8), 수정일자)
          .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
            INSERT INTO 발주내역 (
              사업장코드, 발주일자, 발주번호, 발주시간, 자재코드, 매입처코드,
              발주량, 입고단가, 출고단가, 상태코드, 사용구분, 수정일자, 사용자코드
            )
            VALUES (
              @사업장코드, @발주일자, @발주번호, @발주시간, @자재코드, @매입처코드,
              @발주량, @입고단가, @출고단가, @상태코드, @사용구분, @수정일자, @사용자코드
            )
          `);
      }

      console.log(`✅ 발주 수정: ${date}-${no}, 품목 ${details.length}건 저장`);
    }

    await transaction.commit();
    res.json({ success: true, message: '발주가 수정되었습니다.' });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      console.error('❌ 롤백 오류 (무시):', rollbackErr.message);
    }
    console.error('❌ 발주 수정 에러:', err);
    console.error('에러 상세:', {
      message: err.message,
      code: err.code,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: `서버 오류: ${err.message}` });
  }
});

// 발주 삭제 (Soft Delete - 사용구분 변경)
app.delete('/api/orders/:date/:no', requireAuth, async (req, res) => {
  const transaction = pool.transaction();

  try {
    const { date, no } = req.params;

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await transaction.begin();

    // 1. 발주 마스터 Soft Delete
    await transaction
      .request()
      .input('발주일자', sql.VarChar(8), date)
      .input('발주번호', sql.Real, parseFloat(no))
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 발주
        SET 사용구분 = 1, 사용자코드 = @사용자코드, 수정일자 = @수정일자
        WHERE 발주일자 = @발주일자 AND 발주번호 = @발주번호
      `);

    // 2. 발주 디테일 Soft Delete
    await transaction
      .request()
      .input('발주일자', sql.VarChar(8), date)
      .input('발주번호', sql.Real, parseFloat(no))
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 발주내역
        SET 사용구분 = 1, 사용자코드 = @사용자코드, 수정일자 = @수정일자
        WHERE 발주일자 = @발주일자 AND 발주번호 = @발주번호
      `);

    await transaction.commit();

    res.json({ success: true, message: '발주가 삭제되었습니다.' });
  } catch (err) {
    await transaction.rollback();
    console.error('발주 삭제 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 자재 리스트
app.get('/api/materials', async (req, res) => {
  try {
    const { search, 분류코드 } = req.query;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    let query = `
            SELECT
                (m.분류코드 + m.세부코드) as 자재코드,
                m.분류코드, m.세부코드, m.자재명, m.규격, m.단위,
                m.바코드, m.과세구분, m.적요,
                c.분류명,
                ml.입고단가1, ml.출고단가1, ml.출고단가2, ml.출고단가3
            FROM 자재 m
            LEFT JOIN 자재분류 c ON m.분류코드 = c.분류코드
            LEFT JOIN 자재원장 ml ON m.분류코드 = ml.분류코드 AND m.세부코드 = ml.세부코드 AND ml.사업장코드 = @사업장코드
            WHERE m.사용구분 = 0
        `;

    const request = pool.request()
      .input('사업장코드', sql.VarChar(2), 사업장코드);

    if (분류코드) {
      request.input('분류코드', sql.VarChar(2), 분류코드);
      query += ` AND m.분류코드 = @분류코드`;
    }

    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      query += ` AND (m.자재명 LIKE @search OR m.규격 LIKE @search)`;
    }

    query += ` ORDER BY m.분류코드, m.세부코드`;

    const result = await request.query(query);

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
app.get('/api/materials/transaction-history', async (req, res) => {
  console.log('🔍 [자재내역조회 API] 호출됨');
  console.log('📥 Query params:', req.query);

  try {
    const { materialCode, startDate, endDate, 입출고구분, supplierCode, customerCode } = req.query;

    if (!materialCode) {
      console.log('❌ 자재코드 누락');
      return res.status(400).json({ success: false, message: '자재코드는 필수입니다.' });
    }

    // materialCode 파싱
    // 자재 테이블: 분류코드(2자) + 세부코드(18자) = 총 20자
    // 예: "0101CODE04489" → 분류코드="01", 세부코드="01CODE04489" 또는 "CODE04489"
    //
    // ⚠️ 데이터 불일치: 세부코드에 "01" 접두사가 있는 경우와 없는 경우가 혼재
    // - VB6.0 버그로 일부 데이터에는 "01CODE04489" (사업장코드 포함)
    // - 일부 데이터에는 "CODE04489" (사업장코드 미포함)
    // 따라서 두 가지 경우를 모두 조회해야 함

    const 분류코드 = materialCode.substring(0, 2);
    const 세부코드 = materialCode.substring(2);
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    console.log('📊 파싱된 코드:', { 사업장코드, 분류코드, 세부코드 });

    let query = `
      SELECT
        t.사업장코드,
        t.분류코드,
        t.세부코드,
        (t.분류코드 + t.세부코드) AS 자재코드,
        m.자재명,
        m.규격,
        m.단위,
        t.입출고구분,
        CASE t.입출고구분
          WHEN 1 THEN '입고'
          WHEN 2 THEN '출고'
          ELSE '기타'
        END AS 입출고구분명,
        t.입출고일자,
        t.거래일자,
        t.거래번호,
        t.입고수량,
        t.입고단가,
        t.입고부가,
        (t.입고수량 * t.입고단가) AS 입고공급가액,
        (t.입고수량 * t.입고단가 + t.입고부가) AS 입고합계,
        t.출고수량,
        t.출고단가,
        t.출고부가,
        (t.출고수량 * t.출고단가) AS 출고공급가액,
        (t.출고수량 * t.출고단가 + t.출고부가) AS 출고합계,
        t.매입처코드,
        s.매입처명,
        t.매출처코드,
        c.매출처명,
        t.적요,
        t.수정일자,
        u.사용자명
      FROM 자재입출내역 t
      LEFT JOIN 자재 m ON t.분류코드 = m.분류코드
        AND t.세부코드 = m.세부코드
      LEFT JOIN 매입처 s ON t.매입처코드 = s.매입처코드
      LEFT JOIN 매출처 c ON t.매출처코드 = c.매출처코드
      LEFT JOIN 사용자 u ON t.사용자코드 = u.사용자코드
      WHERE t.사용구분 = 0
        AND t.사업장코드 = @사업장코드
        AND t.분류코드 = @분류코드
        AND t.세부코드 = @세부코드
    `;

    const request = pool.request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(18), 세부코드);

    // 날짜 필터 (거래일자 기준)
    if (startDate) {
      query += ` AND t.거래일자 >= @startDate`;
      request.input('startDate', sql.VarChar(8), startDate.replace(/-/g, ''));
    }
    if (endDate) {
      query += ` AND t.거래일자 <= @endDate`;
      request.input('endDate', sql.VarChar(8), endDate.replace(/-/g, ''));
    }

    // 입출고구분 필터
    if (입출고구분 && 입출고구분 !== '전체') {
      query += ` AND t.입출고구분 = @입출고구분`;
      request.input('입출고구분', sql.TinyInt, parseInt(입출고구분));
    }

    // 거래처 필터
    if (supplierCode) {
      query += ` AND t.매입처코드 = @supplierCode`;
      request.input('supplierCode', sql.VarChar(8), supplierCode);
    }
    if (customerCode) {
      query += ` AND t.매출처코드 = @customerCode`;
      request.input('customerCode', sql.VarChar(8), customerCode);
    }

    query += ` ORDER BY t.거래일자 DESC, t.거래번호 DESC`;

    console.log('🔄 SQL 쿼리 실행 중...');
    const result = await request.query(query);

    console.log('✅ 조회 성공! 결과:', result.recordset.length, '건');

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });
  } catch (err) {
    console.error('❌ ❌ ❌ 자재내역조회 에러 ❌ ❌ ❌');
    console.error('에러 메시지:', err.message);
    console.error('에러 스택:', err.stack);
    console.error('에러 전체:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});
app.get('/api/materials/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const 분류코드 = code.substring(0, 2);
    const 세부코드 = code.substring(2);

    // 자재 정보
    const material = await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(18), 세부코드).query(`
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
      .input('세부코드', sql.VarChar(18), 세부코드).query(`
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
app.post('/api/materials', requireAuth, async (req, res) => {
  try {
    const { 분류코드, 세부코드, 자재명, 바코드, 규격, 단위, 폐기율, 과세구분, 적요 } = req.body;

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(18), 세부코드)
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
app.put('/api/materials/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const 분류코드 = code.substring(0, 2);
    const 세부코드 = code.substring(2);

    const { 자재명, 바코드, 규격, 단위, 폐기율, 과세구분, 적요 } = req.body;

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(18), 세부코드)
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
app.delete('/api/materials/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const 분류코드 = code.substring(0, 2);
    const 세부코드 = code.substring(2);

    await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(18), 세부코드).query(`
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
// 자재분류 목록 조회
app.get('/api/material-categories', async (req, res) => {
  try {
    const result = await pool.request().query(`
                SELECT 분류코드, 분류명, 적요, 수정일자, 사용자코드
                FROM 자재분류
                WHERE 사용구분 = 0
                ORDER BY 분류코드
            `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('자재분류 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 자재분류 단일 조회
app.get('/api/material-categories/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.request()
      .input('분류코드', sql.VarChar(2), code)
      .query(`
        SELECT 분류코드, 분류명, 적요, 사용구분, 수정일자, 사용자코드
        FROM 자재분류
        WHERE 분류코드 = @분류코드
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '자재분류를 찾을 수 없습니다.' });
    }

    res.json({
      success: true,
      data: result.recordset[0],
    });
  } catch (err) {
    console.error('자재분류 단일 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 자재분류 생성
app.post('/api/material-categories', requireAuth, async (req, res) => {
  try {
    const { 분류코드, 분류명, 적요 } = req.body;
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';

    // 필수 필드 검증
    if (!분류코드 || !분류명) {
      return res.status(400).json({ success: false, message: '분류코드와 분류명은 필수입니다.' });
    }

    // 분류코드 길이 검증 (2자리)
    if (분류코드.length !== 2) {
      return res.status(400).json({ success: false, message: '분류코드는 2자리여야 합니다.' });
    }

    // 중복 체크
    const checkResult = await pool.request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .query('SELECT 분류코드 FROM 자재분류 WHERE 분류코드 = @분류코드');

    if (checkResult.recordset.length > 0) {
      return res.status(409).json({ success: false, message: '이미 존재하는 분류코드입니다.' });
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool.request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('분류명', sql.VarChar(50), 분류명)
      .input('적요', sql.VarChar(100), 적요 || '')
      .input('사용구분', sql.TinyInt, 0)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`
        INSERT INTO 자재분류 (분류코드, 분류명, 적요, 사용구분, 수정일자, 사용자코드)
        VALUES (@분류코드, @분류명, @적요, @사용구분, @수정일자, @사용자코드)
      `);

    res.json({
      success: true,
      message: '자재분류가 등록되었습니다.',
      data: { 분류코드, 분류명, 적요 },
    });
  } catch (err) {
    console.error('자재분류 생성 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 자재분류 수정
app.put('/api/material-categories/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const { 분류명, 적요 } = req.body;
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';

    // 필수 필드 검증
    if (!분류명) {
      return res.status(400).json({ success: false, message: '분류명은 필수입니다.' });
    }

    // 존재 여부 확인
    const checkResult = await pool.request()
      .input('분류코드', sql.VarChar(2), code)
      .query('SELECT 분류코드 FROM 자재분류 WHERE 분류코드 = @분류코드');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '자재분류를 찾을 수 없습니다.' });
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool.request()
      .input('분류코드', sql.VarChar(2), code)
      .input('분류명', sql.VarChar(50), 분류명)
      .input('적요', sql.VarChar(100), 적요 || '')
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`
        UPDATE 자재분류
        SET 분류명 = @분류명,
            적요 = @적요,
            수정일자 = @수정일자,
            사용자코드 = @사용자코드
        WHERE 분류코드 = @분류코드
      `);

    res.json({
      success: true,
      message: '자재분류가 수정되었습니다.',
      data: { 분류코드: code, 분류명, 적요 },
    });
  } catch (err) {
    console.error('자재분류 수정 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 자재분류 삭제 (소프트 삭제)
app.delete('/api/material-categories/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';

    // 존재 여부 확인
    const checkResult = await pool.request()
      .input('분류코드', sql.VarChar(2), code)
      .query('SELECT 분류코드 FROM 자재분류 WHERE 분류코드 = @분류코드 AND 사용구분 = 0');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '자재분류를 찾을 수 없습니다.' });
    }

    // 해당 분류를 사용하는 자재가 있는지 확인
    const materialCheck = await pool.request()
      .input('분류코드', sql.VarChar(2), code)
      .query('SELECT COUNT(*) as cnt FROM 자재 WHERE 분류코드 = @분류코드 AND 사용구분 = 0');

    if (materialCheck.recordset[0].cnt > 0) {
      return res.status(409).json({
        success: false,
        message: `이 분류를 사용하는 자재가 ${materialCheck.recordset[0].cnt}개 있습니다. 삭제할 수 없습니다.`,
      });
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 소프트 삭제
    await pool.request()
      .input('분류코드', sql.VarChar(2), code)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`
        UPDATE 자재분류
        SET 사용구분 = 1,
            수정일자 = @수정일자,
            사용자코드 = @사용자코드
        WHERE 분류코드 = @분류코드
      `);

    res.json({
      success: true,
      message: '자재분류가 삭제되었습니다.',
    });
  } catch (err) {
    console.error('자재분류 삭제 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 자재내역조회 (자재 입출고 이력)

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

    // const { startDate, endDate, customerCode, transactionNo } = req.query;

    // const { startDate, endDate, status } = req.query;

    // 기본 WHERE 조건 (출고, 사용구분=0)
    // SQL Server 2008에서는 파라미터를 사용해 안전하게 쿼리 실행
    // let sqlQuery = `
    //   SELECT
    //     i.입출고일자, i.입출고번호, c.매출처명,
    //     SUM(i.출고수량 * i.출고단가) AS 공급가액,
    //     SUM(i.출고부가) AS 부가세,
    //     SUM(i.출고수량 * i.출고단가) + SUM(i.출고부가) AS 합계금액
    //   FROM 자재입출내역 i
    //   LEFT JOIN 매출처 c ON i.매출처코드 = c.매출처코드
    //   WHERE i.입출고구분 = 2 AND i.사용구분 = 0
    // `;

    // if (transactionNo) {
    //   sqlQuery += ` AND i.입출고번호 = @transactionNo`;
    // } else {
    //   if (startDate && endDate) sqlQuery += ` AND i.입출고일자 BETWEEN @startDate AND @endDate`;
    //   if (customerCode) sqlQuery += ` AND i.매출처코드 = @customerCode`;
    // }

    // sqlQuery += `
    //   GROUP BY i.입출고일자, i.입출고번호, c.매출처명
    //   ORDER BY i.입출고일자 DESC, i.입출고번호 DESC
    // `;

    // const request = pool.request();
    // if (startDate) request.input('startDate', sql.VarChar(8), startDate);
    // if (endDate) request.input('endDate', sql.VarChar(8), endDate);
    // if (customerCode) request.input('customerCode', sql.VarChar(8), customerCode);
    // if (transactionNo) request.input('transactionNo', sql.Int, transactionNo);

    // const result = await request.query(sqlQuery);
    // res.json({ success: true, data: result.recordset });

    const { startDate, endDate, customerCode, transactionNo, status } = req.query;

    let query = `
      SELECT
        t.사업장코드,
        t.거래일자,
        t.거래번호,
        t.입출고구분,
        t.매출처코드,
        c.매출처명,
        SUM(ISNULL(t.입고수량,0) * ISNULL(t.입고단가,0)) AS 입고금액,
        SUM(ISNULL(t.입고부가,0)) AS 입고부가세,
        SUM(ISNULL(t.출고수량,0) * ISNULL(t.출고단가,0)) AS 출고금액,
        SUM(ISNULL(t.출고부가,0)) AS 출고부가세,
        (SUM(ISNULL(t.출고수량,0) * ISNULL(t.출고단가,0)) + SUM(ISNULL(t.출고부가,0))) AS 합계금액,
        (ISNULL(t.거래일자,'') + '-' + CAST(t.거래번호 AS VARCHAR(10))) AS 명세서번호,
        MAX(t.적요) AS 적요,
        MAX(u.사용자명) AS 작성자
      FROM 자재입출내역 t
      LEFT JOIN 매출처 c ON t.매출처코드 = c.매출처코드
      LEFT JOIN 사용자 u ON t.사용자코드 = u.사용자코드
      WHERE t.사용구분 = 0
        AND t.입출고구분 = 2
    `;

    // ✅ 날짜 조건
    if (startDate && endDate) {
      query += ` AND t.거래일자 BETWEEN '${startDate.replace(/-/g, '')}' AND '${endDate.replace(
        /-/g,
        '',
      )}'`;
    } else {
      query += ` AND t.거래일자 >= CONVERT(VARCHAR(8), DATEADD(MONTH, -1, GETDATE()), 112)`;
    }

    // ✅ 매출처 코드 필터
    if (customerCode) {
      query += ` AND t.매출처코드 = '${customerCode}'`;
    }

    // ✅ 명세서번호(거래번호) 필터
    if (transactionNo) {
      query += ` AND CAST(t.거래번호 AS VARCHAR(10)) = '${transactionNo}'`;
    }

    // ✅ 상태 필터 (예: 입출고구분)
    if (status) {
      query += ` AND CAST(t.입출고구분 AS VARCHAR(10)) = '${status}'`;
    }

    query += `
      GROUP BY t.사업장코드, t.거래일자, t.거래번호, t.입출고구분, t.매출처코드, c.매출처명
      ORDER BY t.거래일자 DESC, t.거래번호 ASC
    `;

    // console.log('✅ 거래명세서 조회 쿼리 실행:\n', query);

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('거래명세서 조회 오류:', err);
    res.status(500).json({ success: false, message: 'DB 조회 실패' });
  }
});

// ✅ 거래명세서 상세 조회
app.get('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [작성년도, 책번호, 일련번호] = id.split('-');

    // 🟩 마스터 조회
    const masterQuery = `
      SELECT 
        t.사업장코드,
        t.작성일자 AS 거래일자,
        t.매출처코드,
        c.매출처명,
        SUM(t.공급가액) AS 공급가액,
        SUM(t.세액) AS 세액,
        SUM(t.공급가액 + t.세액) AS 합계금액,
        t.작성구분 AS 상태,
        u.사용자명 AS 작성자
      FROM 매출세금계산서장부 t
      LEFT JOIN 매출처 c ON t.매출처코드 = c.매출처코드
      LEFT JOIN 사용자 u ON t.사용자코드 = u.사용자코드
      WHERE t.작성년도 = '${작성년도}' AND t.책번호 = '${책번호}' AND t.일련번호 = '${일련번호}'
      GROUP BY t.사업장코드, t.작성일자, t.매출처코드, c.매출처명, t.작성구분, u.사용자명
    `;

    const masterResult = await pool.request().query(masterQuery);
    if (masterResult.recordset.length === 0)
      return res.json({ success: false, message: '명세서를 찾을 수 없습니다.' });

    // 🟦 상세 내역 조회
    const detailQuery = `
      SELECT 
        t.품목및규격 AS 품명,
        t.수량,
        t.공급가액 / NULLIF(t.수량, 0) AS 단가,
        t.공급가액,
        t.세액,
        (t.공급가액 + t.세액) AS 합계
      FROM 매출세금계산서장부 t
      WHERE t.작성년도 = '${작성년도}' 
        AND t.책번호 = '${책번호}' 
        AND t.일련번호 = '${일련번호}'
      ORDER BY t.작성일자, t.품목및규격
    `;

    const detailResult = await pool.request().query(detailQuery);

    res.json({
      success: true,
      data: {
        master: masterResult.recordset[0],
        details: detailResult.recordset,
      },
    });
  } catch (err) {
    console.error('거래명세서 상세 조회 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
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
    console.log('거래명세서 상세 조회 요청:', { date, no, noType: typeof no });

    const result = await pool
      .request()
      .input('거래일자', sql.VarChar(8), date)
      .input('거래번호', sql.Real, parseFloat(no)).query(`
        SELECT
          i.분류코드, i.세부코드,
          (i.분류코드 + i.세부코드) AS 자재코드,
          m.자재명, m.규격, m.단위,
          ISNULL(i.출고수량,0) AS 수량,
          ISNULL(i.출고단가,0) AS 단가,
          ISNULL(i.출고수량,0) * ISNULL(i.출고단가,0) AS 공급가액,
          ISNULL(i.출고부가,0) AS 부가세,
          (ISNULL(i.출고수량,0) * ISNULL(i.출고단가,0)) + ISNULL(i.출고부가,0) AS 합계금액,
          i.적요, i.입출고구분, i.매출처코드,
          c.매출처명, u.사용자명
        FROM 자재입출내역 i
        LEFT JOIN 자재 m ON i.분류코드 = m.분류코드 AND i.세부코드 = m.세부코드
        LEFT JOIN 매출처 c ON i.매출처코드 = c.매출처코드
        LEFT JOIN 사용자 u ON i.사용자코드 = u.사용자코드
        WHERE i.거래일자 = @거래일자
          AND i.거래번호 = @거래번호
          AND i.입출고구분 = 2
        ORDER BY m.자재명
      `);

    console.log('거래명세서 상세 조회 결과:', result.recordset.length, '건');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('거래명세서 상세 조회 에러:', err);
    console.error('에러 상세:', err.message, err.stack);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
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
      .input('세부코드', sql.VarChar(18), 세부코드).query(`
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

app.post('/api/taxinvoice/create', requireAuth, async (req, res) => {
  try {
    const { date, no } = req.body;
    if (!date || !no) {
      return res.status(400).json({ success: false, message: '거래명세서 정보가 없습니다.' });
    }

    const tx = await pool
      .request()
      .input('거래일자', sql.VarChar(8), date)
      .input('거래번호', sql.Real, parseFloat(no)).query(`
        SELECT TOP 1 i.매출처코드, c.매출처명,
          SUM(i.출고수량 * i.출고단가) AS 공급가액,
          SUM(i.출고부가) AS 세액
        FROM 자재입출내역 i
        LEFT JOIN 매출처 c ON i.매출처코드 = c.매출처코드
        WHERE i.거래일자 = @거래일자 AND i.거래번호 = @거래번호
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

// ✅ 거래명세서 수정 (자재입출내역 UPDATE)
app.put('/api/transactions/:date/:no', requireAuth, async (req, res) => {
  try {
    const { date: 거래일자, no: 거래번호 } = req.params;
    const { 입출고구분, details } = req.body;
    const 사업장코드 = '01';
    const 사용자코드 = req.session?.user?.사용자코드 || '8080'; // 세션에서 가져오기, 없으면 기본값

    console.log(`✅ 거래명세서 수정 요청: ${거래일자}-${거래번호}`);

    // 유효성 검사
    if (!details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: '최소 1개 이상의 품목이 필요합니다.',
      });
    }

    // 1. 기존 거래명세서 삭제 (거래일자 + 거래번호)
    await pool.request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호))
      .query(`
        DELETE FROM 자재입출내역
        WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호
      `);

    console.log(`✅ 기존 거래명세서 삭제 완료: ${거래일자}-${거래번호}`);

    // 2. 현재 시간 (HHMMSS + 밀리초 3자리 = 9자)
    const now = new Date();
    const 입출고시간 =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0') +
      now.getMilliseconds().toString().padStart(3, '0');

    const 수정일자 = 거래일자;

    // 3. 새로운 상세내역 INSERT
    for (const detail of details) {
      const { 자재코드, 수량, 단가, 매출처코드 } = detail;

      // 자재코드 분리
      const 분류코드 = 자재코드.substring(0, 2);
      const 세부코드 = 자재코드.substring(2);

      const 출고수량 = 수량;
      const 출고단가 = 단가;
      const 출고부가 = Math.round(출고수량 * 출고단가 * 0.1);

      await pool.request()
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('분류코드', sql.VarChar(2), 분류코드)
        .input('세부코드', sql.VarChar(18), 세부코드)
        .input('입출고구분', sql.TinyInt, 입출고구분 || 2)
        .input('입출고일자', sql.VarChar(8), 거래일자)
        .input('입출고시간', sql.VarChar(9), 입출고시간)
        .input('출고수량', sql.Money, 출고수량)
        .input('출고단가', sql.Money, 출고단가)
        .input('출고부가', sql.Money, 출고부가)
        .input('매출처코드', sql.VarChar(8), 매출처코드 || '')
        .input('거래일자', sql.VarChar(8), 거래일자)
        .input('거래번호', sql.Real, parseFloat(거래번호))
        .input('적요', sql.VarChar(50), detail.적요 || '')
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), 사용자코드)
        .query(`
          INSERT INTO 자재입출내역 (
            사업장코드, 분류코드, 세부코드, 입출고구분, 입출고일자, 입출고시간,
            입고수량, 입고단가, 입고부가,
            출고수량, 출고단가, 출고부가,
            매출처코드, 매입처코드,
            거래일자, 거래번호,
            적요, 수정일자, 사용자코드, 사용구분
          ) VALUES (
            @사업장코드, @분류코드, @세부코드, @입출고구분, @입출고일자, @입출고시간,
            0, 0, 0,
            @출고수량, @출고단가, @출고부가,
            @매출처코드, '',
            @거래일자, @거래번호,
            @적요, @수정일자, @사용자코드, 0
          )
        `);
    }

    console.log(`✅ 거래명세서 수정 완료: ${거래일자}-${거래번호} (${details.length}건)`);

    res.json({
      success: true,
      message: '거래명세서가 수정되었습니다.',
      data: {
        거래일자,
        거래번호,
      },
    });
  } catch (err) {
    console.error('❌ 거래명세서 수정 에러:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ✅ 거래명세서 작성 (자재입출내역에 INSERT)
app.post('/api/transactions', async (req, res) => {
  try {
    const { 거래일자, 입출고구분, 매출처코드, 적요, details } = req.body;

    // 세션 검증
    const 사용자코드 = req.session?.user?.사용자코드;
    const 사업장코드 = req.session?.user?.사업장코드;

    if (!사용자코드 || !사업장코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    // 유효성 검사
    if (!거래일자 || !매출처코드 || !details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: '필수 정보가 누락되었습니다.',
      });
    }

    // 거래번호 생성 (로그 테이블 사용)
    const 베이스코드 = 거래일자; // YYYYMMDD
    const 테이블명 = '자재입출내역';

    // 로그 테이블에서 다음 번호 조회 및 업데이트
    const logResult = await pool.request()
      .input('테이블명', sql.VarChar(20), 테이블명)
      .input('베이스코드', sql.VarChar(20), 베이스코드)
      .query(`
        SELECT 최종로그 FROM 로그
        WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
      `);

    let 거래번호;
    if (logResult.recordset.length > 0) {
      거래번호 = logResult.recordset[0].최종로그 + 1;
      await pool.request()
        .input('최종로그', sql.Real, 거래번호)
        .input('테이블명', sql.VarChar(20), 테이블명)
        .input('베이스코드', sql.VarChar(20), 베이스코드)
        .query(`
          UPDATE 로그 SET 최종로그 = @최종로그
          WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
        `);
    } else {
      거래번호 = 1;
      await pool.request()
        .input('테이블명', sql.VarChar(20), 테이블명)
        .input('베이스코드', sql.VarChar(20), 베이스코드)
        .input('최종로그', sql.Real, 거래번호)
        .query(`
          INSERT INTO 로그 (테이블명, 베이스코드, 최종로그)
          VALUES (@테이블명, @베이스코드, @최종로그)
        `);
    }

    // 현재 시간 (HHMMSS + 밀리초 3자리 = 9자)
    const now = new Date();
    const 거래시간 =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0') +
      now.getMilliseconds().toString().padStart(3, '0');

    const 수정일자 = 거래일자;

    // 각 상세내역을 자재입출내역에 INSERT
    for (const detail of details) {
      const { 자재코드, 수량, 단가 } = detail;

      // 자재코드 분리 (분류코드 2자리 + 세부코드 16자리)
      const 분류코드 = 자재코드.substring(0, 2);
      const 세부코드 = 자재코드.substring(2);

      const 출고수량 = 수량;
      const 출고단가 = 단가;
      const 출고부가 = Math.round(출고수량 * 출고단가 * 0.1); // 부가세 10%

      await pool.request()
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('분류코드', sql.VarChar(2), 분류코드)
        .input('세부코드', sql.VarChar(18), 세부코드)
        .input('입출고구분', sql.TinyInt, 입출고구분 || 2) // 기본: 출고
        .input('입출고일자', sql.VarChar(8), 거래일자)
        .input('입출고시간', sql.VarChar(9), 거래시간)
        .input('출고수량', sql.Money, 출고수량)
        .input('출고단가', sql.Money, 출고단가)
        .input('출고부가', sql.Money, 출고부가)
        .input('매출처코드', sql.VarChar(8), 매출처코드)
        .input('거래일자', sql.VarChar(8), 거래일자)
        .input('거래번호', sql.Real, 거래번호)
        .input('적요', sql.VarChar(50), 적요 || '')
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), 사용자코드)
        .query(`
          INSERT INTO 자재입출내역 (
            사업장코드, 분류코드, 세부코드, 입출고구분, 입출고일자, 입출고시간,
            입고수량, 입고단가, 입고부가,
            출고수량, 출고단가, 출고부가,
            매출처코드, 매입처코드,
            거래일자, 거래번호,
            적요, 수정일자, 사용자코드, 사용구분
          ) VALUES (
            @사업장코드, @분류코드, @세부코드, @입출고구분, @입출고일자, @입출고시간,
            0, 0, 0,
            @출고수량, @출고단가, @출고부가,
            @매출처코드, '',
            @거래일자, @거래번호,
            @적요, @수정일자, @사용자코드, 0
          )
        `);
    }

    console.log(`✅ 거래명세서 작성 완료: ${거래일자}-${거래번호} (${details.length}건)`);

    // 사용자명 조회
    const userResult = await pool.request()
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`SELECT 사용자명 FROM 사용자 WHERE 사용자코드 = @사용자코드`);

    const 사용자명 = userResult.recordset.length > 0 ? userResult.recordset[0].사용자명 : '알 수 없음';

    // 매출처명 조회
    const customerResult = await pool.request()
      .input('매출처코드', sql.VarChar(8), 매출처코드)
      .query(`SELECT 매출처명 FROM 매출처 WHERE 매출처코드 = @매출처코드`);

    const 매출처명 = customerResult.recordset.length > 0 ? customerResult.recordset[0].매출처명 : '';

    res.json({
      success: true,
      message: '거래명세서가 작성되었습니다.',
      data: {
        거래일자,
        거래번호,
        명세서번호: `${거래일자}-${거래번호}`,
        사용자코드,
        사용자명,
        매출처코드,
        매출처명,
      },
    });
  } catch (err) {
    console.error('❌ 거래명세서 작성 에러:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ✅ 거래명세서 삭제
app.delete('/api/transactions/:date/:no', requireAuth, async (req, res) => {
  try {
    const { date: 거래일자, no: 거래번호 } = req.params;

    console.log(`✅ 거래명세서 삭제 요청: ${거래일자}-${거래번호}`);

    // 거래명세서 삭제 (자재입출내역에서 해당 거래일자 + 거래번호 삭제)
    const result = await pool.request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호))
      .query(`
        DELETE FROM 자재입출내역
        WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: '거래명세서를 찾을 수 없습니다.',
      });
    }

    console.log(`✅ 거래명세서 삭제 완료: ${거래일자}-${거래번호} (${result.rowsAffected[0]}건)`);

    res.json({
      success: true,
      message: '거래명세서가 삭제되었습니다.',
    });
  } catch (err) {
    console.error('❌ 거래명세서 삭제 에러:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ✅ 거래명세서 확정
app.put('/api/transactions/:date/:no/approve', requireAuth, async (req, res) => {
  try {
    const { date: 거래일자, no: 거래번호 } = req.params;

    console.log(`✅ 거래명세서 확정 요청: ${거래일자}-${거래번호}`);

    // 거래명세서 존재 여부 확인
    const checkResult = await pool.request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호))
      .query(`
        SELECT TOP 1 입출고구분
        FROM 자재입출내역
        WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호
      `);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '거래명세서를 찾을 수 없습니다.',
      });
    }

    // 거래명세서 상태를 확정(2)으로 업데이트
    const result = await pool.request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호))
      .input('입출고구분', sql.Real, 2) // 2 = 확정
      .query(`
        UPDATE 자재입출내역
        SET 입출고구분 = @입출고구분
        WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호
      `);

    console.log(`✅ 거래명세서 확정 완료: ${거래일자}-${거래번호} (${result.rowsAffected[0]}건)`);

    res.json({
      success: true,
      message: '거래명세서가 확정되었습니다.',
    });
  } catch (err) {
    console.error('❌ 거래명세서 확정 에러:', err);
    res.status(500).json({
      success: false,
      message: '거래명세서 확정 중 오류가 발생했습니다.',
    });
  }
});

// ================================
// 매입전표관리 API (Purchase Statements)
// ================================

// ✅ 매입전표 목록 조회 (입고 구분)
app.get('/api/purchase-statements', async (req, res) => {
  try {
    const { startDate, endDate, supplierCode, statementNo, status } = req.query;

    let query = `
      SELECT
        t.사업장코드,
        t.거래일자,
        t.거래번호,
        t.입출고구분,
        t.매입처코드,
        s.매입처명,
        SUM(ISNULL(t.입고수량,0) * ISNULL(t.입고단가,0)) AS 입고금액,
        SUM(ISNULL(t.입고부가,0)) AS 입고부가세,
        (ISNULL(t.거래일자,'') + '-' + CAST(t.거래번호 AS VARCHAR(10))) AS 전표번호,
        MAX(t.적요) AS 적요,
        MAX(u.사용자명) AS 작성자
      FROM 자재입출내역 t
      LEFT JOIN 매입처 s ON t.매입처코드 = s.매입처코드
      LEFT JOIN 사용자 u ON t.사용자코드 = u.사용자코드
      WHERE t.사용구분 = 0
        AND t.입출고구분 = 1
    `;

    // ✅ 날짜 조건
    if (startDate && endDate) {
      query += ` AND t.거래일자 BETWEEN '${startDate.replace(/-/g, '')}' AND '${endDate.replace(
        /-/g,
        '',
      )}'`;
    } else {
      query += ` AND t.거래일자 >= CONVERT(VARCHAR(8), DATEADD(MONTH, -1, GETDATE()), 112)`;
    }

    // ✅ 매입처 코드 필터
    if (supplierCode) {
      query += ` AND t.매입처코드 = '${supplierCode}'`;
    }

    // ✅ 전표번호(거래번호) 필터
    if (statementNo) {
      query += ` AND CAST(t.거래번호 AS VARCHAR(10)) = '${statementNo}'`;
    }

    // ✅ 상태 필터 (예: 입출고구분)
    if (status) {
      query += ` AND CAST(t.입출고구분 AS VARCHAR(10)) = '${status}'`;
    }

    query += `
      GROUP BY t.사업장코드, t.거래일자, t.거래번호, t.입출고구분, t.매입처코드, s.매입처명
      ORDER BY t.거래일자 DESC, t.거래번호 ASC
    `;

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('매입전표 조회 오류:', err);
    res.status(500).json({ success: false, message: 'DB 조회 실패' });
  }
});

// ✅ 매입전표 상세 조회 (날짜 + 번호)
app.get('/api/purchase-statements/:date/:no', async (req, res) => {
  try {
    const { date, no } = req.params;
    console.log('매입전표 상세 조회 요청:', { date, no, noType: typeof no });

    const result = await pool
      .request()
      .input('거래일자', sql.VarChar(8), date)
      .input('거래번호', sql.Real, parseFloat(no)).query(`
        SELECT
          i.분류코드, i.세부코드,
          (i.분류코드 + i.세부코드) AS 자재코드,
          m.자재명, m.규격, m.단위,
          ISNULL(i.입고수량,0) AS 수량,
          ISNULL(i.입고단가,0) AS 단가,
          ISNULL(i.입고수량,0) * ISNULL(i.입고단가,0) AS 공급가액,
          ISNULL(i.입고부가,0) AS 부가세,
          (ISNULL(i.입고수량,0) * ISNULL(i.입고단가,0)) + ISNULL(i.입고부가,0) AS 합계금액,
          i.적요, i.입출고구분, i.매입처코드,
          s.매입처명, u.사용자명
        FROM 자재입출내역 i
        LEFT JOIN 자재 m ON i.분류코드 = m.분류코드 AND i.세부코드 = m.세부코드
        LEFT JOIN 매입처 s ON i.매입처코드 = s.매입처코드
        LEFT JOIN 사용자 u ON i.사용자코드 = u.사용자코드
        WHERE i.거래일자 = @거래일자
          AND i.거래번호 = @거래번호
          AND i.입출고구분 = 1
        ORDER BY m.자재명
      `);

    console.log('매입전표 상세 조회 결과:', result.recordset.length, '건');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('매입전표 상세 조회 에러:', err);
    console.error('에러 상세:', err.message, err.stack);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// ✅ 매입 단가 이력 조회 (최근 1년) — 특정 매입처 + 자재코드 기준
app.get('/api/purchase-statements/price-history', async (req, res) => {
  try {
    const { supplierCode, materialCode } = req.query;
    if (!supplierCode || !materialCode) {
      return res
        .status(400)
        .json({ success: false, message: 'supplierCode와 materialCode가 필요합니다.' });
    }

    // 오늘 및 1년 전 날짜 계산
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const startDate = lastYear.toISOString().slice(0, 10).replace(/-/g, '');

    const 분류코드 = materialCode.substring(0, 2);
    const 세부코드 = materialCode.substring(2);

    const result = await pool
      .request()
      .input('startDate', sql.VarChar(8), startDate)
      .input('endDate', sql.VarChar(8), endDate)
      .input('supplierCode', sql.VarChar(8), supplierCode)
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(18), 세부코드).query(`
        SELECT
          i.입출고일자, s.매입처명, (i.분류코드 + i.세부코드) AS 자재코드,
          m.자재명, ISNULL(i.입고수량,0) AS 수량, ISNULL(i.입고단가,0) AS 단가
        FROM 자재입출내역 i
        LEFT JOIN 매입처 s ON i.매입처코드 = s.매입처코드
        LEFT JOIN 자재 m ON i.분류코드 = m.분류코드 AND i.세부코드 = m.세부코드
        WHERE i.입출고구분 = 1
          AND i.입출고일자 BETWEEN @startDate AND @endDate
          AND i.매입처코드 = @supplierCode
          AND i.분류코드 = @분류코드 AND i.세부코드 = @세부코드
        ORDER BY i.입출고일자 DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('매입 단가 이력 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ✅ 매입전표 작성 (자재입출내역에 INSERT)
app.post('/api/purchase-statements', async (req, res) => {
  try {
    const { 거래일자, 입출고구분, 매입처코드, 적요, details } = req.body;

    // 세션 검증
    const 사용자코드 = req.session?.user?.사용자코드;
    const 사업장코드 = req.session?.user?.사업장코드;

    if (!사용자코드 || !사업장코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    // 유효성 검사
    if (!거래일자 || !매입처코드 || !details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: '필수 정보가 누락되었습니다.',
      });
    }

    // 거래번호 생성 (로그 테이블 사용)
    const 베이스코드 = 거래일자;
    const 테이블명 = '자재입출내역';

    const logResult = await pool.request()
      .input('테이블명', sql.VarChar(20), 테이블명)
      .input('베이스코드', sql.VarChar(20), 베이스코드)
      .query(`
        SELECT 최종로그 FROM 로그
        WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
      `);

    let 거래번호;
    if (logResult.recordset.length > 0) {
      거래번호 = logResult.recordset[0].최종로그 + 1;
      await pool.request()
        .input('최종로그', sql.Real, 거래번호)
        .input('테이블명', sql.VarChar(20), 테이블명)
        .input('베이스코드', sql.VarChar(20), 베이스코드)
        .query(`
          UPDATE 로그 SET 최종로그 = @최종로그
          WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
        `);
    } else {
      거래번호 = 1;
      await pool.request()
        .input('테이블명', sql.VarChar(20), 테이블명)
        .input('베이스코드', sql.VarChar(20), 베이스코드)
        .input('최종로그', sql.Real, 거래번호)
        .query(`
          INSERT INTO 로그 (테이블명, 베이스코드, 최종로그)
          VALUES (@테이블명, @베이스코드, @최종로그)
        `);
    }

    // 현재 시간
    const now = new Date();
    const 거래시간 =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0') +
      now.getMilliseconds().toString().padStart(3, '0');

    const 수정일자 = 거래일자;

    // 💰 합계금액 계산 (미지급금 발생 금액)
    let 총공급가액 = 0;
    let 총부가세 = 0;

    // 1️⃣ 각 상세내역을 자재입출내역에 INSERT
    for (const detail of details) {
      const { 자재코드, 수량, 단가 } = detail;

      const 분류코드 = 자재코드.substring(0, 2);
      const 세부코드 = 자재코드.substring(2);

      const 입고수량 = 수량;
      const 입고단가 = 단가;
      const 입고부가 = Math.round(입고수량 * 입고단가 * 0.1);

      // 합계 누적
      총공급가액 += 입고수량 * 입고단가;
      총부가세 += 입고부가;

      await pool.request()
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('분류코드', sql.VarChar(2), 분류코드)
        .input('세부코드', sql.VarChar(18), 세부코드)
        .input('입출고구분', sql.TinyInt, 입출고구분 || 1) // 기본: 입고
        .input('입출고일자', sql.VarChar(8), 거래일자)
        .input('입출고시간', sql.VarChar(9), 거래시간)
        .input('입고수량', sql.Money, 입고수량)
        .input('입고단가', sql.Money, 입고단가)
        .input('입고부가', sql.Money, 입고부가)
        .input('매입처코드', sql.VarChar(8), 매입처코드)
        .input('거래일자', sql.VarChar(8), 거래일자)
        .input('거래번호', sql.Real, 거래번호)
        .input('적요', sql.VarChar(50), 적요 || '')
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), 사용자코드)
        .query(`
          INSERT INTO 자재입출내역 (
            사업장코드, 분류코드, 세부코드, 입출고구분, 입출고일자, 입출고시간,
            입고수량, 입고단가, 입고부가,
            출고수량, 출고단가, 출고부가,
            매출처코드, 매입처코드,
            거래일자, 거래번호,
            적요, 수정일자, 사용자코드, 사용구분
          ) VALUES (
            @사업장코드, @분류코드, @세부코드, @입출고구분, @입출고일자, @입출고시간,
            @입고수량, @입고단가, @입고부가,
            0, 0, 0,
            '', @매입처코드,
            @거래일자, @거래번호,
            @적요, @수정일자, @사용자코드, 0
          )
        `);
    }

    console.log(`✅ 자재입출내역 작성 완료: ${거래일자}-${거래번호} (${details.length}건)`);

    // 2️⃣ 미지급금내역 자동 생성 (거래일자 기준)
    const 미지급금지급금액 = 총공급가액 + 총부가세;

    await pool.request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .input('미지급금지급일자', sql.VarChar(8), 거래일자)
      .input('미지급금지급시간', sql.VarChar(9), 거래시간)
      .input('미지급금지급금액', sql.Money, 미지급금지급금액)
      .input('결제방법', sql.VarChar(10), '') // 추후 결제 시 업데이트
      .input('만기일자', sql.VarChar(8), '')
      .input('어음번호', sql.VarChar(20), '')
      .input('적요', sql.VarChar(50), `매입전표 ${거래일자}-${거래번호}`)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`
        INSERT INTO 미지급금내역 (
          사업장코드, 매입처코드, 미지급금지급일자, 미지급금지급시간,
          미지급금지급금액, 결제방법, 만기일자, 어음번호, 적요,
          수정일자, 사용자코드
        ) VALUES (
          @사업장코드, @매입처코드, @미지급금지급일자, @미지급금지급시간,
          @미지급금지급금액, @결제방법, @만기일자, @어음번호, @적요,
          @수정일자, @사용자코드
        )
      `);

    console.log(`✅ 미지급금내역 자동 생성: ${매입처코드} - ${미지급금지급금액.toLocaleString()}원`);
    console.log(`✅ 매입전표 작성 완료: ${거래일자}-${거래번호}`);

    // 사용자명 조회
    const userResult = await pool.request()
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`SELECT 사용자명 FROM 사용자 WHERE 사용자코드 = @사용자코드`);

    const 사용자명 = userResult.recordset.length > 0 ? userResult.recordset[0].사용자명 : '알 수 없음';

    // 매입처명 조회
    const supplierResult = await pool.request()
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .query(`SELECT 매입처명 FROM 매입처 WHERE 매입처코드 = @매입처코드`);

    const 매입처명 = supplierResult.recordset.length > 0 ? supplierResult.recordset[0].매입처명 : '';

    res.json({
      success: true,
      message: '매입전표 및 미지급금이 생성되었습니다.',
      data: {
        거래일자,
        거래번호,
        전표번호: `${거래일자}-${거래번호}`,
        미지급금지급금액,
        사용자코드,
        사용자명,
        매입처코드,
        매입처명,
      },
    });
  } catch (err) {
    console.error('❌ 매입전표 작성 에러:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ✅ 매입전표 수정
app.put('/api/purchase-statements/:date/:no', requireAuth, async (req, res) => {
  try {
    const { date: 거래일자, no: 거래번호 } = req.params;
    const { 입출고구분, details } = req.body;
    const 사업장코드 = '01';
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';

    console.log(`✅ 매입전표 수정 요청: ${거래일자}-${거래번호}`);

    // 유효성 검사
    if (!details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: '최소 1개 이상의 품목이 필요합니다.',
      });
    }

    // 1. 기존 매입전표 삭제
    await pool.request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호))
      .query(`
        DELETE FROM 자재입출내역
        WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호
      `);

    console.log(`✅ 기존 매입전표 삭제 완료: ${거래일자}-${거래번호}`);

    // 2. 현재 시간
    const now = new Date();
    const 입출고시간 =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0') +
      now.getMilliseconds().toString().padStart(3, '0');

    const 수정일자 = 거래일자;

    // 3. 새로운 상세내역 INSERT
    for (const detail of details) {
      const { 자재코드, 수량, 단가, 매입처코드 } = detail;

      const 분류코드 = 자재코드.substring(0, 2);
      const 세부코드 = 자재코드.substring(2);

      const 입고수량 = 수량;
      const 입고단가 = 단가;
      const 입고부가 = Math.round(입고수량 * 입고단가 * 0.1);

      await pool.request()
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('분류코드', sql.VarChar(2), 분류코드)
        .input('세부코드', sql.VarChar(18), 세부코드)
        .input('입출고구분', sql.TinyInt, 입출고구분 || 1)
        .input('입출고일자', sql.VarChar(8), 거래일자)
        .input('입출고시간', sql.VarChar(9), 입출고시간)
        .input('입고수량', sql.Money, 입고수량)
        .input('입고단가', sql.Money, 입고단가)
        .input('입고부가', sql.Money, 입고부가)
        .input('매입처코드', sql.VarChar(8), 매입처코드 || '')
        .input('거래일자', sql.VarChar(8), 거래일자)
        .input('거래번호', sql.Real, parseFloat(거래번호))
        .input('적요', sql.VarChar(50), detail.적요 || '')
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), 사용자코드)
        .query(`
          INSERT INTO 자재입출내역 (
            사업장코드, 분류코드, 세부코드, 입출고구분, 입출고일자, 입출고시간,
            입고수량, 입고단가, 입고부가,
            출고수량, 출고단가, 출고부가,
            매출처코드, 매입처코드,
            거래일자, 거래번호,
            적요, 수정일자, 사용자코드, 사용구분
          ) VALUES (
            @사업장코드, @분류코드, @세부코드, @입출고구분, @입출고일자, @입출고시간,
            @입고수량, @입고단가, @입고부가,
            0, 0, 0,
            '', @매입처코드,
            @거래일자, @거래번호,
            @적요, @수정일자, @사용자코드, 0
          )
        `);
    }

    console.log(`✅ 매입전표 수정 완료: ${거래일자}-${거래번호} (${details.length}건)`);

    res.json({
      success: true,
      message: '매입전표가 수정되었습니다.',
      data: {
        거래일자,
        거래번호,
      },
    });
  } catch (err) {
    console.error('❌ 매입전표 수정 에러:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ✅ 매입전표 삭제
app.delete('/api/purchase-statements/:date/:no', requireAuth, async (req, res) => {
  try {
    const { date: 거래일자, no: 거래번호 } = req.params;

    console.log(`✅ 매입전표 삭제 요청: ${거래일자}-${거래번호}`);

    const result = await pool.request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호))
      .query(`
        DELETE FROM 자재입출내역
        WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: '매입전표를 찾을 수 없습니다.',
      });
    }

    console.log(`✅ 매입전표 삭제 완료: ${거래일자}-${거래번호} (${result.rowsAffected[0]}건)`);

    res.json({
      success: true,
      message: '매입전표가 삭제되었습니다.',
    });
  } catch (err) {
    console.error('❌ 매입전표 삭제 에러:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ================================
// 미지급금 관리 API (Accounts Payable)
// ================================

// ✅ 미지급금 내역 조회 (특정 매입처 + 일자)
app.get('/api/accounts-payable', async (req, res) => {
  try {
    const { supplierCode, startDate, endDate } = req.query;

    let query = `
      SELECT
        미지급금지급일자,
        미지급금지급시간,
        매입처코드,
        미지급금지급금액,
        결제방법,
        만기일자,
        어음번호,
        적요,
        사용자코드
      FROM 미지급금내역
      WHERE 사업장코드 = '01'
    `;

    if (supplierCode) {
      query += ` AND 매입처코드 = '${supplierCode}'`;
    }

    if (startDate && endDate) {
      query += ` AND 미지급금지급일자 BETWEEN '${startDate.replace(/-/g, '')}' AND '${endDate.replace(/-/g, '')}'`;
    }

    query += ` ORDER BY 미지급금지급일자 DESC, 미지급금지급시간 DESC`;

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('미지급금 조회 오류:', err);
    res.status(500).json({ success: false, message: 'DB 조회 실패' });
  }
});

// ✅ 미지급금 등록
app.post('/api/accounts-payable', requireAuth, async (req, res) => {
  try {
    const { 매입처코드, 미지급금지급일자, 미지급금지급금액, 결제방법, 만기일자, 어음번호, 적요 } = req.body;
    const 사업장코드 = '01';
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';

    // 유효성 검사
    if (!매입처코드 || !미지급금지급일자 || !미지급금지급금액) {
      return res.status(400).json({
        success: false,
        message: '필수 정보가 누락되었습니다.',
      });
    }

    // 현재 시간
    const now = new Date();
    const 미지급금지급시간 =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0') +
      now.getMilliseconds().toString().padStart(3, '0');

    const 수정일자 = 미지급금지급일자;

    await pool.request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .input('미지급금지급일자', sql.VarChar(8), 미지급금지급일자)
      .input('미지급금지급시간', sql.VarChar(9), 미지급금지급시간)
      .input('미지급금지급금액', sql.Money, 미지급금지급금액)
      .input('결제방법', sql.VarChar(10), 결제방법 || '')
      .input('만기일자', sql.VarChar(8), 만기일자 || '')
      .input('어음번호', sql.VarChar(20), 어음번호 || '')
      .input('적요', sql.VarChar(50), 적요 || '')
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`
        INSERT INTO 미지급금내역 (
          사업장코드, 매입처코드, 미지급금지급일자, 미지급금지급시간,
          미지급금지급금액, 결제방법, 만기일자, 어음번호, 적요,
          수정일자, 사용자코드
        ) VALUES (
          @사업장코드, @매입처코드, @미지급금지급일자, @미지급금지급시간,
          @미지급금지급금액, @결제방법, @만기일자, @어음번호, @적요,
          @수정일자, @사용자코드
        )
      `);

    console.log(`✅ 미지급금 등록 완료: ${매입처코드} - ${미지급금지급금액}원`);

    res.json({
      success: true,
      message: '미지급금이 등록되었습니다.',
      data: {
        매입처코드,
        미지급금지급일자,
        미지급금지급금액,
      },
    });
  } catch (err) {
    console.error('❌ 미지급금 등록 에러:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ✅ 매입처별 미지급 잔액 조회
app.get('/api/accounts-payable/balance/:supplierCode', async (req, res) => {
  try {
    const { supplierCode } = req.params;

    // 1. 총 매입액 계산 (자재입출내역에서 입고 금액)
    const purchaseResult = await pool.request()
      .input('매입처코드', sql.VarChar(8), supplierCode)
      .query(`
        SELECT
          ISNULL(SUM(입고수량 * 입고단가 * 1.1), 0) AS 총매입액
        FROM 자재입출내역
        WHERE 매입처코드 = @매입처코드
          AND 입출고구분 = 1
          AND 사용구분 = 0
      `);

    // 2. 총 지급액 계산 (미지급금내역에서 지급 금액)
    const paymentResult = await pool.request()
      .input('매입처코드', sql.VarChar(8), supplierCode)
      .query(`
        SELECT
          ISNULL(SUM(미지급금지급금액), 0) AS 총지급액
        FROM 미지급금내역
        WHERE 매입처코드 = @매입처코드
      `);

    const 총매입액 = purchaseResult.recordset[0].총매입액;
    const 총지급액 = paymentResult.recordset[0].총지급액;
    const 미지급잔액 = 총매입액 - 총지급액;

    res.json({
      success: true,
      data: {
        매입처코드: supplierCode,
        총매입액,
        총지급액,
        미지급잔액,
      },
    });
  } catch (err) {
    console.error('미지급 잔액 조회 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ================================
// 거래명세서 인쇄 및 기타 API
// ================================

// 거래명세서 인쇄용 데이터 조회
app.get('/api/transactions/:date/:no/print', async (req, res) => {
  try {
    const { date, no } = req.params;
    const resultHeader = await pool
      .request()
      .input('거래일자', sql.VarChar(8), date)
      .input('거래번호', sql.Real, parseFloat(no)).query(`
        SELECT TOP 1 i.거래일자, i.거래번호, i.매출처코드, c.매출처명,
          SUM(i.출고수량 * i.출고단가) AS 공급가액,
          SUM(i.출고부가) AS 부가세,
          SUM((i.출고수량 * i.출고단가) + i.출고부가) AS 총합계
        FROM 자재입출내역 i
        LEFT JOIN 매출처 c ON i.매출처코드 = c.매출처코드
        WHERE i.거래일자 = @거래일자 AND i.거래번호 = @거래번호
        GROUP BY i.거래일자, i.거래번호, i.매출처코드, c.매출처명
      `);

    const resultDetail = await pool
      .request()
      .input('거래일자', sql.VarChar(8), date)
      .input('거래번호', sql.Real, parseFloat(no)).query(`
        SELECT (i.분류코드 + i.세부코드) AS 자재코드, m.자재명, m.규격, m.단위,
          i.출고수량 AS 수량, i.출고단가 AS 단가,
          (i.출고수량 * i.출고단가) AS 공급가액,
          i.출고부가 AS 부가세,
          (i.출고수량 * i.출고단가 + i.출고부가) AS 합계금액
        FROM 자재입출내역 i
        LEFT JOIN 자재 m ON i.분류코드 = m.분류코드 AND i.세부코드 = m.세부코드
        WHERE i.거래일자 = @거래일자 AND i.거래번호 = @거래번호
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

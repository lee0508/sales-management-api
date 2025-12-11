// server.js - 판매 관리 서버
require('dotenv').config(); // 환경변수 로드

const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
// Git Bash converts /path to C:/Program Files/Git/path, so normalize it
let BASE_PATH = process.env.BASE_PATH || '/sales-management-api';
// Fix Git Bash path conversion issue
if (BASE_PATH.includes('Program Files') || BASE_PATH.includes('\\')) {
  BASE_PATH = '/sales-management-api';
}
// Ensure BASE_PATH starts with / and doesn't contain backslashes
BASE_PATH = BASE_PATH.replace(/\\/g, '/');
if (!BASE_PATH.startsWith('/')) {
  BASE_PATH = '/' + BASE_PATH;
}

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

    // 서버 시작 시 모든 사용자 로그아웃 처리 (서버 강제 종료 대응)
    await resetAllLoginStatus();

    return pool;
  } catch (err) {
    console.error('❌ SQL Server 연결 실패:', err);
    throw err;
  }
}

// 서버 시작 시 모든 로그인 상태 초기화
async function resetAllLoginStatus() {
  try {
    const result = await pool.request().query(`
      UPDATE 사용자
      SET 로그인여부 = 'N'
      WHERE 로그인여부 = 'Y'
    `);

    const affectedRows = result.rowsAffected[0];
    if (affectedRows > 0) {
      console.log(`✅ 서버 시작: ${affectedRows}명의 로그인 상태 초기화 완료`);
    } else {
      console.log('✅ 서버 시작: 로그인 중인 사용자 없음');
    }
  } catch (err) {
    console.error('❌ 로그인 상태 초기화 실패:', err);
    // 초기화 실패해도 서버는 계속 실행
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

    // 세션 타임아웃 체커 시작 (5분마다 실행)
    // startSessionTimeoutChecker();
  })
  .catch((err) => {
    console.error('❌ 서버 기동 중 DB 연결 실패로 종료:', err);
    process.exit(1);
  });

// ==================== 세션 타임아웃 체커 ====================

/**
 * 세션 타임아웃 체커
 * 30분 이상 활동이 없는 로그인 사용자를 자동 로그아웃
 */
function startSessionTimeoutChecker() {
  const TIMEOUT_MINUTES = 30; // 타임아웃 시간 (분)
  const CHECK_INTERVAL = 5 * 60 * 1000; // 체크 주기: 5분

  console.log(`✅ 세션 타임아웃 체커 시작 (타임아웃: ${TIMEOUT_MINUTES}분, 체크 주기: 5분)`);

  setInterval(async () => {
    try {
      // 현재 시간에서 30분 전의 타임스탬프 계산
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - TIMEOUT_MINUTES * 60 * 1000);
      const cutoffTimestamp = cutoffTime.toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');

      // 30분 이상 활동이 없는 로그인 사용자 조회
      const result = await pool.request().input('cutoffTime', sql.VarChar(17), cutoffTimestamp)
        .query(`
          SELECT 사용자코드, 사용자명, 마지막활동시간
          FROM 사용자
          WHERE 로그인여부 = 'Y'
            AND 마지막활동시간 IS NOT NULL
            AND 마지막활동시간 < @cutoffTime
        `);

      if (result.recordset.length > 0) {
        const 종료일시 = now.toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');

        // 비활성 사용자 자동 로그아웃
        await pool
          .request()
          .input('cutoffTime', sql.VarChar(17), cutoffTimestamp)
          .input('종료일시', sql.VarChar(17), 종료일시).query(`
            UPDATE 사용자
            SET 종료일시 = @종료일시, 로그인여부 = 'N'
            WHERE 로그인여부 = 'Y'
              AND 마지막활동시간 IS NOT NULL
              AND 마지막활동시간 < @cutoffTime
          `);

        console.log(`⏰ 세션 타임아웃: ${result.recordset.length}명의 사용자 자동 로그아웃`);
        result.recordset.forEach((user) => {
          console.log(
            `   - ${user.사용자명} (${user.사용자코드}), 마지막 활동: ${user.마지막활동시간}`,
          );
        });
      }
    } catch (err) {
      console.error('❌ 세션 타임아웃 체크 에러:', err);
    }
  }, CHECK_INTERVAL);
}

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

    // 로그인 시간 및 마지막 활동 시간 업데이트
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

// Heartbeat - 사용자 활동 상태 업데이트 (비활성화됨)
// app.post('/api/auth/heartbeat', async (req, res) => {
//   try {
//     // 세션에서 사용자 정보 확인
//     if (!req.session.user) {
//       return res.status(401).json({
//         success: false,
//         message: '로그인이 필요합니다.',
//       });
//     }

//     const 사용자코드 = req.session.user.사용자코드;
//     const 마지막활동시간 = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');

//     // 마지막 활동 시간 업데이트
//     await pool
//       .request()
//       .input('사용자코드', sql.VarChar(4), 사용자코드)
//       .input('마지막활동시간', sql.VarChar(17), 마지막활동시간).query(`
//         UPDATE 사용자
//         SET 마지막활동시간 = @마지막활동시간
//         WHERE 사용자코드 = @사용자코드
//       `);

//     res.json({
//       success: true,
//       message: 'Heartbeat received',
//     });
//   } catch (err) {
//     console.error('Heartbeat 에러:', err);
//     res.status(500).json({ success: false, message: '서버 오류' });
//   }
// });

// 강제 로그아웃 (브라우저 종료 시 사용)
app.post('/api/auth/force-logout', async (req, res) => {
  try {
    // sendBeacon은 FormData나 URLSearchParams로 전송됨
    let userId = req.body?.사용자코드 || req.body?.userId;

    // FormData로 전송된 경우 키 이름 확인
    if (!userId && req.body) {
      const keys = Object.keys(req.body);
      if (keys.length > 0) {
        userId = req.body[keys[0]];
      }
    }

    // 세션에서 사용자 정보 확인
    if (!userId && req.session?.user) {
      userId = req.session.user.사용자코드;
    }

    if (!userId) {
      // 사용자 정보가 없어도 성공 처리 (이미 로그아웃 상태일 수 있음)
      return res.json({
        success: true,
        message: '로그아웃 처리되었습니다.',
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

    console.log(`✅ 강제 로그아웃 성공 - 사용자코드: ${userId}`);

    // 세션 삭제
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('세션 삭제 에러:', err);
        }
      });
    }

    res.json({
      success: true,
      message: '강제 로그아웃 되었습니다.',
    });
  } catch (err) {
    console.error('강제 로그아웃 에러:', err);
    // 에러가 발생해도 200 응답 (sendBeacon은 응답을 처리하지 않음)
    res.json({ success: false, message: '서버 오류' });
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

// 매출처 거래내역 조회 (자재입출내역)
app.get('/api/customers/:code/transaction-history', async (req, res) => {
  try {
    const { code } = req.params;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매출처코드', sql.VarChar(8), code).query(`
        SELECT
          k.입출고일자,
          k.거래번호,
          k.입출고구분,
          k.분류코드,
          k.세부코드,
          g.자재명,
          g.규격,
          g.단위,
          k.입고수량,
          k.출고수량,
          k.입고단가,
          k.출고단가,
          k.매입처코드,
          m.매입처명
        FROM [YmhDB].[dbo].[자재입출내역] k
        LEFT JOIN [YmhDB].[dbo].[자재] g
          ON k.분류코드 = g.분류코드
          AND k.세부코드 = g.세부코드
        LEFT JOIN [YmhDB].[dbo].[매입처] m
          ON k.매입처코드 = m.매입처코드
          AND k.사업장코드 = m.사업장코드
        WHERE k.사업장코드 = @사업장코드
          AND k.매출처코드 = @매출처코드
        ORDER BY k.입출고일자 DESC, k.거래번호 DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error('매출처 거래내역 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
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

      const maxResult = await pool
        .request()
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
          if (nextCharCode > 90) {
            // 'Z'의 ASCII 코드는 90
            prefix = 'A';
          } else {
            prefix = String.fromCharCode(nextCharCode);
          }

          nextNum = 1;
          console.log(
            `  숫자 999 초과 → 영문 변경: ${lastCode.charAt(0)} → ${prefix}, 숫자 리셋: 001`,
          );
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
      message:
        최종매출처코드 !== 매출처코드
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
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 매출처 SET
          사용구분 = 9,
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

      const maxResult = await pool
        .request()
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
          if (nextCharCode > 90) {
            // 'Z'의 ASCII 코드는 90
            prefix = 'A';
          } else {
            prefix = String.fromCharCode(nextCharCode);
          }

          nextNum = 1;
          console.log(
            `  숫자 999 초과 → 영문 변경: ${lastCode.charAt(0)} → ${prefix}, 숫자 리셋: 001`,
          );
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
      message:
        최종매입처코드 !== 매입처코드
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
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 매입처 SET
          사용구분 = 9,
          사용자코드 = @사용자코드,
          수정일자 = @수정일자
        WHERE 매입처코드 = @매입처코드
      `);

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
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 매입처 SET
          사용구분 = 9,
          사용자코드 = @사용자코드,
          수정일자 = @수정일자
        WHERE 매입처코드 = @매입처코드
      `);

    res.json({
      success: true,
      message: '매입처가 삭제되었습니다.',
    });
  } catch (err) {
    console.error('매입처 삭제 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ==================== 계정과목 API ====================

// 계정과목 리스트 조회
app.get('/api/accounts', async (req, res) => {
  try {
    const { search = '' } = req.query;

    const request = pool.request();

    let query = `
      SELECT 계정코드, 계정명, 합계시산표연결여부, 적요, 사용구분, 수정일자, 사용자코드
      FROM 계정과목
      WHERE 1=1
    `;

    // 검색어가 있으면 계정명 또는 계정코드로 검색
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      query += ` AND (계정명 LIKE @search OR 계정코드 LIKE @search)`;
    }

    query += ` ORDER BY 계정코드`;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error('❌ /api/accounts 오류:', err);
    res.status(500).json({ success: false, message: '계정과목 조회 실패' });
  }
});

// 계정과목 상세 조회
app.get('/api/accounts/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool
      .request()
      .input('계정코드', sql.VarChar(4), code)
      .query('SELECT * FROM 계정과목 WHERE 계정코드 = @계정코드');

    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0],
      });
    } else {
      res.status(404).json({
        success: false,
        message: '계정과목을 찾을 수 없습니다.',
      });
    }
  } catch (err) {
    console.error('계정과목 상세 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 계정과목 신규 등록
app.post('/api/accounts', requireAuth, async (req, res) => {
  try {
    const { 계정코드, 계정명, 합계시산표연결여부, 적요, 사용구분 } = req.body;

    console.log('===== 계정과목 신규 등록 요청 =====');
    console.log('계정코드:', 계정코드);
    console.log('계정명:', 계정명);

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      console.log('❌ 세션에 사용자코드 없음 - 401 반환');
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    console.log('✅ 세션 인증 성공 - 사용자코드:', 사용자코드);

    // 중복 확인
    const checkResult = await pool
      .request()
      .input('계정코드', sql.VarChar(4), 계정코드)
      .query('SELECT COUNT(*) as cnt FROM 계정과목 WHERE 계정코드 = @계정코드');

    if (checkResult.recordset[0].cnt > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 존재하는 계정코드입니다.',
      });
    }

    // 수정일자 생성 (YYYYMMDD 형식)
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 계정과목 등록
    await pool
      .request()
      .input('계정코드', sql.VarChar(4), 계정코드)
      .input('계정명', sql.VarChar(30), 계정명)
      .input('합계시산표연결여부', sql.VarChar(1), 합계시산표연결여부 || 'Y')
      .input('적요', sql.VarChar(60), 적요 || '')
      .input('사용구분', sql.TinyInt, 사용구분 || 0)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        INSERT INTO 계정과목 (
          계정코드, 계정명, 합계시산표연결여부, 적요, 사용구분, 수정일자, 사용자코드
        ) VALUES (
          @계정코드, @계정명, @합계시산표연결여부, @적요, @사용구분, @수정일자, @사용자코드
        )
      `);

    console.log('✅ 계정과목 등록 성공');

    res.json({
      success: true,
      message: '계정과목이 등록되었습니다.',
      data: { 계정코드 },
    });
  } catch (err) {
    console.error('❌ 계정과목 등록 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 계정과목 수정
app.put('/api/accounts/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const { 계정명, 합계시산표연결여부, 적요, 사용구분 } = req.body;

    console.log('===== 계정과목 수정 요청 =====');
    console.log('계정코드:', code);
    console.log('계정명:', 계정명);

    // 세션에서 사용자코드 가져오기
    const 사용자코드 = req.session?.user?.사용자코드;
    if (!사용자코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    // 수정일자 생성 (YYYYMMDD 형식)
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('계정코드', sql.VarChar(4), code)
      .input('계정명', sql.VarChar(30), 계정명)
      .input('합계시산표연결여부', sql.VarChar(1), 합계시산표연결여부)
      .input('적요', sql.VarChar(60), 적요 || '')
      .input('사용구분', sql.TinyInt, 사용구분)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        UPDATE 계정과목 SET
          계정명 = @계정명,
          합계시산표연결여부 = @합계시산표연결여부,
          적요 = @적요,
          사용구분 = @사용구분,
          수정일자 = @수정일자,
          사용자코드 = @사용자코드
        WHERE 계정코드 = @계정코드
      `);

    console.log('✅ 계정과목 수정 성공');

    res.json({
      success: true,
      message: '계정과목이 수정되었습니다.',
    });
  } catch (err) {
    console.error('❌ 계정과목 수정 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// 계정과목 삭제 (사용구분을 9로 변경)
app.delete('/api/accounts/:code', requireAuth, async (req, res) => {
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
      .input('계정코드', sql.VarChar(4), code)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자).query(`
        UPDATE 계정과목 SET
          사용구분 = 9,
          사용자코드 = @사용자코드,
          수정일자 = @수정일자
        WHERE 계정코드 = @계정코드
      `);

    res.json({
      success: true,
      message: '계정과목이 삭제되었습니다.',
    });
  } catch (err) {
    console.error('계정과목 삭제 에러:', err);
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
                q.수정일자, u.사용자명 as 담당자,
                (SELECT SUM(ISNULL(수량,0) * ISNULL(출고단가,0) + ISNULL(출고부가,0))
                 FROM 견적내역 qd
                 WHERE qd.견적일자 = q.견적일자 AND qd.견적번호 = q.견적번호) AS 견적금액
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

    query += ` ORDER BY q.견적일자 ASC, q.견적번호 ASC`;

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
                    qd.수량,
                    qd.출고단가 as 단가,
                    qd.출고부가 as 부가세,
                    (qd.수량 * qd.출고단가) as 공급가액,
                    (qd.수량 * qd.출고단가 + qd.출고부가) as 합계금액,
                    m.자재명, m.규격, m.단위,
                    s.매입처명
                FROM 견적내역 qd
                LEFT JOIN 자재 m ON qd.자재코드 = (m.분류코드 + m.세부코드)
                LEFT JOIN 매입처 s ON qd.매입처코드 = s.매입처코드
                WHERE qd.견적일자 = @견적일자 AND qd.견적번호 = @견적번호
                AND qd.사용구분 = 0
                ORDER BY qd.견적시간 ASC
            `);

    if (master.recordset.length > 0) {
      res.json({
        success: true,
        data: {
          master: master.recordset[0],
          details: detail.recordset,  // detail -> details로 변경
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

    // ✅ 베이스 시간 생성 (품목별 견적시간을 다르게 부여하기 위해)
    const baseTime = new Date();

    // 디테일 등록
    for (let index = 0; index < details.length; index++) {
      const detail = details[index];

      // ✅ 품목별로 견적시간 생성 (밀리초 증가로 입력 순서 보장)
      const itemTime = new Date(baseTime.getTime() + index);
      const 견적시간 =
        itemTime.getHours().toString().padStart(2, '0') +
        itemTime.getMinutes().toString().padStart(2, '0') +
        itemTime.getSeconds().toString().padStart(2, '0') +
        itemTime.getMilliseconds().toString().padStart(3, '0');

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

    const 사용자명 =
      userResult.recordset.length > 0 ? userResult.recordset[0].사용자명 : '알 수 없음';

    // 매출처명 조회
    const customerResult = await new sql.Request(transaction)
      .input('매출처코드', sql.VarChar(8), master.매출처코드)
      .query(`SELECT 매출처명 FROM 매출처 WHERE 매출처코드 = @매출처코드`);

    const 매출처명 =
      customerResult.recordset.length > 0 ? customerResult.recordset[0].매출처명 : '';

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
          qd.사업장코드, qd.견적일자, qd.견적번호, qd.견적시간,
          qd.자재코드,
          m.분류코드,
          m.세부코드,
          m.자재명, m.규격, m.단위,
          qd.매입처코드, s.매입처명,
          qd.수량, qd.출고단가, qd.출고부가,
          (qd.출고단가 * qd.수량) AS 금액,
          qd.적요, qd.상태코드, qd.사용구분
        FROM 견적내역 qd
        INNER JOIN 자재 m ON qd.자재코드 = m.분류코드 + m.세부코드
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

    // ✅ 베이스 시간 생성 (품목별 견적시간을 다르게 부여하기 위해)
    const baseTime = new Date();

    // 새로운 내역 삽입
    for (let i = 0; i < details.length; i++) {
      const item = details[i];

      // ✅ 품목별로 견적시간 생성 (밀리초 증가로 입력 순서 보장)
      const itemTime = new Date(baseTime.getTime() + i);
      const 견적시간 =
        itemTime.getHours().toString().padStart(2, '0') +
        itemTime.getMinutes().toString().padStart(2, '0') +
        itemTime.getSeconds().toString().padStart(2, '0') +
        itemTime.getMilliseconds().toString().padStart(3, '0');

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

    // 1년 전 날짜 계산 (YYYYMMDD 형식)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const 기준일자 = oneYearAgo.toISOString().slice(0, 10).replace(/-/g, '');

    console.log(`🔍 자재입출내역 조회 - 자재코드: ${materialCode}, 매입처: ${supplierCode}, 기준일자: ${기준일자} 이후`);

    // 자재입출내역 테이블에서 입고 이력 조회 (1년 이내 데이터)
    const result = await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(18), 세부코드)
      .input('매입처코드', sql.VarChar(8), supplierCode)
      .input('기준일자', sql.VarChar(8), 기준일자).query(`
        SELECT
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
          AND 입출고일자 >= @기준일자
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

    // 1년 전 날짜 계산 (YYYYMMDD 형식)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const 기준일자 = oneYearAgo.toISOString().slice(0, 10).replace(/-/g, '');

    console.log(`🔍 발주내역 조회 - 자재코드: ${materialCode}, 매입처: ${supplierCode}, 기준일자: ${기준일자} 이후`);

    // 발주내역 + 발주 테이블에서 발주 이력 조회 (1년 이내 데이터)
    const result = await pool
      .request()
      .input('자재코드', sql.VarChar(18), materialCode)
      .input('매입처코드', sql.VarChar(8), supplierCode)
      .input('기준일자', sql.VarChar(8), 기준일자).query(`
        SELECT
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
          AND o.발주일자 >= @기준일자
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
    const { search, 사업장코드, 상태코드, orderStartDate, orderEndDate } = req.query;

    let query = `
            SELECT
                o.사업장코드, o.발주일자, o.발주번호, o.매입처코드,
                s.매입처명,
                s.대표자명,
                s.전화번호,
                s.팩스번호, o.입고희망일자, o.제목, o.적요, o.상태코드,
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

    // 날짜 필터링 (빈 문자열이 아니고 8자리 숫자인 경우만)
    // if (startDate && endDate && startDate.length === 8 && endDate.length === 8) {
    //   request.input('startDate', sql.VarChar(8), startDate);
    //   request.input('endDate', sql.VarChar(8), endDate);
    //   query += ` AND o.발주일자 BETWEEN @startDate AND @endDate`;
    // }

    if (orderStartDate && orderEndDate) {
      request.input('startDate', sql.VarChar(8), orderStartDate);
      request.input('endDate', sql.VarChar(8), orderEndDate);
      query += ` AND o.발주일자 BETWEEN @startDate AND @endDate`;
    }

    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      query += ` AND (s.매입처명 LIKE @search OR o.제목 LIKE @search)`;
    }

    query += ` ORDER BY o.발주일자 ASC, o.발주번호 ASC`;

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

// ✅ 발주 데이터 진단 API (2025-11-01 ~ 2025-12-03) - 반드시 :date/:no 라우트보다 앞에 위치
app.get('/api/orders-diagnose', async (req, res) => {
  try {
    const diagnostics = [];

    // 1. 발주 마스터에는 있지만 발주내역이 없는 경우
    const orphanOrders = await pool.request().query(`
      SELECT o.발주일자, o.발주번호, o.제목, o.매입처코드,
             (SELECT COUNT(*) FROM 발주내역 od
              WHERE od.발주일자 = o.발주일자 AND od.발주번호 = o.발주번호 AND od.사용구분 = 0) AS 내역수
      FROM 발주 o
      WHERE o.발주일자 BETWEEN '20251101' AND '20251203'
        AND o.사용구분 = 0
        AND NOT EXISTS (
          SELECT 1 FROM 발주내역 od
          WHERE od.발주일자 = o.발주일자 AND od.발주번호 = o.발주번호 AND od.사용구분 = 0
        )
      ORDER BY o.발주일자, o.발주번호
    `);

    // 2. 발주내역에는 있지만 발주 마스터가 없는 경우
    const orphanDetails = await pool.request().query(`
      SELECT DISTINCT od.발주일자, od.발주번호, od.자재코드
      FROM 발주내역 od
      WHERE od.발주일자 BETWEEN '20251101' AND '20251203'
        AND od.사용구분 = 0
        AND NOT EXISTS (
          SELECT 1 FROM 발주 o
          WHERE o.발주일자 = od.발주일자 AND o.발주번호 = od.발주번호 AND o.사용구분 = 0
        )
      ORDER BY od.발주일자, od.발주번호
    `);

    // 3. 매입처코드가 없거나 잘못된 경우
    const invalidSupplier = await pool.request().query(`
      SELECT o.발주일자, o.발주번호, o.매입처코드, o.제목
      FROM 발주 o
      WHERE o.발주일자 BETWEEN '20251101' AND '20251203'
        AND o.사용구분 = 0
        AND (o.매입처코드 IS NULL
             OR NOT EXISTS (SELECT 1 FROM 매입처 s WHERE s.매입처코드 = o.매입처코드))
      ORDER BY o.발주일자, o.발주번호
    `);

    // 4. 자재코드가 없거나 잘못된 경우
    const invalidMaterial = await pool.request().query(`
      SELECT od.발주일자, od.발주번호, od.자재코드
      FROM 발주내역 od
      WHERE od.발주일자 BETWEEN '20251101' AND '20251203'
        AND od.사용구분 = 0
        AND (od.자재코드 IS NULL
             OR NOT EXISTS (SELECT 1 FROM 자재 m WHERE m.분류코드 + m.세부코드 = od.자재코드))
      ORDER BY od.발주일자, od.발주번호
    `);

    // 5. 금액이 음수이거나 발주량이 NULL/음수인 경우 (입고단가 0원은 정상 - 단가 미확정 상태)
    const invalidAmount = await pool.request().query(`
      SELECT od.발주일자, od.발주번호, od.자재코드, od.발주량, od.입고단가,
             (od.발주량 * od.입고단가) AS 금액
      FROM 발주내역 od
      WHERE od.발주일자 BETWEEN '20251101' AND '20251203'
        AND od.사용구분 = 0
        AND (od.발주량 IS NULL OR od.발주량 <= 0
             OR od.입고단가 IS NULL OR od.입고단가 < 0)
      ORDER BY od.발주일자, od.발주번호
    `);

    // 6. 전체 발주 목록 (정상 데이터 확인용)
    const allOrders = await pool.request().query(`
      SELECT o.발주일자, o.발주번호, o.제목, o.매입처코드, s.매입처명, o.상태코드,
             (SELECT COUNT(*) FROM 발주내역 od
              WHERE od.발주일자 = o.발주일자 AND od.발주번호 = o.발주번호 AND od.사용구분 = 0) AS 내역수,
             (SELECT SUM(ISNULL(발주량,0) * ISNULL(입고단가,0))
              FROM 발주내역 od
              WHERE od.발주일자 = o.발주일자 AND od.발주번호 = o.발주번호) AS 합계금액
      FROM 발주 o
      LEFT JOIN 매입처 s ON o.매입처코드 = s.매입처코드
      WHERE o.발주일자 BETWEEN '20251101' AND '20251203'
        AND o.사용구분 = 0
      ORDER BY o.발주일자, o.발주번호
    `);

    res.json({
      success: true,
      period: '2025-11-01 ~ 2025-12-03',
      summary: {
        총발주건수: allOrders.recordset.length,
        마스터없는내역: orphanDetails.recordset.length,
        내역없는마스터: orphanOrders.recordset.length,
        잘못된매입처: invalidSupplier.recordset.length,
        잘못된자재: invalidMaterial.recordset.length,
        잘못된금액: invalidAmount.recordset.length,
      },
      errors: {
        orphanOrders: orphanOrders.recordset,
        orphanDetails: orphanDetails.recordset,
        invalidSupplier: invalidSupplier.recordset,
        invalidMaterial: invalidMaterial.recordset,
        invalidAmount: invalidAmount.recordset,
      },
      allOrders: allOrders.recordset,
    });
  } catch (err) {
    console.error('발주 진단 에러:', err);
    res.status(500).json({ success: false, message: err.message });
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
                    m.분류코드,
                    m.세부코드,
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
                INNER JOIN 자재 m ON od.자재코드 = m.분류코드 + m.세부코드
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

    // ✅ 1. 세션 검증
    const 사용자코드 = req.session?.user?.사용자코드;
    const 사업장코드 = req.session?.user?.사업장코드;

    if (!사용자코드 || !사업장코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    // ✅ 2. 마스터 데이터 유효성 검증
    if (!master.발주일자 || master.발주일자.length !== 8) {
      return res.status(400).json({
        success: false,
        message: '발주일자가 올바르지 않습니다.',
      });
    }

    if (!master.매입처코드) {
      return res.status(400).json({
        success: false,
        message: '매입처를 선택해주세요.',
      });
    }

    if (!master.제목 || master.제목.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '제목을 입력해주세요.',
      });
    }

    // ✅ 3. 품목 데이터 유효성 검증
    if (!details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: '발주 품목을 1개 이상 추가해주세요.',
      });
    }

    // 각 품목 검증
    for (let i = 0; i < details.length; i++) {
      const detail = details[i];

      if (!detail.자재코드) {
        return res.status(400).json({
          success: false,
          message: `${i + 1}번째 품목: 자재코드가 누락되었습니다.`,
        });
      }

      if (detail.발주량 === null || detail.발주량 === undefined || detail.발주량 <= 0) {
        return res.status(400).json({
          success: false,
          message: `${i + 1}번째 품목 (${detail.자재코드}): 발주량은 0보다 커야 합니다.`,
        });
      }

      // 입고단가는 0 이상 (0원은 허용 - 단가 미확정 상태)
      if (detail.입고단가 === null || detail.입고단가 === undefined || detail.입고단가 < 0) {
        return res.status(400).json({
          success: false,
          message: `${i + 1}번째 품목 (${detail.자재코드}): 입고단가는 음수일 수 없습니다.`,
        });
      }

      // 출고단가는 0 이상
      if (detail.출고단가 === null || detail.출고단가 === undefined || detail.출고단가 < 0) {
        return res.status(400).json({
          success: false,
          message: `${i + 1}번째 품목 (${detail.자재코드}): 출고단가는 음수일 수 없습니다.`,
        });
      }
    }

    console.log('✅ 유효성 검증 통과');

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

    const 사용자명 =
      userResult.recordset.length > 0 ? userResult.recordset[0].사용자명 : '알 수 없음';

    // 매입처명 조회
    const supplierResult = await new sql.Request(transaction)
      .input('매입처코드', sql.VarChar(8), master.매입처코드)
      .query(`SELECT 매입처명 FROM 매입처 WHERE 매입처코드 = @매입처코드`);

    const 매입처명 =
      supplierResult.recordset.length > 0 ? supplierResult.recordset[0].매입처명 : '';

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
      품목수: details?.length,
    });

    // ✅ 유효성 검증
    if (!제목 || 제목.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '제목을 입력해주세요.',
      });
    }

    // 품목 데이터 유효성 검증
    if (details && Array.isArray(details)) {
      if (details.length === 0) {
        return res.status(400).json({
          success: false,
          message: '발주 품목을 1개 이상 추가해주세요.',
        });
      }

      // 각 품목 검증
      for (let i = 0; i < details.length; i++) {
        const detail = details[i];
        const 자재코드 = Array.isArray(detail.자재코드) ? detail.자재코드[0] : detail.자재코드;

        if (!자재코드) {
          return res.status(400).json({
            success: false,
            message: `${i + 1}번째 품목: 자재코드가 누락되었습니다.`,
          });
        }

        if (detail.발주량 === null || detail.발주량 === undefined || detail.발주량 <= 0) {
          return res.status(400).json({
            success: false,
            message: `${i + 1}번째 품목 (${자재코드}): 발주량은 0보다 커야 합니다.`,
          });
        }

        // 입고단가는 0 이상 (0원은 허용 - 단가 미확정 상태)
        if (detail.입고단가 === null || detail.입고단가 === undefined || detail.입고단가 < 0) {
          return res.status(400).json({
            success: false,
            message: `${i + 1}번째 품목 (${자재코드}): 입고단가는 음수일 수 없습니다.`,
          });
        }

        // 출고단가는 0 이상
        if (detail.출고단가 === null || detail.출고단가 === undefined || detail.출고단가 < 0) {
          return res.status(400).json({
            success: false,
            message: `${i + 1}번째 품목 (${자재코드}): 출고단가는 음수일 수 없습니다.`,
          });
        }
      }
    }

    console.log('✅ 유효성 검증 통과');

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
    const { search, 분류코드, includeDeleted, searchByCode, searchByName, searchBySpec, searchCode, searchName, searchSpec } =
      req.query;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    // includeDeleted=true면 사용구분 0과 9 모두 조회, 아니면 0만 조회
    const 사용구분조건 = includeDeleted === 'true' ? 'IN (0, 9)' : '= 0';

    let query = `
            SELECT
                (m.분류코드+m.세부코드) as 자재코드,
                m.분류코드, m.세부코드, m.자재명, m.규격, m.단위,
                m.바코드, m.과세구분, m.적요, m.사용구분,
                c.분류명,
                ml.입고단가1, ml.출고단가1, ml.출고단가2, ml.출고단가3
            FROM 자재 m
            LEFT JOIN 자재분류 c ON m.분류코드 = c.분류코드
            LEFT JOIN 자재원장 ml ON m.분류코드 = ml.분류코드 AND m.세부코드 = ml.세부코드 AND ml.사업장코드 = @사업장코드
            WHERE m.사용구분 ${사용구분조건}
        `;

    const request = pool.request().input('사업장코드', sql.VarChar(2), 사업장코드);

    if (분류코드) {
      request.input('분류코드', sql.VarChar(2), 분류코드);
      query += ` AND m.분류코드 = @분류코드`;
    }

    // 새로운 방식: 개별 필드 검색 (searchCode, searchName, searchSpec)
    if (searchCode || searchName || searchSpec) {
      const searchConditions = [];

      if (searchCode) {
        request.input('searchCode', sql.NVarChar, `%${searchCode}%`);
        searchConditions.push('(m.분류코드+m.세부코드) LIKE @searchCode');
      }
      if (searchName) {
        request.input('searchName', sql.NVarChar, `%${searchName}%`);
        searchConditions.push('m.자재명 LIKE @searchName');
      }
      if (searchSpec) {
        request.input('searchSpec', sql.NVarChar, `%${searchSpec}%`);
        searchConditions.push('m.규격 LIKE @searchSpec');
      }

      query += ` AND (${searchConditions.join(' AND ')})`;
      console.log(`🔍 자재 개별 필드 검색:`, {
        자재코드: searchCode || '',
        자재명: searchName || '',
        규격: searchSpec || '',
      });
    }
    // 기존 방식: 단일 검색어 + 체크박스 (하위 호환성)
    else if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);

      // 검색 조건이 명시된 경우 (체크박스 사용)
      if (searchByCode !== undefined || searchByName !== undefined || searchBySpec !== undefined) {
        const searchConditions = [];

        if (searchByCode === 'true') {
          searchConditions.push('(m.분류코드+m.세부코드) LIKE @search');
        }
        if (searchByName === 'true') {
          searchConditions.push('m.자재명 LIKE @search');
        }
        if (searchBySpec === 'true') {
          searchConditions.push('m.규격 LIKE @search');
        }

        if (searchConditions.length > 0) {
          query += ` AND (${searchConditions.join(' OR ')})`;
          console.log(`🔍 자재 검색 조건:`, {
            검색어: search,
            자재코드: searchByCode === 'true',
            자재명: searchByName === 'true',
            규격: searchBySpec === 'true',
          });
        }
      } else {
        // 기본 검색 (하위 호환성 - 자재명과 규격만)
        query += ` AND (m.자재명 LIKE @search OR m.규격 LIKE @search)`;
      }
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

    const request = pool
      .request()
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
      total: result.recordset.length,
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

// 자재 삭제 (Soft Delete)
app.delete('/api/materials/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const 분류코드 = code.substring(0, 2);
    const 세부코드 = code.substring(2);

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';

    await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(18), 세부코드)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
                UPDATE 자재 SET
                  사용구분 = 9,
                  수정일자 = @수정일자,
                  사용자코드 = @사용자코드
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

// 자재 상세 조회 (매입처, 단가, 입출고 이력 포함)
app.get('/api/materials/:code/detail', async (req, res) => {
  try {
    const { code } = req.params;
    const 분류코드 = code.substring(0, 2);
    const 세부코드 = code.substring(2);
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    // 1. 자재 기본 정보
    const materialResult = await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
        SELECT
          m.분류코드, m.세부코드,
          (m.분류코드 + m.세부코드) AS 자재코드,
          m.자재명, m.바코드, m.규격, m.단위,
          m.폐기율, m.과세구분, m.적요,
          m.사용구분, m.수정일자, m.사용자코드,
          c.분류명
        FROM 자재 m
        LEFT JOIN 자재분류 c ON m.분류코드 = c.분류코드
        WHERE m.분류코드 = @분류코드 AND m.세부코드 = @세부코드
      `);

    if (materialResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '자재를 찾을 수 없습니다.' });
    }

    const material = materialResult.recordset[0];

    // 2. 자재시세 (매입처별 단가, 마진율)
    const priceResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
        SELECT
          s.사업장코드,
          s.분류코드,
          s.세부코드,
          (s.분류코드 + s.세부코드) AS 자재코드,
          m.분류코드,
          m.세부코드,
          m.자재명,
          m.규격,
          m.단위,
          s.매입처코드,
          p.매입처명,
          s.적용일자,
          s.입고단가,
          s.입고부가,
          s.출고단가,
          s.출고부가,
          s.마진율,
          s.수정일자
        FROM 자재시세 s
        LEFT JOIN 자재 m 
          ON s.분류코드 = m.분류코드 
          AND s.세부코드 = m.세부코드
        LEFT JOIN 매입처 p 
          ON s.매입처코드 = p.매입처코드 
          AND s.사업장코드 = p.사업장코드
        WHERE s.사업장코드 = @사업장코드
          AND s.분류코드 = @분류코드
          AND s.세부코드 = @세부코드
          AND s.사용구분 = 0
        ORDER BY s.적용일자 DESC, s.매입처코드
      `);

    // 3. 자재원장 (실제 단가, 재고 정보)
    const ledgerResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
        SELECT
          l.사업장코드,
          l.분류코드,
          l.세부코드,          
          m.분류코드,
          m.세부코드,
          m.자재명,
          m.규격,
          m.단위,
          l.적정재고,
          l.최저재고,
          l.최종입고일자,
          l.최종출고일자,
          l.비고란,
          l.주매입처코드,
          p.매입처명 AS 주매입처명,
          l.입고단가1,
          l.입고단가2,
          l.입고단가3,
          l.출고단가1,
          l.출고단가2,
          l.출고단가3
        FROM 자재원장 l
        LEFT JOIN 매입처 p 
          ON l.주매입처코드 = p.매입처코드
          AND l.사업장코드 = p.사업장코드
        LEFT JOIN 자재 m 
          ON l.분류코드 = m.분류코드 
          AND l.세부코드 = m.세부코드
        WHERE l.사업장코드 = @사업장코드
          AND l.분류코드 = @분류코드
          AND l.세부코드 = @세부코드
      `);

    const ledger = ledgerResult.recordset[0] || null;

    // 4. 자재입출내역 (최근 20건)
    const transactionResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
        SELECT TOP 20
          t.사업장코드,
          t.분류코드,
          t.세부코드,
          (t.분류코드 + t.세부코드) AS 자재코드,
          m.분류코드,
          m.세부코드,
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
          t.출고수량,
          t.출고단가,
          t.출고부가,
          (t.출고수량 * t.출고단가) AS 출고공급가액,
          t.매입처코드,
          t.매출처코드,
          CASE
            WHEN t.입출고구분 = 1 THEN p.매입처명
            WHEN t.입출고구분 = 2 THEN c.매출처명
            ELSE ''
          END AS 거래처명,
          t.적요
        FROM 자재입출내역 t
        LEFT JOIN 매입처 p 
          ON t.매입처코드 = p.매입처코드 
          AND t.사업장코드 = p.사업장코드
        LEFT JOIN 매출처 c 
          ON t.매출처코드 = c.매출처코드 
          AND t.사업장코드 = c.사업장코드
        LEFT JOIN 자재 m 
          ON t.분류코드 = m.분류코드 
          AND t.세부코드 = m.세부코드
        WHERE t.사업장코드 = @사업장코드
          AND t.분류코드 = @분류코드
          AND t.세부코드 = @세부코드
          AND t.사용구분 = 0
        ORDER BY t.입출고일자 DESC, t.거래일자 DESC, t.거래번호 DESC
      `);

    // console.log('transactionResult.recordset', transactionResult.recordset);

    res.json({
      success: true,
      data: {
        material,
        prices: priceResult.recordset,
        ledger,
        transactions: transactionResult.recordset,
      },
    });
  } catch (err) {
    console.error('자재 상세 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// ================================================================
// 자재 분석 API (자재코드_재고정보_포함_조회.sql 기반)
// ================================================================

// 1. 자재 재고 분석 API
app.get('/api/materials/:code/inventory-analysis', async (req, res) => {
  const { code } = req.params;
  const 분류코드 = code.substring(0, 2);
  const 세부코드 = code.substring(2);
  const 사업장코드 = req.session?.user?.사업장코드 || '01';

  try {

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
        WITH 자재별통계 AS (
          SELECT
            k.[사업장코드],
            k.[분류코드],
            k.[세부코드],
            COUNT(CASE WHEN k.[입출고구분] = '1' THEN 1 END) AS 매입건수,
            SUM(CASE WHEN k.[입출고구분] = '1' THEN ISNULL(k.[입고수량], 0) ELSE 0 END) AS 총매입수량,
            MAX(CASE WHEN k.[입출고구분] = '1' THEN k.[입출고일자] END) AS 최근매입일자,
            MAX(CASE WHEN k.[입출고구분] = '1' THEN k.[입고단가] END) AS 최근매입단가,
            COUNT(CASE WHEN k.[입출고구분] = '2' THEN 1 END) AS 매출건수,
            SUM(CASE WHEN k.[입출고구분] = '2' THEN ISNULL(k.[출고수량], 0) ELSE 0 END) AS 총매출수량,
            SUM(CASE WHEN k.[입출고구분] = '1' THEN ISNULL(k.[입고수량], 0) ELSE 0 END) -
            SUM(CASE WHEN k.[입출고구분] = '2' THEN ISNULL(k.[출고수량], 0) ELSE 0 END) AS 현재재고_추정,
            (SELECT TOP 1 m.매입처명
             FROM [YmhDB].[dbo].[자재입출내역] i
             INNER JOIN [YmhDB].[dbo].[매입처] m
               ON i.매입처코드 = m.매입처코드
               AND i.사업장코드 = m.사업장코드
             WHERE i.분류코드 = k.분류코드
               AND i.세부코드 = k.세부코드
               AND i.사업장코드 = k.사업장코드
               AND i.입출고구분 = '1'
               AND i.매입처코드 IS NOT NULL
               AND i.매입처코드 != ''
             GROUP BY m.매입처명
             ORDER BY COUNT(*) DESC) AS 주요매입처
          FROM [YmhDB].[dbo].[자재입출내역] AS k
          WHERE k.[사업장코드] = @사업장코드
            AND k.[분류코드] = @분류코드
            AND k.[세부코드] = @세부코드
          GROUP BY k.[사업장코드], k.[분류코드], k.[세부코드]
        )
        SELECT
          (g.[분류코드] + g.[세부코드]) AS 자재코드,
          g.[분류코드],
          g.[세부코드],
          g.[자재명],
          g.[규격],
          g.[단위],
          ISNULL(s.매입건수, 0) AS 매입건수,
          ISNULL(s.총매입수량, 0) AS 총매입수량,
          s.최근매입일자,
          s.최근매입단가,
          ISNULL(s.매출건수, 0) AS 매출건수,
          ISNULL(s.총매출수량, 0) AS 총매출수량,
          ISNULL(s.현재재고_추정, 0) AS 현재재고,
          s.주요매입처,
          CASE
            WHEN ISNULL(s.현재재고_추정, 0) > 0
            THEN 2000 + ISNULL(s.매입건수, 0) * 10
            WHEN s.최근매입일자 >= CONVERT(VARCHAR(8), DATEADD(MONTH, -3, GETDATE()), 112)
            THEN 1000 + ISNULL(s.매입건수, 0) * 10
            WHEN s.최근매입일자 >= CONVERT(VARCHAR(8), DATEADD(YEAR, -1, GETDATE()), 112)
            THEN 500 + ISNULL(s.매입건수, 0) * 5
            WHEN s.매입건수 > 0
            THEN 100 + ISNULL(s.매입건수, 0)
            ELSE 0
          END AS 우선순위점수,
          CASE
            WHEN ISNULL(s.현재재고_추정, 0) > 0 AND s.매입건수 > 0
            THEN '★★ 재고 있음 (동일 코드 사용 권장)'
            WHEN s.최근매입일자 >= CONVERT(VARCHAR(8), DATEADD(MONTH, -3, GETDATE()), 112)
            THEN '★ 최근 매입 자재'
            WHEN s.매입건수 >= 10
            THEN '자주 매입하는 자재'
            WHEN s.매입건수 > 0
            THEN '매입 이력 있음'
            ELSE ''
          END AS 권장태그
        FROM [YmhDB].[dbo].[자재] g
        LEFT JOIN 자재별통계 s
          ON g.분류코드 = s.분류코드
          AND g.세부코드 = s.세부코드
        WHERE g.[분류코드] = @분류코드
          AND g.[세부코드] = @세부코드
      `);

    res.json({
      success: true,
      data: result.recordset[0] || null,
    });
  } catch (err) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ 자재 재고 분석 API 에러');
    console.error('자재코드:', req.params.code);
    console.error('분류코드:', 분류코드);
    console.error('세부코드:', 세부코드);
    console.error('에러 메시지:', err.message);
    console.error('에러 스택:', err.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 2. 자재 가격 비교 분석 API (매입처별)
app.get('/api/materials/:code/price-comparison', async (req, res) => {
  try {
    const { code } = req.params;
    const 분류코드 = code.substring(0, 2);
    const 세부코드 = code.substring(2);
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
        SELECT
          m.매입처코드,
          m.매입처명,
          COUNT(CASE WHEN k.입출고구분='1' THEN 1 END) AS 매입건수,
          SUM(CASE WHEN k.입출고구분='1' THEN ISNULL(k.입고수량,0) ELSE 0 END) AS 총입고수량,
          AVG(CASE WHEN k.입출고구분='1' AND k.입고단가 > 0 THEN k.입고단가 END) AS 평균입고단가,
          MIN(CASE WHEN k.입출고구분='1' AND k.입고단가 > 0 THEN k.입고단가 END) AS 최저입고단가,
          MAX(CASE WHEN k.입출고구분='1' AND k.입고단가 > 0 THEN k.입고단가 END) AS 최고입고단가,
          MAX(CASE WHEN k.입출고구분='1' THEN k.입출고일자 END) AS 최근매입일자,
          SUM(CASE WHEN k.입출고구분='1' THEN ISNULL(k.입고수량,0) * ISNULL(k.입고단가,0) ELSE 0 END) AS 총매입금액
        FROM [YmhDB].[dbo].[자재입출내역] AS k
        INNER JOIN [YmhDB].[dbo].[매입처] AS m
          ON k.매입처코드 = m.매입처코드
          AND k.사업장코드 = m.사업장코드
        WHERE k.사업장코드 = @사업장코드
          AND k.분류코드 = @분류코드
          AND k.세부코드 = @세부코드
          AND k.입출고구분 = '1'
          AND k.매입처코드 IS NOT NULL
        GROUP BY m.매입처코드, m.매입처명
        ORDER BY 총입고수량 DESC, 총매입금액 DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error('자재 가격 비교 분석 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 3. 자재 일관성 검사 API (같은 자재명의 다른 코드 검색)
app.get('/api/materials/:code/consistency-check', async (req, res) => {
  try {
    const { code } = req.params;
    const 분류코드 = code.substring(0, 2);
    const 세부코드 = code.substring(2);
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    // 1. 현재 자재의 자재명과 규격 가져오기
    const materialInfo = await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드).query(`
        SELECT 자재명, 규격
        FROM [YmhDB].[dbo].[자재]
        WHERE 분류코드 = @분류코드
          AND 세부코드 = @세부코드
      `);

    if (materialInfo.recordset.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const { 자재명, 규격 } = materialInfo.recordset[0];

    // 2. 같은 자재명/규격을 가진 다른 자재코드 검색
    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('자재명', sql.VarChar(30), 자재명)
      .input('규격', sql.VarChar(30), 규격 || '')
      .input('현재분류코드', sql.VarChar(2), 분류코드)
      .input('현재세부코드', sql.VarChar(16), 세부코드).query(`
        SELECT
          (g.분류코드 + g.세부코드) AS 자재코드,
          g.분류코드,
          g.세부코드,
          g.자재명,
          g.규격,
          g.단위,
          COUNT(CASE WHEN k.입출고구분='1' THEN 1 END) AS 매입건수,
          SUM(CASE WHEN k.입출고구분='1' THEN ISNULL(k.입고수량,0) ELSE 0 END) AS 총입고수량,
          COUNT(CASE WHEN k.입출고구분='2' THEN 1 END) AS 매출건수,
          SUM(CASE WHEN k.입출고구분='2' THEN ISNULL(k.출고수량,0) ELSE 0 END) AS 총출고수량,
          SUM(CASE WHEN k.입출고구분='1' THEN ISNULL(k.입고수량,0) ELSE 0 END) -
          SUM(CASE WHEN k.입출고구분='2' THEN ISNULL(k.출고수량,0) ELSE 0 END) AS 현재재고
        FROM [YmhDB].[dbo].[자재] AS g
        LEFT JOIN [YmhDB].[dbo].[자재입출내역] AS k
          ON g.분류코드 = k.분류코드
          AND g.세부코드 = k.세부코드
          AND k.사업장코드 = @사업장코드
        WHERE g.자재명 = @자재명
          AND g.규격 = @규격
          AND NOT (g.분류코드 = @현재분류코드 AND g.세부코드 = @현재세부코드)
        GROUP BY g.분류코드, g.세부코드, g.자재명, g.규격, g.단위
        ORDER BY 현재재고 DESC, 매입건수 DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
      currentMaterial: { 자재명, 규격 },
    });
  } catch (err) {
    console.error('자재 일관성 검사 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 자재 분류 목록 조회
// 자재분류 목록 조회
app.get('/api/material-categories', async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT 분류코드, 분류명, 적요, 사용구분, 수정일자, 사용자코드
      FROM 자재분류
      WHERE 사용구분 = 0
    `;

    const request = pool.request();

    // 검색 조건 추가
    if (search) {
      query += ` AND (분류코드 LIKE @search OR 분류명 LIKE @search)`;
      request.input('search', sql.NVarChar(100), `%${search}%`);
    }

    query += ` ORDER BY 분류코드`;

    const result = await request.query(query);

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

    const result = await pool.request().input('분류코드', sql.VarChar(2), code).query(`
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
    const checkResult = await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .query('SELECT 분류코드 FROM 자재분류 WHERE 분류코드 = @분류코드');

    if (checkResult.recordset.length > 0) {
      return res.status(409).json({ success: false, message: '이미 존재하는 분류코드입니다.' });
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('분류명', sql.VarChar(50), 분류명)
      .input('적요', sql.VarChar(100), 적요 || '')
      .input('사용구분', sql.TinyInt, 0)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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
    const checkResult = await pool
      .request()
      .input('분류코드', sql.VarChar(2), code)
      .query('SELECT 분류코드 FROM 자재분류 WHERE 분류코드 = @분류코드');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '자재분류를 찾을 수 없습니다.' });
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    await pool
      .request()
      .input('분류코드', sql.VarChar(2), code)
      .input('분류명', sql.VarChar(50), 분류명)
      .input('적요', sql.VarChar(100), 적요 || '')
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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
    const checkResult = await pool
      .request()
      .input('분류코드', sql.VarChar(2), code)
      .query('SELECT 분류코드 FROM 자재분류 WHERE 분류코드 = @분류코드 AND 사용구분 = 0');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '자재분류를 찾을 수 없습니다.' });
    }

    // 해당 분류를 사용하는 자재가 있는지 확인
    const materialCheck = await pool
      .request()
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
    await pool
      .request()
      .input('분류코드', sql.VarChar(2), code)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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

// ===========================================
// 자재내역관리 API (Material Transaction History Management)
// 자재입출내역 테이블 CRUD
// ===========================================

// 자재내역 목록 조회
app.get('/api/material-history', async (req, res) => {
  try {
    const { search } = req.query;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    let query = `
      SELECT
        i.사업장코드, i.분류코드, i.세부코드,
        i.입출고구분, i.입출고일자, i.입출고시간,
        i.거래일자, i.거래번호,
        i.입고수량, i.입고단가, i.입고부가,
        i.출고수량, i.출고단가, i.출고부가,
        i.매입처코드, i.매출처코드,
        i.적요, i.사용자코드,
        m.자재명, m.규격, m.단위,
        s.매출처명,
        p.매입처명
      FROM 자재입출내역 i
        LEFT JOIN 자재 m
          ON i.세부코드 = m.세부코드
          AND i.분류코드 = m.분류코드
        LEFT JOIN 매출처 s
          ON i.매출처코드 = s.매출처코드
          AND i.사업장코드 = s.사업장코드
        LEFT JOIN 매입처 p
          ON i.매입처코드 = p.매입처코드
          AND i.사업장코드 = p.사업장코드
      WHERE i.사업장코드 = @사업장코드
        AND i.사용구분 = 0
    `;

    const request = pool.request();
    request.input('사업장코드', sql.VarChar(2), 사업장코드);

    // 검색 조건 추가 (세부코드, 자재명으로 검색)
    if (search) {
      query += ` AND (i.세부코드 LIKE @search OR m.자재명 LIKE @search)`;
      request.input('search', sql.NVarChar(100), `%${search}%`);
    }

    query += ` ORDER BY i.입출고일자 DESC, i.입출고시간 DESC`;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('자재내역 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 자재내역 단일 조회 (복합키: 사업장코드 + 분류코드 + 세부코드 + 입출고일자 + 입출고시간)
app.get('/api/material-history/:workplace/:category/:detail/:date/:time', async (req, res) => {
  try {
    const { workplace, category, detail, date, time } = req.params;

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), workplace)
      .input('분류코드', sql.VarChar(2), category)
      .input('세부코드', sql.VarChar(16), detail)
      .input('입출고일자', sql.VarChar(8), date)
      .input('입출고시간', sql.VarChar(9), time).query(`
        SELECT
          i.사업장코드, i.분류코드, i.세부코드,
          i.입출고구분, i.입출고일자, i.입출고시간,
          i.거래일자, i.거래번호,
          i.입고수량, i.입고단가, i.입고부가,
          i.출고수량, i.출고단가, i.출고부가,
          i.매입처코드, i.매출처코드,
          i.적요, i.사용자코드, i.수정일자,
          m.자재명, m.규격, m.단위,
          s.매출처명,
          p.매입처명
        FROM 자재입출내역 i
          LEFT JOIN 자재 m
            ON i.세부코드 = m.세부코드
            AND i.분류코드 = m.분류코드
          LEFT JOIN 매출처 s
            ON i.매출처코드 = s.매출처코드
            AND i.사업장코드 = s.사업장코드
          LEFT JOIN 매입처 p
            ON i.매입처코드 = p.매입처코드
            AND i.사업장코드 = p.사업장코드
        WHERE i.사업장코드 = @사업장코드
          AND i.분류코드 = @분류코드
          AND i.세부코드 = @세부코드
          AND i.입출고일자 = @입출고일자
          AND i.입출고시간 = @입출고시간
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '자재내역을 찾을 수 없습니다.' });
    }

    res.json({
      success: true,
      data: result.recordset[0],
    });
  } catch (err) {
    console.error('자재내역 단일 조회 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 자재내역 생성
app.post('/api/material-history', requireAuth, async (req, res) => {
  try {
    const {
      사업장코드,
      분류코드,
      세부코드,
      입출고구분,
      입출고일자,
      거래일자,
      거래번호,
      입고수량,
      입고단가,
      입고부가,
      출고수량,
      출고단가,
      출고부가,
      매입처코드,
      매출처코드,
      적요,
    } = req.body;

    const 사용자코드 = req.session?.user?.사용자코드 || '8080';
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const 입출고시간 = new Date().toISOString().replace(/[-:]/g, '').slice(0, 17);

    // 필수 필드 검증
    if (!사업장코드 || !분류코드 || !세부코드 || !입출고구분) {
      return res.status(400).json({
        success: false,
        message: '사업장코드, 분류코드, 세부코드, 입출고구분은 필수입니다.',
      });
    }

    await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드)
      .input('입출고구분', sql.TinyInt, 입출고구분)
      .input('입출고일자', sql.VarChar(8), 입출고일자)
      .input('입출고시간', sql.VarChar(9), 입출고시간)
      .input('거래일자', sql.VarChar(8), 거래일자 || '')
      .input('거래번호', sql.Real, 거래번호 || 0)
      .input('입고수량', sql.Money, 입고수량 || 0)
      .input('입고단가', sql.Money, 입고단가 || 0)
      .input('입고부가', sql.Money, 입고부가 || 0)
      .input('출고수량', sql.Money, 출고수량 || 0)
      .input('출고단가', sql.Money, 출고단가 || 0)
      .input('출고부가', sql.Money, 출고부가 || 0)
      .input('매입처코드', sql.VarChar(8), 매입처코드 || '')
      .input('매출처코드', sql.VarChar(8), 매출처코드 || '')
      .input('적요', sql.VarChar(50), 적요 || '')
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        INSERT INTO 자재입출내역 (
          사업장코드, 분류코드, 세부코드,
          입출고구분, 입출고일자, 입출고시간,
          거래일자, 거래번호,
          입고수량, 입고단가, 입고부가,
          출고수량, 출고단가, 출고부가,
          매입처코드, 매출처코드,
          적요, 사용구분, 수정일자, 사용자코드
        ) VALUES (
          @사업장코드, @분류코드, @세부코드,
          @입출고구분, @입출고일자, @입출고시간,
          @거래일자, @거래번호,
          @입고수량, @입고단가, @입고부가,
          @출고수량, @출고단가, @출고부가,
          @매입처코드, @매출처코드,
          @적요, 0, @수정일자, @사용자코드
        )
      `);

    res.json({
      success: true,
      message: '자재내역이 등록되었습니다.',
      data: {
        사업장코드,
        분류코드,
        세부코드,
        입출고일자,
        입출고시간,
      },
    });
  } catch (err) {
    console.error('자재내역 등록 에러:', err);
    res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
  }
});

// 자재내역 수정
app.put(
  '/api/material-history/:workplace/:category/:detail/:date/:time',
  requireAuth,
  async (req, res) => {
    try {
      const { workplace, category, detail, date, time } = req.params;
      const {
        입출고구분,
        입출고일자,
        거래일자,
        거래번호,
        입고수량,
        입고단가,
        입고부가,
        출고수량,
        출고단가,
        출고부가,
        매입처코드,
        매출처코드,
        적요,
      } = req.body;

      const 사용자코드 = req.session?.user?.사용자코드 || '8080';
      const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      // 존재 여부 확인
      const checkResult = await pool
        .request()
        .input('사업장코드', sql.VarChar(2), workplace)
        .input('분류코드', sql.VarChar(2), category)
        .input('세부코드', sql.VarChar(16), detail)
        .input('입출고일자', sql.VarChar(8), date)
        .input('입출고시간', sql.VarChar(9), time).query(`
        SELECT 사업장코드 FROM 자재입출내역
        WHERE 사업장코드 = @사업장코드
          AND 분류코드 = @분류코드
          AND 세부코드 = @세부코드
          AND 입출고일자 = @입출고일자
          AND 입출고시간 = @입출고시간
      `);

      if (checkResult.recordset.length === 0) {
        return res.status(404).json({ success: false, message: '자재내역을 찾을 수 없습니다.' });
      }

      await pool
        .request()
        .input('사업장코드', sql.VarChar(2), workplace)
        .input('분류코드', sql.VarChar(2), category)
        .input('세부코드', sql.VarChar(16), detail)
        .input('입출고일자_원본', sql.VarChar(8), date)
        .input('입출고시간', sql.VarChar(9), time)
        .input('입출고구분', sql.TinyInt, 입출고구분)
        .input('입출고일자', sql.VarChar(8), 입출고일자)
        .input('거래일자', sql.VarChar(8), 거래일자 || '')
        .input('거래번호', sql.Real, 거래번호 || 0)
        .input('입고수량', sql.Money, 입고수량 || 0)
        .input('입고단가', sql.Money, 입고단가 || 0)
        .input('입고부가', sql.Money, 입고부가 || 0)
        .input('출고수량', sql.Money, 출고수량 || 0)
        .input('출고단가', sql.Money, 출고단가 || 0)
        .input('출고부가', sql.Money, 출고부가 || 0)
        .input('매입처코드', sql.VarChar(8), 매입처코드 || '')
        .input('매출처코드', sql.VarChar(8), 매출처코드 || '')
        .input('적요', sql.VarChar(50), 적요 || '')
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        UPDATE 자재입출내역
        SET 입출고구분 = @입출고구분,
            입출고일자 = @입출고일자,
            거래일자 = @거래일자,
            거래번호 = @거래번호,
            입고수량 = @입고수량,
            입고단가 = @입고단가,
            입고부가 = @입고부가,
            출고수량 = @출고수량,
            출고단가 = @출고단가,
            출고부가 = @출고부가,
            매입처코드 = @매입처코드,
            매출처코드 = @매출처코드,
            적요 = @적요,
            수정일자 = @수정일자,
            사용자코드 = @사용자코드
        WHERE 사업장코드 = @사업장코드
          AND 분류코드 = @분류코드
          AND 세부코드 = @세부코드
          AND 입출고일자 = @입출고일자_원본
          AND 입출고시간 = @입출고시간
      `);

      res.json({
        success: true,
        message: '자재내역이 수정되었습니다.',
      });
    } catch (err) {
      console.error('자재내역 수정 에러:', err);
      res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
    }
  },
);

// 자재내역 삭제 (하드 삭제)
app.delete(
  '/api/material-history/:workplace/:category/:detail/:date/:time',
  requireAuth,
  async (req, res) => {
    try {
      const { workplace, category, detail, date, time } = req.params;

      // 존재 여부 확인
      const checkResult = await pool
        .request()
        .input('사업장코드', sql.VarChar(2), workplace)
        .input('분류코드', sql.VarChar(2), category)
        .input('세부코드', sql.VarChar(16), detail)
        .input('입출고일자', sql.VarChar(8), date)
        .input('입출고시간', sql.VarChar(9), time).query(`
        SELECT 사업장코드 FROM 자재입출내역
        WHERE 사업장코드 = @사업장코드
          AND 분류코드 = @분류코드
          AND 세부코드 = @세부코드
          AND 입출고일자 = @입출고일자
          AND 입출고시간 = @입출고시간
      `);

      if (checkResult.recordset.length === 0) {
        return res.status(404).json({ success: false, message: '자재내역을 찾을 수 없습니다.' });
      }

      // 하드 삭제 (자재입출내역은 사용구분 필드가 있지만 실제 삭제)
      await pool
        .request()
        .input('사업장코드', sql.VarChar(2), workplace)
        .input('분류코드', sql.VarChar(2), category)
        .input('세부코드', sql.VarChar(16), detail)
        .input('입출고일자', sql.VarChar(8), date)
        .input('입출고시간', sql.VarChar(9), time).query(`
        DELETE FROM 자재입출내역
        WHERE 사업장코드 = @사업장코드
          AND 분류코드 = @분류코드
          AND 세부코드 = @세부코드
          AND 입출고일자 = @입출고일자
          AND 입출고시간 = @입출고시간
      `);

      res.json({
        success: true,
        message: '자재내역이 삭제되었습니다.',
      });
    } catch (err) {
      console.error('자재내역 삭제 에러:', err);
      res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
    }
  },
);

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
// ✅ 거래명세서 목록 조회
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
      ORDER BY t.거래일자 ASC, t.거래번호 ASC
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
// ✅ 거래명세서 인쇄용 API (거래명세서A4백지_인쇄 stored procedure 기반)
app.get('/api/transactions/:date/:no/print', async (req, res) => {
  try {
    const { date, no } = req.params;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    console.log('✅ 거래명세서 인쇄 요청:', { date, no, 사업장코드 });

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('거래일자', sql.VarChar(8), date)
      .input('거래번호', sql.Real, parseFloat(no)).query(`
        SELECT
          T1.사업장코드, T1.거래일자, T1.거래번호,
          T1.매출처코드,
          -- 좌측 (사업장 정보)
          ISNULL(T4.사업자번호, '') AS 좌등록번호,
          ISNULL(T4.사업장명, '') AS 좌상호,
          ISNULL(T4.대표자명, '') AS 좌성명,
          (ISNULL(T4.주소, '') + SPACE(1) + ISNULL(T4.번지, '')) AS 좌주소,
          ISNULL(T4.업태, '') AS 좌업태,
          ISNULL(T4.업종, '') AS 좌종목,
          -- 우측 (매출처 정보)
          ISNULL(T3.사업자번호, '') AS 우등록번호,
          ISNULL(T3.매출처명, '') AS 우상호,
          ISNULL(T3.대표자명, '') AS 우성명,
          (ISNULL(T3.주소, '') + SPACE(1) + ISNULL(T3.번지, '')) AS 우주소,
          ISNULL(T3.업태, '') AS 우업태,
          ISNULL(T3.업종, '') AS 우종목,
          -- 총금액 계산 (서브쿼리)
          (SELECT SUM(출고수량 * 출고단가)
           FROM 자재입출내역
           WHERE 사업장코드 = @사업장코드
             AND 입출고구분 = 2 AND 사용구분 = 0
             AND 거래일자 = @거래일자
             AND 거래번호 = @거래번호) AS 총금액,
          -- 건수 계산 (서브쿼리)
          (SELECT COUNT(세부코드)
           FROM 자재입출내역
           WHERE 사업장코드 = @사업장코드
             AND 입출고구분 = 2 AND 사용구분 = 0
             AND 거래일자 = @거래일자
             AND 거래번호 = @거래번호) AS 건수,
          -- 상세 품목 정보
          (T1.분류코드 + T1.세부코드) AS 코드,
          ISNULL(T2.자재명, '') AS 품명,
          ISNULL(T2.규격, '') AS 규격,
          T1.출고수량 AS 수량,
          ISNULL(T2.단위, '') AS 단위,
          T1.출고단가 AS 단가,
          T1.출고부가 AS 부가,
          (T1.출고단가 * T1.출고수량) AS 출고금액
        FROM 자재입출내역 T1
        LEFT JOIN 자재 T2 ON T2.분류코드 = T1.분류코드 AND T2.세부코드 = T1.세부코드
        LEFT JOIN 매출처 T3 ON T3.매출처코드 = T1.매출처코드
        LEFT JOIN 사업장 T4 ON T3.사업장코드 = T1.사업장코드
        WHERE T1.사업장코드 = @사업장코드
          AND T1.입출고구분 = 2
          AND T1.사용구분 = 0
          AND T1.거래일자 = @거래일자
          AND T1.거래번호 = @거래번호
        ORDER BY T1.사업장코드, T1.거래일자, T1.거래번호, T1.입출고시간
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '거래명세서를 찾을 수 없습니다.',
      });
    }

    // 첫 번째 레코드에서 헤더 정보 추출
    const firstRecord = result.recordset[0];

    res.json({
      success: true,
      data: {
        header: {
          사업장코드: firstRecord.사업장코드,
          거래일자: firstRecord.거래일자,
          거래번호: firstRecord.거래번호,
          매출처코드: firstRecord.매출처코드,
          // 좌측 (회사 정보)
          좌등록번호: firstRecord.좌등록번호,
          좌상호: firstRecord.좌상호,
          좌성명: firstRecord.좌성명,
          좌주소: firstRecord.좌주소,
          좌업태: firstRecord.좌업태,
          좌종목: firstRecord.좌종목,
          // 우측 (매출처 정보)
          우등록번호: firstRecord.우등록번호,
          우상호: firstRecord.우상호,
          우성명: firstRecord.우성명,
          우주소: firstRecord.우주소,
          우업태: firstRecord.우업태,
          우종목: firstRecord.우종목,
          // 합계
          총금액: firstRecord.총금액,
          건수: firstRecord.건수,
        },
        details: result.recordset.map((item) => ({
          코드: item.코드,
          품명: item.품명,
          규격: item.규격,
          수량: item.수량,
          단위: item.단위,
          단가: item.단가,
          부가: item.부가,
          출고금액: item.출고금액,
        })),
      },
    });

    console.log('✅ 거래명세서 인쇄 데이터 반환:', result.recordset.length, '건');
  } catch (err) {
    console.error('❌ 거래명세서 인쇄 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// 견적서 인쇄 API - 견적서인쇄sp.txt 기반
app.get('/api/quotations/:date/:no/print', async (req, res) => {
  try {
    const { date, no } = req.params;
    const mode = parseInt(req.query.mode) || 0; // 0=가격숨김, 1=가격표시
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    console.log('✅ 견적서 인쇄 조회 요청:', { date, no, mode, 사업장코드 });

    // 견적서인쇄sp와 동일한 로직
    const query =
      mode === 0
        ? `
      SELECT T1.사업장코드, T1.견적일자, T1.견적번호, T1.출고희망일자,
             T1.매출처코드, T3.매출처명, T3.담당자명 AS 참조, T1.제목 AS 제목, T1.적요 AS 참조란,
             T2.자재코드, ISNULL(T4.자재명,'') AS 품명,
             T4.규격 AS 규격, T2.수량 AS 수량, T4.단위 AS 단위,
             T2.계산서발행여부, 0 AS 출고단가, 0 AS 출고부가, (0 * T2.수량) AS 금액,
             T2.적요 AS 적요, T1.유효일수 AS 유효일수,
             DATEDIFF(day, CONVERT(DATETIME, T1.견적일자), CONVERT(DATETIME, T1.출고희망일자)) AS 견적후납기일수,
             T5.사업장명, T5.사업자번호, T5.대표자명, T5.전화번호, T5.팩스번호, T5.주소, T5.번지,
             T3.전화번호 AS 매출처전화, T3.팩스번호 AS 매출처팩스, T3.주소 AS 매출처주소, T3.번지 AS 매출처번지, T3.담당자 AS 매출처담당자
        FROM 견적 T1
       INNER JOIN 견적내역 T2
               ON T2.사업장코드 = T1.사업장코드 AND T2.견적일자 = T1.견적일자 AND T2.견적번호 = T1.견적번호
        LEFT JOIN 매출처 T3 ON T3.사업장코드 = T2.사업장코드 AND T3.매출처코드 = T2.매출처코드
        LEFT JOIN 자재 T4 ON (T4.분류코드 + T4.세부코드) = T2.자재코드
        LEFT JOIN 사업장 T5 ON T5.사업장코드 = T1.사업장코드
       WHERE T1.사업장코드 = @사업장코드
         AND T1.견적일자 = @견적일자
         AND T1.견적번호 = @견적번호
         AND (T1.상태코드 = 1 OR T1.상태코드 = 2) AND T1.사용구분 = 0
         AND (T2.상태코드 = 1 OR T2.상태코드 = 2) AND T2.사용구분 = 0
       ORDER BY T1.사업장코드, T1.견적일자, T1.견적번호, T2.견적시간
    `
        : `
      SELECT T1.사업장코드, T1.견적일자, T1.견적번호, T1.출고희망일자,
             T1.매출처코드, T3.매출처명, T3.담당자명 AS 참조, T1.제목 AS 제목, T1.적요 AS 참조란,
             T2.자재코드, ISNULL(T4.자재명,'') AS 품명,
             T4.규격 AS 규격, T2.수량 AS 수량, T4.단위 AS 단위,
             T2.계산서발행여부, T2.출고단가 AS 출고단가, T2.출고부가 AS 출고부가, (T2.출고단가 * T2.수량) AS 금액,
             T2.적요 AS 적요, T1.유효일수 AS 유효일수,
             DATEDIFF(day, CONVERT(DATETIME, T1.견적일자), CONVERT(DATETIME, T1.출고희망일자)) AS 견적후납기일수,
             T5.사업장명, T5.사업자번호, T5.대표자명, T5.전화번호, T5.팩스번호, T5.주소, T5.번지,
             T3.전화번호 AS 매출처전화, T3.팩스번호 AS 매출처팩스, T3.주소 AS 매출처주소, T3.번지 AS 매출처번지, T3.담당자명 AS 매출처담당자
        FROM 견적 T1
       INNER JOIN 견적내역 T2
               ON T2.사업장코드 = T1.사업장코드 AND T2.견적일자 = T1.견적일자 AND T2.견적번호 = T1.견적번호
        LEFT JOIN 매출처 T3 ON T3.사업장코드 = T2.사업장코드 AND T3.매출처코드 = T2.매출처코드
        LEFT JOIN 자재 T4 ON (T4.분류코드 + T4.세부코드) = T2.자재코드
        LEFT JOIN 사업장 T5 ON T5.사업장코드 = T1.사업장코드
       WHERE T1.사업장코드 = @사업장코드
         AND T1.견적일자 = @견적일자
         AND T1.견적번호 = @견적번호
         AND (T1.상태코드 = 1 OR T1.상태코드 = 2) AND T1.사용구분 = 0
         AND (T2.상태코드 = 1 OR T2.상태코드 = 2) AND T2.사용구분 = 0
        ORDER BY T1.사업장코드, T1.견적일자, T1.견적번호, T2.견적시간
    `;

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('견적일자', sql.VarChar(8), date)
      .input('견적번호', sql.Real, parseFloat(no))
      .query(query);

    if (result.recordset.length === 0) {
      return res.json({
        success: false,
        message: '견적서를 찾을 수 없습니다.',
      });
    }

    const firstRow = result.recordset[0];

    // 품목별 합계 계산
    const items = result.recordset.map((row) => ({
      품명: row.품명 || '',
      규격: row.규격 || '',
      수량: row.수량 || 0,
      단위: row.단위 || '',
      단가: row.출고단가 || 0,
      부가: row.출고부가 || 0,
      금액: row.금액 || 0,
      적요: row.적요 || '',
    }));

    const 총공급가액 = items.reduce((sum, item) => sum + (item.금액 || 0), 0);
    const 총부가세 = items.reduce((sum, item) => sum + (item.부가 || 0), 0);
    const 총합계 = 총공급가액 + 총부가세;

    res.json({
      success: true,
      data: {
        header: {
          사업장명: firstRow.사업장명 || '',
          사업자번호: firstRow.사업자번호 || '',
          대표자명: firstRow.대표자명 || '',
          전화번호: firstRow.전화번호 || '',
          팩스번호: firstRow.팩스번호 || '',
          주소: (firstRow.주소 || '') + ' ' + (firstRow.번지 || ''),
          견적일자: firstRow.견적일자 || '',
          견적번호: firstRow.견적번호 || '',
          출고희망일자: firstRow.출고희망일자 || '',
          매출처코드: firstRow.매출처코드 || '',
          매출처명: firstRow.매출처명 || '',
          매출처전화: firstRow.매출처전화 || '',
          매출처팩스: firstRow.매출처팩스 || '',
          매출처주소: (firstRow.매출처주소 || '') + ' ' + (firstRow.매출처번지 || ''),
          매출처담당자: firstRow.매출처담당자 || '',
          제목: firstRow.제목 || '',
          적요: firstRow.참조란 || '',
          유효일수: firstRow.유효일수 || 0,
          납기일수: firstRow.견적후납기일수 || 0,
          총공급가액: 총공급가액,
          총부가세: 총부가세,
          총합계: 총합계,
        },
        items: items,
      },
    });

    console.log('✅ 견적서 인쇄 데이터 반환:', result.recordset.length, '건');
  } catch (err) {
    console.error('❌ 견적서 인쇄 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// 발주서 인쇄 API - 발주서인쇄sp.txt 기반
app.get('/api/orders/:date/:no/print', async (req, res) => {
  try {
    const { date, no } = req.params;
    const mode = parseInt(req.query.mode) || 0; // 0=가격숨김, 1=가격표시
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    console.log('✅ 발주서 인쇄 조회 요청:', { date, no, mode, 사업장코드 });

    // 발주인쇄sp와 동일한 로직
    const query =
      mode === 0
        ? `
      SELECT T1.사업장코드, T1.발주일자, T1.발주번호, T1.입고희망일자,
             T1.매입처코드, T3.매입처명, T3.담당자명 AS 참조, T1.제목 AS 제목, T1.적요 AS 참조란,
             T2.자재코드, ISNULL(T4.자재명,'') AS 품명,
             T4.규격 AS 규격, T2.발주량 AS 수량, T4.단위 AS 단위,
             0 AS 입고단가, 0 AS 입고부가, (0 * T2.수량) AS 금액,
             T2.적요 AS 적요, T1.유효일수 AS 유효일수,
             DATEDIFF(day, CONVERT(DATETIME, T1.발주일자), CONVERT(DATETIME, T1.입고희망일자)) AS 발주후납기일수,
             T5.사업장명, T5.사업자번호, T5.대표자명, T5.전화번호, T5.팩스번호, T5.주소, T5.번지,
             T3.전화번호 AS 매입처전화, T3.팩스번호 AS 매입처팩스, T3.주소 AS 매입처주소, T3.번지 AS 매입처번지, T3.담당자명 AS 매입처담당자
        FROM 발주 T1
       INNER JOIN 발주내역 T2
               ON T2.사업장코드 = T1.사업장코드 AND T2.발주일자 = T1.발주일자 AND T2.발주번호 = T1.발주번호
        LEFT JOIN 매입처 T3 ON T3.사업장코드 = T2.사업장코드 AND T3.매입처코드 = T2.매입처코드
        LEFT JOIN 자재 T4 ON (T4.분류코드 + T4.세부코드) = T2.자재코드
        LEFT JOIN 사업장 T5 ON T5.사업장코드 = T1.사업장코드
       WHERE T1.사업장코드 = @사업장코드
         AND T1.발주일자 = @발주일자
         AND T1.발주번호 = @발주번호
         AND T1.사용구분 = 0
         AND T2.사용구분 = 0
       ORDER BY T1.사업장코드, T1.발주일자, T1.발주번호, T2.발주시간
    `
        : `
      SELECT T1.사업장코드, T1.발주일자, T1.발주번호, T1.입고희망일자,
             T1.매입처코드, T3.매입처명, T3.담당자명 AS 참조, T1.제목 AS 제목, T1.적요 AS 참조란,
             T2.자재코드, ISNULL(T4.자재명,'') AS 품명,
             T4.규격 AS 규격, T2.발주량 AS 수량, T4.단위 AS 단위,T2.입고단가 AS 입고단가, T2.입고부가 AS 입고부가, (T2.입고단가 * T2.발주량) AS 금액,
             T2.적요 AS 적요, T1.유효일수 AS 유효일수,
             DATEDIFF(day, CONVERT(DATETIME, T1.발주일자), CONVERT(DATETIME, T1.입고희망일자)) AS 발주후납기일수,
             T5.사업장명, T5.사업자번호, T5.대표자명, T5.전화번호, T5.팩스번호, T5.주소, T5.번지,
             T3.전화번호 AS 매입처전화, T3.팩스번호 AS 매입처팩스, T3.주소 AS 매입처주소, T3.번지 AS 매입처번지, T3.담당자명 AS 매입처담당자
        FROM 발주 T1
       INNER JOIN 발주내역 T2
               ON T2.사업장코드 = T1.사업장코드 AND T2.발주일자 = T1.발주일자 AND T2.발주번호 = T1.발주번호
        LEFT JOIN 매입처 T3 ON T3.사업장코드 = T2.사업장코드 AND T3.매입처코드 = T2.매입처코드
        LEFT JOIN 자재 T4 ON (T4.분류코드 + T4.세부코드) = T2.자재코드
        LEFT JOIN 사업장 T5 ON T5.사업장코드 = T1.사업장코드
       WHERE T1.사업장코드 = @사업장코드
         AND T1.발주일자 = @발주일자
         AND T1.발주번호 = @발주번호
         AND T1.사용구분 = 0
         AND T2.사용구분 = 0
        ORDER BY T1.사업장코드, T1.발주일자, T1.발주번호, T2.발주시간
    `;

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('발주일자', sql.VarChar(8), date)
      .input('발주번호', sql.Real, parseFloat(no))
      .query(query);

    if (result.recordset.length === 0) {
      return res.json({
        success: false,
        message: '발주서를 찾을 수 없습니다.',
      });
    }

    const firstRow = result.recordset[0];

    // 품목별 합계 계산
    const items = result.recordset.map((row) => ({
      품명: row.품명 || '',
      규격: row.규격 || '',
      수량: row.수량 || 0,
      단위: row.단위 || '',
      단가: row.입고단가 || 0,
      부가: row.입고부가 || 0,
      금액: row.금액 || 0,
      적요: row.적요 || '',
    }));

    const 총공급가액 = items.reduce((sum, item) => sum + (item.금액 || 0), 0);
    const 총부가세 = items.reduce((sum, item) => sum + (item.부가 || 0), 0);
    const 총합계 = 총공급가액 + 총부가세;

    res.json({
      success: true,
      data: {
        header: {
          사업장명: firstRow.사업장명 || '',
          사업자번호: firstRow.사업자번호 || '',
          대표자명: firstRow.대표자명 || '',
          전화번호: firstRow.전화번호 || '',
          팩스번호: firstRow.팩스번호 || '',
          주소: (firstRow.주소 || '') + ' ' + (firstRow.번지 || ''),
          발주일자: firstRow.발주일자 || '',
          발주번호: firstRow.발주번호 || '',
          입고희망일자: firstRow.입고희망일자 || '',
          매입처코드: firstRow.매입처코드 || '',
          매입처명: firstRow.매입처명 || '',
          매입처전화: firstRow.매입처전화 || '',
          매입처팩스: firstRow.매입처팩스 || '',
          매입처주소: (firstRow.매입처주소 || '') + ' ' + (firstRow.매입처번지 || ''),
          매입처담당자: firstRow.매입처담당자 || '',
          제목: firstRow.제목 || '',
          적요: firstRow.참조란 || '',
          유효일수: firstRow.유효일수 || 0,
          납기일수: firstRow.발주후납기일수 || 0,
          총공급가액: 총공급가액,
          총부가세: 총부가세,
          총합계: 총합계,
        },
        items: items,
      },
    });

    console.log('✅ 발주서 인쇄 데이터 반환:', result.recordset.length, '건');
  } catch (err) {
    console.error('❌ 발주서 인쇄 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// 거래명세서 상세 조회 요청
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
        ORDER BY i.입출고시간 ASC   
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
    await pool
      .request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호)).query(`
        DELETE FROM 자재입출내역
        WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호
      `);

    console.log(`✅ 기존 거래명세서 삭제 완료: ${거래일자}-${거래번호}`);

    const 수정일자 = 거래일자;

    // ✅ 베이스 시간 생성 (품목별 입출고시간을 다르게 부여하기 위해)
    const baseTime = new Date();

    // 3. 새로운 상세내역 INSERT
    for (let index = 0; index < details.length; index++) {
      const detail = details[index];
      const { 분류코드, 세부코드, 수량, 단가, 매출처코드 } = detail;

      // 자재코드 분리
      const 분류코드2 = 분류코드;
      const 세부코드2 = 세부코드;

      const 출고수량 = 수량;
      const 출고단가 = 단가;
      const 출고부가 = Math.round(출고수량 * 출고단가 * 0.1);

      // ✅ 품목별로 입출고시간 생성 (밀리초 증가로 입력 순서 보장)
      const itemTime = new Date(baseTime.getTime() + index);
      const 입출고시간 =
        itemTime.getHours().toString().padStart(2, '0') +
        itemTime.getMinutes().toString().padStart(2, '0') +
        itemTime.getSeconds().toString().padStart(2, '0') +
        itemTime.getMilliseconds().toString().padStart(3, '0');

      // ✅ CRITICAL FIX: 자재 및 자재원장 레코드 존재 확인 및 자동 생성
      // Step 1: 자재 테이블에 자재가 존재하는지 확인
      const materialCheck = await pool
        .request()
        .input('분류코드', sql.VarChar(2), 분류코드2)
        .input('세부코드', sql.VarChar(16), 세부코드2).query(`
        SELECT COUNT(*) as cnt FROM 자재
        WHERE 분류코드 = @분류코드
        AND 세부코드 = @세부코드
        AND 사용구분 = 0
        `);

      if (materialCheck.recordset[0].cnt === 0) {
        // 자재가 존재하지 않으면 에러 반환 (자재는 사전에 등록되어야 함)
        return res.status(400).json({
          success: false,
          message: `자재코드 ${세부코드2}는 등록되지 않은 자재입니다. 먼저 자재내역관리에서 자재를 등록해주세요.`,
        });
      }

      // Step 2: 자재원장 레코드 존재 확인 및 자동 생성
      const ledgerCheck = await pool
        .request()
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('분류코드', sql.VarChar(2), 분류코드2)
        .input('세부코드', sql.VarChar(16), 세부코드2).query(`
        SELECT COUNT(*) as cnt FROM 자재원장
        WHERE 사업장코드 = @사업장코드
        AND 분류코드 = @분류코드
        AND 세부코드 = @세부코드
        `);

      if (ledgerCheck.recordset[0].cnt === 0) {
        console.log(`⚡ 자재원장 레코드 자동 생성: ${사업장코드}-${분류코드2}-${세부코드2}`);

        await pool
          .request()
          .input('사업장코드', sql.VarChar(2), 사업장코드)
          .input('분류코드', sql.VarChar(2), 분류코드2)
          .input('세부코드', sql.VarChar(16), 세부코드2)
          .input('수정일자', sql.VarChar(8), 수정일자)
          .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
            INSERT INTO 자재원장 (
              사업장코드, 분류코드, 세부코드,
              적정재고, 최저재고,
              최종입고일자, 최종출고일자,
              사용구분, 수정일자, 사용자코드,
              비고란, 주매입처코드,
              입고단가1, 입고단가2, 입고단가3,
              출고단가1, 출고단가2, 출고단가3
            ) VALUES (
              @사업장코드, @분류코드, @세부코드,
              0, 0,
              '', '',
              0, @수정일자, @사용자코드,
              '', '',
              0, 0, 0,
              0, 0, 0
              )
              `);
      }

      await pool
        .request()
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('분류코드', sql.VarChar(2), 분류코드2)
        .input('세부코드', sql.VarChar(16), 세부코드2)
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
        .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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

// ✅ 거래명세서 작성 (자재입출내역에 INSERT + 회계전표 자동생성)
app.post('/api/transactions', async (req, res) => {
  const transaction = new sql.Transaction(pool);

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

    // 📋 필수 필드 검증 (데이터 품질 보장)
    if (!거래일자 || !매출처코드 || !details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: '필수 정보가 누락되었습니다. (거래일자, 매출처코드, 상세내역)',
      });
    }

    // 📅 거래일자 형식 및 범위 검증
    if (거래일자.length !== 8 || !/^\d{8}$/.test(거래일자)) {
      return res.status(400).json({
        success: false,
        message: '거래일자는 YYYYMMDD 형식(8자리 숫자)이어야 합니다.',
      });
    }

    const year = parseInt(거래일자.substring(0, 4));
    if (year < 1900 || year > 2100) {
      return res.status(400).json({
        success: false,
        message: '거래일자가 유효하지 않습니다. (1900년~2100년 사이여야 합니다)',
      });
    }

    // 🏢 매출처코드 검증 (빈값 방지)
    if (매출처코드.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '매출처코드는 필수입니다.',
      });
    }

    // 📦 상세내역 검증
    for (let i = 0; i < details.length; i++) {
      const detail = details[i];

      if (!detail.자재코드 || detail.자재코드.trim() === '') {
        return res.status(400).json({
          success: false,
          message: `${i + 1}번째 항목: 자재코드가 누락되었습니다.`,
        });
      }

      if (!detail.수량 || detail.수량 <= 0) {
        return res.status(400).json({
          success: false,
          message: `${i + 1}번째 항목: 수량은 0보다 커야 합니다.`,
        });
      }

      // 단가는 0 허용 (나중에 수정 가능)
      if (detail.단가 === null || detail.단가 === undefined) {
        return res.status(400).json({
          success: false,
          message: `${i + 1}번째 항목: 단가가 누락되었습니다.`,
        });
      }
    }

    // 트랜잭션 시작
    await transaction.begin();

    // 거래번호 생성 (로그 테이블 사용)
    const 베이스코드 = 거래일자; // YYYYMMDD
    const 테이블명 = '자재입출내역';

    // 로그 테이블에서 다음 번호 조회 및 업데이트
    const logResult = await new sql.Request(transaction)
      .input('테이블명', sql.VarChar(20), 테이블명)
      .input('베이스코드', sql.VarChar(20), 베이스코드).query(`
      SELECT 최종로그 FROM 로그
      WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
      `);

    let 거래번호;
    if (logResult.recordset.length > 0) {
      거래번호 = logResult.recordset[0].최종로그 + 1;
      await new sql.Request(transaction)
        .input('최종로그', sql.Real, 거래번호)
        .input('테이블명', sql.VarChar(20), 테이블명)
        .input('베이스코드', sql.VarChar(20), 베이스코드).query(`
        UPDATE 로그 SET 최종로그 = @최종로그
        WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
        `);
    } else {
      거래번호 = 1;
      await new sql.Request(transaction)
        .input('테이블명', sql.VarChar(20), 테이블명)
        .input('베이스코드', sql.VarChar(20), 베이스코드)
        .input('최종로그', sql.Real, 거래번호).query(`
        INSERT INTO 로그 (테이블명, 베이스코드, 최종로그)
        VALUES (@테이블명, @베이스코드, @최종로그)
        `);
    }

    const 수정일자 = 거래일자;

    // 💰 합계금액 계산
    let 총공급가액 = 0;
    let 총부가세 = 0;

    // ✅ 베이스 시간 생성 (품목별 입출고시간을 다르게 부여하기 위해)
    const baseTime = new Date();

    // 각 상세내역을 자재입출내역에 INSERT
    for (let index = 0; index < details.length; index++) {
      const detail = details[index];
      const { 자재코드, 수량, 단가 } = detail;

      // 자재코드 분리 (분류코드 2자리 + 세부코드 16자리)
      const 분류코드 = 자재코드.substring(0, 2);
      const 세부코드 = 자재코드.substring(2);

      const 출고수량 = 수량;
      const 출고단가 = 단가;
      const 출고부가 = Math.round(출고수량 * 출고단가 * 0.1); // 부가세 10%

      // 합계 누적
      총공급가액 += 출고수량 * 출고단가;
      총부가세 += 출고부가;

      // ✅ 품목별로 입출고시간 생성 (밀리초 증가로 입력 순서 보장)
      const itemTime = new Date(baseTime.getTime() + index);
      const 입출고시간 =
        itemTime.getHours().toString().padStart(2, '0') +
        itemTime.getMinutes().toString().padStart(2, '0') +
        itemTime.getSeconds().toString().padStart(2, '0') +
        itemTime.getMilliseconds().toString().padStart(3, '0');

      // ✅ CRITICAL FIX: 자재 및 자재원장 레코드 존재 확인 및 자동 생성
      // Step 1: 자재 테이블에 자재가 존재하는지 확인
      const materialCheck = await new sql.Request(transaction)
        .input('분류코드', sql.VarChar(2), 분류코드)
        .input('세부코드', sql.VarChar(16), 세부코드).query(`
          SELECT COUNT(*) as cnt FROM 자재
          WHERE 분류코드 = @분류코드
          AND 세부코드 = @세부코드
            AND 사용구분 = 0
            `);

      if (materialCheck.recordset[0].cnt === 0) {
        // 자재가 존재하지 않으면 트랜잭션 롤백 후 에러 반환
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `자재코드 ${자재코드}는 등록되지 않은 자재입니다. 먼저 자재내역관리에서 자재를 등록해주세요.`,
        });
      }

      // Step 2: 자재원장 레코드 존재 확인 및 자동 생성
      const ledgerCheck = await new sql.Request(transaction)
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('분류코드', sql.VarChar(2), 분류코드)
        .input('세부코드', sql.VarChar(16), 세부코드).query(`
          SELECT COUNT(*) as cnt FROM 자재원장
          WHERE 사업장코드 = @사업장코드
          AND 분류코드 = @분류코드
            AND 세부코드 = @세부코드
            `);

      if (ledgerCheck.recordset[0].cnt === 0) {
        console.log(`⚡ 자재원장 레코드 자동 생성: ${사업장코드}-${분류코드}-${세부코드}`);

        await new sql.Request(transaction)
          .input('사업장코드', sql.VarChar(2), 사업장코드)
          .input('분류코드', sql.VarChar(2), 분류코드)
          .input('세부코드', sql.VarChar(16), 세부코드)
          .input('수정일자', sql.VarChar(8), 수정일자)
          .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
            INSERT INTO 자재원장 (
              사업장코드, 분류코드, 세부코드,
              적정재고, 최저재고,
              최종입고일자, 최종출고일자,
              사용구분, 수정일자, 사용자코드,
              비고란, 주매입처코드,
              입고단가1, 입고단가2, 입고단가3,
              출고단가1, 출고단가2, 출고단가3
            ) VALUES (
              @사업장코드, @분류코드, @세부코드,
              0, 0,
              '', '',
              0, @수정일자, @사용자코드,
              '', '',
              0, 0, 0,
              0, 0, 0
              )
              `);
      }

      await new sql.Request(transaction)
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('분류코드', sql.VarChar(2), 분류코드)
        .input('세부코드', sql.VarChar(18), 세부코드)
        .input('입출고구분', sql.TinyInt, 입출고구분 || 2) // 기본: 출고
        .input('입출고일자', sql.VarChar(8), 거래일자)
        .input('입출고시간', sql.VarChar(9), 입출고시간)
        .input('출고수량', sql.Money, 출고수량)
        .input('출고단가', sql.Money, 출고단가)
        .input('출고부가', sql.Money, 출고부가)
        .input('매출처코드', sql.VarChar(8), 매출처코드)
        .input('거래일자', sql.VarChar(8), 거래일자)
        .input('거래번호', sql.Real, 거래번호)
        .input('적요', sql.VarChar(50), 적요 || '')
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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

    console.log(`✅ 자재입출내역 작성 완료: ${거래일자}-${거래번호} (${details.length}건)`);

    // 2️⃣ 미수금내역 자동 생성 (거래일자 기준)
    const 미수금입금금액 = 총공급가액 + 총부가세;

    // 거래시간 생성 (미수금내역용 - baseTime 사용)
    const 거래시간 =
      baseTime.getHours().toString().padStart(2, '0') +
      baseTime.getMinutes().toString().padStart(2, '0') +
      baseTime.getSeconds().toString().padStart(2, '0') +
      baseTime.getMilliseconds().toString().padStart(3, '0');

    await new sql.Request(transaction)
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매출처코드', sql.VarChar(8), 매출처코드)
      .input('미수금입금일자', sql.VarChar(8), 거래일자)
      .input('미수금입금시간', sql.VarChar(9), 거래시간)
      .input('미수금입금금액', sql.Money, 미수금입금금액)
      .input('결제방법', sql.TinyInt, 0) // 0=현금, 1=수표, 2=어음, 3=기타
      .input('만기일자', sql.VarChar(8), '')
      .input('어음번호', sql.VarChar(20), '')
      .input('적요', sql.VarChar(50), `거래명세서 ${거래일자}-${거래번호}`)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        INSERT INTO 미수금내역 (
          사업장코드, 매출처코드, 미수금입금일자, 미수금입금시간,
          미수금입금금액, 결제방법, 만기일자, 어음번호, 적요,
          수정일자, 사용자코드
          ) VALUES (
          @사업장코드, @매출처코드, @미수금입금일자, @미수금입금시간,
          @미수금입금금액, @결제방법, @만기일자, @어음번호, @적요,
          @수정일자, @사용자코드
          )
          `);

    console.log(`✅ 미수금내역 자동 생성: ${매출처코드} - ${미수금입금금액.toLocaleString()}원`);

    // 3️⃣ 회계전표 자동 생성 (Stored Procedure 호출)
    const 총매출금액 = 총공급가액 + 총부가세;

    // 매출처명 조회
    const customerResult = await new sql.Request(transaction)
      .input('매출처코드', sql.VarChar(8), 매출처코드)
      .query(`SELECT 매출처명 FROM 매출처 WHERE 매출처코드 = @매출처코드`);

    const 매출처명 =
      customerResult.recordset.length > 0 ? customerResult.recordset[0].매출처명 : '';

    // SP 호출: sp_거래명세서_회계전표_자동생성 (부가세 분리)
    const spResult = await new sql.Request(transaction)
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, 거래번호)
      .input('매출처코드', sql.VarChar(8), 매출처코드)
      .input('매출처명', sql.NVarChar(100), 매출처명)
      .input('공급가액', sql.Money, 총공급가액)
      .input('부가세액', sql.Money, 총부가세)
      .input('작성자코드', sql.VarChar(4), 사용자코드)
      .input('적요', sql.NVarChar(200), 적요 || null)
      .execute('sp_거래명세서_회계전표_자동생성');

    const 회계전표번호 = spResult.recordset[0]?.전표번호 || 'Unknown';
    console.log(`✅ 회계전표 자동 생성 (SP): ${회계전표번호}`);

    // 트랜잭션 커밋
    await transaction.commit();

    console.log(`✅ 거래명세서 작성 완료: ${거래일자}-${거래번호}`);

    // 사용자명 조회
    const userResult = await pool
      .request()
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`SELECT 사용자명 FROM 사용자 WHERE 사용자코드 = @사용자코드`);

    const 사용자명 =
      userResult.recordset.length > 0 ? userResult.recordset[0].사용자명 : '알 수 없음';

    res.json({
      success: true,
      message: '거래명세서, 미수금, 회계전표가 생성되었습니다.',
      data: {
        거래일자,
        거래번호,
        명세서번호: `${거래일자}-${거래번호}`,
        회계전표번호,
        미수금입금금액,
        총매출금액,
        사용자코드,
        사용자명,
        매출처코드,
        매출처명,
      },
    });
  } catch (err) {
    // 트랜잭션 롤백
    if (transaction) {
      await transaction.rollback();
      console.log('❌ 트랜잭션 롤백 완료');
    }

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

    console.log(`✅ 거래명세서 삭제 요청 (소프트 삭제): ${거래일자}-${거래번호}`);

    // 소프트 삭제: 사용구분을 9로 설정 (실제 데이터는 삭제하지 않음)
    const result = await pool
      .request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호)).query(`
        UPDATE 자재입출내역
        SET 사용구분 = 9
        WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호 AND 사용구분 = 0
        `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: '거래명세서를 찾을 수 없습니다.',
      });
    }

    console.log(
      `✅ 거래명세서 소프트 삭제 완료: ${거래일자}-${거래번호} (${result.rowsAffected[0]}건)`,
    );

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
    const checkResult = await pool
      .request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호)).query(`
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
    const result = await pool
      .request()
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
// 세금계산서관리 API (Tax Invoices)
// ================================
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

// 세금계산서 인쇄 API - 세금계산서A4인쇄sp.txt 기반
app.get('/api/tax-invoices/:작성년도/:책번호/:일련번호/print', async (req, res) => {
  try {
    const { 작성년도, 책번호, 일련번호 } = req.params;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    console.log('✅ 세금계산서 인쇄 조회 요청:', { 사업장코드, 작성년도, 책번호, 일련번호 });

    // 세금계산서A4백지_인쇄 SP 로직 (@ParintJangGbn = 0 - 세금계산서 테이블 조회)
    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성년도', sql.VarChar(4), 작성년도)
      .input('책번호', sql.Real, parseFloat(책번호))
      .input('일련번호', sql.Real, parseFloat(일련번호)).query(`
        SELECT T1.사업장코드, T1.작성년도, T1.책번호, T1.일련번호,
               T1.매출처코드,
               ISNULL(T3.사업자번호, '') AS 좌등록번호,
               ISNULL(T3.사업장명, '') AS 좌상호법인명,
               ISNULL(T3.대표자명, '') AS 좌성명,
               (ISNULL(T3.주소, '') + SPACE(1) + ISNULL(T3.번지, '')) AS 좌사업장주소,
               ISNULL(T3.업태, '') AS 좌업태,
               ISNULL(T3.업종, '') AS 좌종목,
               ISNULL(T3.전화번호, '') AS 좌전화번호,
               ISNULL(T3.팩스번호, '') AS 좌팩스번호,
               ISNULL(T2.사업자번호, '') AS 우등록번호,
               ISNULL(T2.매출처명, '') AS 우상호법인명,
               ISNULL(T2.대표자명, '') AS 우성명,
               (ISNULL(T2.주소, '') + SPACE(1) + ISNULL(T2.번지, '')) AS 우사업장주소,
               ISNULL(T2.업태, '') AS 우업태,
               ISNULL(T2.업종, '') AS 우종목,
               ISNULL(T2.전화번호, '') AS 우전화번호,
               ISNULL(T2.팩스번호, '') AS 우팩스번호,
               T1.작성일자,
               T1.공급가액,
               T1.세액,
               T1.품목및규격,
               T1.수량,
               T1.금액구분,
               T1.영청구분,
               T1.미수구분
          FROM 세금계산서 T1
          LEFT JOIN 매출처 T2 ON T2.매출처코드 = T1.매출처코드 AND T2.사업장코드 = T1.사업장코드
          LEFT JOIN 사업장 T3 ON T3.사업장코드 = T1.사업장코드
         WHERE T1.사업장코드 = @사업장코드
           AND T1.작성년도 = @작성년도
           AND T1.책번호 = @책번호
           AND T1.일련번호 = @일련번호
           AND T1.사용구분 = 0
         ORDER BY T1.사업장코드, T1.작성년도, T1.책번호, T1.일련번호
      `);

    if (result.recordset.length === 0) {
      return res.json({
        success: false,
        message: '세금계산서를 찾을 수 없습니다.',
      });
    }

    const data = result.recordset[0];

    res.json({
      success: true,
      data: {
        header: {
          // 좌측 (공급자 - 사업장)
          좌등록번호: data.좌등록번호,
          좌상호법인명: data.좌상호법인명,
          좌성명: data.좌성명,
          좌사업장주소: data.좌사업장주소,
          좌업태: data.좌업태,
          좌종목: data.좌종목,
          좌전화번호: data.좌전화번호,
          좌팩스번호: data.좌팩스번호,
          // 우측 (공급받는자 - 매출처)
          우등록번호: data.우등록번호,
          우상호법인명: data.우상호법인명,
          우성명: data.우성명,
          우사업장주소: data.우사업장주소,
          우업태: data.우업태,
          우종목: data.우종목,
          우전화번호: data.우전화번호,
          우팩스번호: data.우팩스번호,
          // 세금계산서 정보
          작성년도: data.작성년도,
          책번호: data.책번호,
          일련번호: data.일련번호,
          작성일자: data.작성일자,
          품목및규격: data.품목및규격,
          수량: data.수량,
          공급가액: data.공급가액,
          세액: data.세액,
          합계금액: (data.공급가액 || 0) + (data.세액 || 0),
          금액구분: data.금액구분,
          영청구분: data.영청구분,
          미수구분: data.미수구분,
        },
      },
    });

    console.log('✅ 세금계산서 인쇄 데이터 반환');
  } catch (err) {
    console.error('❌ 세금계산서 인쇄 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ✅ 세금계산서 목록 조회
app.get('/api/tax-invoices', async (req, res) => {
  try {
    const { 사업장코드, startDate, endDate, 발행여부 } = req.query;

    let query = `
      SELECT
        t.사업장코드,
        t.작성년도,
        t.책번호,
        t.일련번호,
        t.매출처코드,
        c.매출처명,
        c.사업자번호,
        t.작성일자,
        t.품목및규격,
        t.수량,
        t.공급가액,
        t.세액,
        t.금액구분,
        t.영청구분,
        t.발행여부,
        t.작성구분,
        t.미수구분,
        t.적요,
        t.사용구분,
        t.수정일자,
        t.사용자코드
      FROM 세금계산서 t
        LEFT JOIN 매출처 c ON t.매출처코드 = c.매출처코드 AND t.사업장코드 = c.사업장코드
      WHERE t.사업장코드 = @사업장코드
    `;

    const request = pool.request();
    request.input('사업장코드', sql.VarChar(2), 사업장코드 || '01');

    // 날짜 필터
    if (startDate) {
      query += ` AND t.작성일자 >= @startDate`;
      request.input('startDate', sql.VarChar(8), startDate);
    }
    if (endDate) {
      query += ` AND t.작성일자 <= @endDate`;
      request.input('endDate', sql.VarChar(8), endDate);
    }

    // 발행여부 필터
    if (발행여부 !== undefined && 발행여부 !== '') {
      query += ` AND t.발행여부 = @발행여부`;
      request.input('발행여부', sql.TinyInt, parseInt(발행여부));
    }

    query += ` ORDER BY t.작성일자 DESC, t.책번호 DESC, t.일련번호 DESC`;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (error) {
    console.error('세금계산서 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '세금계산서 목록 조회에 실패했습니다.',
      error: error.message,
    });
  }
});

// ========================================
// 📄 세금계산서 생성 (POST /api/tax-invoices)
// ========================================
app.post('/api/tax-invoices', async (req, res) => {
  let transaction;
  try {
    const {
      작성일자,
      매출처코드,
      품목및규격,
      수량,
      공급가액,
      세액,
      적요,
      발행구분, // 'A' = 임의 발행, 'T' = 거래 발행
    } = req.body;

    // 세션 사용자 정보
    const 사업장코드 = req.session.user?.사업장코드 || '01';
    const 사용자코드 = req.session.user?.사용자코드 || '8080';

    console.log('='.repeat(80));
    console.log('📝 [API 호출] 세금계산서 발행');
    console.log(`📋 요청 데이터:`, {
      사업장코드,
      작성일자,
      매출처코드,
      품목및규격,
      수량,
      공급가액,
      세액,
      적요,
      발행구분,
      사용자코드,
    });
    console.log('='.repeat(80));

    // 📋 필수 필드 검증
    if (!작성일자 || !매출처코드 || !품목및규격) {
      return res.status(400).json({
        success: false,
        message: '필수 정보가 누락되었습니다. (작성일자, 매출처코드, 품목및규격)',
      });
    }

    // 📅 작성일자 형식 및 범위 검증
    if (작성일자.length !== 8 || !/^\d{8}$/.test(작성일자)) {
      return res.status(400).json({
        success: false,
        message: '작성일자는 YYYYMMDD 형식(8자리 숫자)이어야 합니다.',
      });
    }

    const year = parseInt(작성일자.substring(0, 4));
    if (year < 1900 || year > 2100) {
      return res.status(400).json({
        success: false,
        message: '작성일자가 유효하지 않습니다. (1900년~2100년 사이여야 합니다)',
      });
    }

    // 📅 작성년도 추출
    const 작성년도 = 작성일자.substring(0, 4);

    // 트랜잭션 시작
    const pool = await sql.connect(dbConfig);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log(`🔢 세금계산서 번호 생성 중... (작성년도: ${작성년도})`);

    // 1️⃣ 책번호, 일련번호 생성 (로그 테이블 사용)
    const 베이스코드 = `${사업장코드}${작성년도}`;
    const 테이블명 = '세금계산서';

    const logRequest = new sql.Request(transaction);
    const logResult = await logRequest
      .input('테이블명', sql.VarChar(50), 테이블명)
      .input('베이스코드', sql.VarChar(50), 베이스코드).query(`
        SELECT 최종로그, 최종로그1 FROM 로그
        WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
      `);

    let 책번호 = 1;
    let 일련번호 = 1;

    if (logResult.recordset.length > 0) {
      const log = logResult.recordset[0];
      책번호 = (log.최종로그 || 0) + 1;
      일련번호 = (log.최종로그1 || 0) + 1;

      // 책번호가 999를 초과하면 다음 책으로 넘어가고 일련번호 리셋
      if (일련번호 > 999) {
        책번호 += 1;
        일련번호 = 1;
      }

      await logRequest.query(`
        UPDATE 로그
        SET 최종로그 = ${책번호},
            최종로그1 = ${일련번호},
            수정일자 = '${new Date().toISOString().split('T')[0].replace(/-/g, '')}',
            사용자코드 = '${사용자코드}'
        WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
      `);
    } else {
      await logRequest
        .input('수정일자', sql.VarChar(8), new Date().toISOString().split('T')[0].replace(/-/g, ''))
        .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
          INSERT INTO 로그 (테이블명, 베이스코드, 최종로그, 최종로그1, 수정일자, 사용자코드)
          VALUES (@테이블명, @베이스코드, ${책번호}, ${일련번호}, @수정일자, @사용자코드)
        `);
    }

    console.log(`✅ 생성된 번호: 책번호=${책번호}, 일련번호=${일련번호}`);

    // 2️⃣ 세금계산서 INSERT
    const 수정일자 = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // 발행구분에 따라 발행여부 결정
    // 'T' (거래 발행) → 발행여부='1' (즉시 발행됨, 미수금내역 생성됨)
    // 'A' (임의 발행) → 발행여부='0' (미발행, 작성중)
    const 발행여부 = 발행구분 === 'T' ? '1' : '0';

    const insertRequest = new sql.Request(transaction);
    await insertRequest
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성년도', sql.VarChar(4), 작성년도)
      .input('책번호', sql.Real, 책번호)
      .input('일련번호', sql.Real, 일련번호)
      .input('작성일자', sql.VarChar(8), 작성일자)
      .input('매출처코드', sql.VarChar(8), 매출처코드)
      .input('품목및규격', sql.NVarChar(100), 품목및규격)
      .input('수량', sql.Real, 수량 || 0)
      .input('공급가액', sql.Money, 공급가액 || 0)
      .input('세액', sql.Money, 세액 || 0)
      .input('적요', sql.NVarChar(100), 적요 || '')
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('금액구분', sql.VarChar(1), '0')
      .input('영청구분', sql.VarChar(1), '0')
      .input('발행여부', sql.VarChar(1), 발행여부)
      .input('작성구분', sql.VarChar(1), '0')
      .input('미수구분', sql.VarChar(1), '0')
      .input('사용구분', sql.VarChar(1), '0').query(`
        INSERT INTO 세금계산서 (
          사업장코드, 작성년도, 책번호, 일련번호, 작성일자,
          매출처코드, 품목및규격, 수량, 공급가액, 세액,
          적요, 사용자코드, 수정일자,
          금액구분, 영청구분, 발행여부, 작성구분, 미수구분, 사용구분
        ) VALUES (
          @사업장코드, @작성년도, @책번호, @일련번호, @작성일자,
          @매출처코드, @품목및규격, @수량, @공급가액, @세액,
          @적요, @사용자코드, @수정일자,
          @금액구분, @영청구분, @발행여부, @작성구분, @미수구분, @사용구분
        )
      `);

    console.log('✅ 세금계산서 INSERT 완료!');

    // 3️⃣ 거래 발행인 경우 미수금내역 자동 생성
    if (발행구분 === 'T') {
      console.log(`💰 거래 발행 → 미수금내역 자동 생성 중...`);

      const 합계금액 = 공급가액 + 세액;

      const receivableRequest = new sql.Request(transaction);
      await receivableRequest
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('매출처코드', sql.VarChar(8), 매출처코드)
        .input('미수금발생일자', sql.VarChar(8), 작성일자)
        .input('미수금발생금액', sql.Money, 합계금액)
        .input('적요', sql.NVarChar(100), 적요 || `세금계산서 ${작성년도}-${책번호}-${일련번호}`)
        .input('사용자코드', sql.VarChar(4), 사용자코드)
        .input('수정일자', sql.VarChar(8), new Date().toISOString().split('T')[0].replace(/-/g, ''))
        .query(`
          INSERT INTO 미수금내역 (
            사업장코드, 매출처코드, 미수금발생일자, 미수금발생금액,
            적요, 사용자코드, 수정일자
          ) VALUES (
            @사업장코드, @매출처코드, @미수금발생일자, @미수금발생금액,
            @적요, @사용자코드, @수정일자
          )
        `);

      console.log(`✅ 미수금내역 생성 완료! (금액: ${합계금액.toLocaleString()}원)`);
    }

    // 트랜잭션 커밋
    await transaction.commit();

    console.log('✅ 세금계산서 발행 완료!');
    console.log('='.repeat(80));

    // 4️⃣ 매출처 정보 조회하여 응답
    const customerResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매출처코드', sql.VarChar(8), 매출처코드).query(`
        SELECT 매출처코드, 매출처명
        FROM 매출처
        WHERE 사업장코드 = @사업장코드 AND 매출처코드 = @매출처코드
      `);

    const 매출처명 = customerResult.recordset[0]?.매출처명 || '';

    // 4️⃣ 사용자 정보 조회
    const userResult = await pool.request().input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        SELECT 사용자명
        FROM 사용자
        WHERE 사용자코드 = @사용자코드
      `);

    const 사용자명 = userResult.recordset[0]?.사용자명 || '';

    res.json({
      success: true,
      message: '세금계산서가 성공적으로 발행되었습니다.',
      data: {
        사업장코드,
        작성년도,
        책번호,
        일련번호,
        작성일자,
        매출처코드,
        매출처명,
        품목및규격,
        수량,
        공급가액,
        세액,
        합계: 공급가액 + 세액,
        적요,
        사용자코드,
        사용자명,
      },
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
        console.log('❌ 트랜잭션 롤백됨');
      } catch (rollbackErr) {
        console.error('❌ 롤백 실패:', rollbackErr.message);
      }
    }

    console.error('❌ 세금계산서 발행 오류:', err.message);
    console.error(err);
    console.log('='.repeat(80));

    res.status(500).json({
      success: false,
      message: '세금계산서 발행 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
});

// ✅ 세금계산서 상세 조회 (매출처 정보 + 자재입출내역 포함)
app.get('/api/tax-invoices/:사업장코드/:작성년도/:책번호/:일련번호', async (req, res) => {
  try {
    const { 사업장코드, 작성년도, 책번호, 일련번호 } = req.params;

    console.log('='.repeat(80));
    console.log(`🔍 [API 호출] 세금계산서 상세 조회`);
    console.log(
      `📋 요청 파라미터: 사업장코드=${사업장코드}, 작성년도=${작성년도}, 책번호=${책번호}, 일련번호=${일련번호}`,
    );
    console.log('='.repeat(80));

    // 1. 세금계산서 기본 정보 조회
    const masterQuery = `
      SELECT
        t.사업장코드,
        t.작성년도,
        t.책번호,
        t.일련번호,
        t.매출처코드,
        c.매출처명,
        c.사업자번호,
        c.대표자명,
        c.업태,
        c.업종,
        c.주소,
        c.번지,
        c.전화번호,
        c.팩스번호,
        t.작성일자,
        t.품목및규격,
        t.수량,
        t.공급가액,
        t.세액,
        t.금액구분,
        t.영청구분,
        t.발행여부,
        t.작성구분,
        t.미수구분,
        t.적요,
        t.사용구분,
        t.수정일자,
        t.사용자코드,
        u.사용자명
      FROM 세금계산서 t
        LEFT JOIN 매출처 c ON t.매출처코드 = c.매출처코드 AND t.사업장코드 = c.사업장코드
        LEFT JOIN 사용자 u ON t.사용자코드 = u.사용자코드
      WHERE t.사업장코드 = @사업장코드
        AND t.작성년도 = @작성년도
        AND t.책번호 = @책번호
        AND t.일련번호 = @일련번호
    `;

    console.log('📊 [Step 1] 세금계산서 마스터 정보 조회 시작...');
    const masterResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성년도', sql.VarChar(4), 작성년도)
      .input('책번호', sql.Real, parseFloat(책번호))
      .input('일련번호', sql.Real, parseFloat(일련번호))
      .query(masterQuery);

    console.log(`✅ [Step 1] 세금계산서 마스터 조회 완료: ${masterResult.recordset.length}건`);

    if (masterResult.recordset.length === 0) {
      console.log('❌ 세금계산서를 찾을 수 없습니다.');
      return res.status(404).json({
        success: false,
        message: '세금계산서를 찾을 수 없습니다.',
      });
    }

    const taxInvoice = masterResult.recordset[0];
    console.log('📄 세금계산서 정보:', taxInvoice);

    // 2. 관련 자재입출내역 조회 (세금계산서 작성년도, 책번호, 일련번호 기준)
    const detailQuery = `
      SELECT
        i.거래일자,
        i.거래번호,
        i.분류코드,
        i.세부코드,
        (i.분류코드 + i.세부코드) AS 자재코드,
        m.자재명,
        m.규격,
        m.단위,
        ISNULL(i.출고수량, 0) AS 수량,
        ISNULL(i.출고단가, 0) AS 단가,
        ISNULL(i.출고수량, 0) * ISNULL(i.출고단가, 0) AS 공급가액,
        ISNULL(i.출고부가, 0) AS 부가세,
        (ISNULL(i.출고수량, 0) * ISNULL(i.출고단가, 0)) + ISNULL(i.출고부가, 0) AS 합계금액,
        i.계산서발행여부,
        i.적요
      FROM 자재입출내역 i
        LEFT JOIN 자재 m ON i.분류코드 = m.분류코드 AND i.세부코드 = m.세부코드
      WHERE i.사업장코드 = @사업장코드
        AND i.작성년도 = @작성년도
        AND i.책번호 = @책번호
        AND i.일련번호 = @일련번호
        AND i.입출고구분 = 2
      ORDER BY i.거래번호, m.자재명
    `;

    console.log('📊 [Step 2] 자재입출내역 조회 시작...');
    console.log(
      `🔍 검색 조건: 사업장코드=${사업장코드}, 작성년도=${작성년도}, 책번호=${책번호}, 일련번호=${일련번호}`,
    );

    const detailResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성년도', sql.VarChar(4), 작성년도)
      .input('책번호', sql.Real, parseFloat(책번호))
      .input('일련번호', sql.Real, parseFloat(일련번호))
      .query(detailQuery);

    console.log(`✅ [Step 2] 자재입출내역 조회 완료: ${detailResult.recordset.length}건`);

    if (detailResult.recordset.length > 0) {
      console.log('📦 첫 번째 품목 정보:');
      console.log('  - 자재코드:', detailResult.recordset[0].자재코드);
      console.log('  - 자재명:', detailResult.recordset[0].자재명);
      console.log('  - 규격:', detailResult.recordset[0].규격);
      console.log('  - 수량:', detailResult.recordset[0].수량);
      console.log('  - 단가:', detailResult.recordset[0].단가);
    } else {
      console.log('⚠️ 자재입출내역이 없습니다!');
      console.log('💡 다음을 확인해주세요:');
      console.log('   1. 자재입출내역 테이블에 작성년도, 책번호, 일련번호 필드가 정확한지');
      console.log('   2. 세금계산서 생성 시 자재입출내역 레코드가 생성되었는지');
      console.log('   3. 입출고구분이 2(출고)로 설정되어 있는지');
    }
    console.log('='.repeat(80));

    res.json({
      success: true,
      data: {
        master: taxInvoice,
        details: detailResult.recordset,
      },
    });
  } catch (error) {
    console.error('세금계산서 상세 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '세금계산서 상세 조회에 실패했습니다.',
      error: error.message,
    });
  }
});

// ✅ 세금계산서 수정
app.put('/api/tax-invoices/:사업장코드/:작성년도/:책번호/:일련번호', async (req, res) => {
  try {
    const { 사업장코드, 작성년도, 책번호, 일련번호 } = req.params;
    const { 작성일자, 품목및규격, 수량, 공급가액, 세액, 발행여부, 적요 } = req.body;

    const 사용자코드 = req.session?.user?.사용자코드 || '8080';
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const query = `
      UPDATE 세금계산서
      SET
        작성일자 = @작성일자,
        품목및규격 = @품목및규격,
        수량 = @수량,
        공급가액 = @공급가액,
        세액 = @세액,
        발행여부 = @발행여부,
        적요 = @적요,
        수정일자 = @수정일자,
        사용자코드 = @사용자코드
      WHERE 사업장코드 = @사업장코드
        AND 작성년도 = @작성년도
        AND 책번호 = @책번호
        AND 일련번호 = @일련번호
    `;

    await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성년도', sql.VarChar(4), 작성년도)
      .input('책번호', sql.Real, parseFloat(책번호))
      .input('일련번호', sql.Real, parseFloat(일련번호))
      .input('작성일자', sql.VarChar(8), 작성일자)
      .input('품목및규격', sql.VarChar(50), 품목및규격)
      .input('수량', sql.Real, parseFloat(수량))
      .input('공급가액', sql.Money, parseFloat(공급가액))
      .input('세액', sql.Money, parseFloat(세액))
      .input('발행여부', sql.TinyInt, parseInt(발행여부))
      .input('적요', sql.VarChar(50), 적요 || '')
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(query);

    res.json({
      success: true,
      message: '세금계산서가 수정되었습니다.',
    });
  } catch (error) {
    console.error('세금계산서 수정 실패:', error);
    res.status(500).json({
      success: false,
      message: '세금계산서 수정에 실패했습니다.',
      error: error.message,
    });
  }
});

// ✅ 세금계산서 삭제 (소프트 삭제 - 사용구분 9)
app.delete('/api/tax-invoices/:사업장코드/:작성년도/:책번호/:일련번호', async (req, res) => {
  try {
    const { 사업장코드, 작성년도, 책번호, 일련번호 } = req.params;

    const 사용자코드 = req.session?.user?.사용자코드 || '8080';
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    console.log('='.repeat(80));
    console.log(
      `🗑️ [세금계산서 삭제] 사업장코드=${사업장코드}, 작성년도=${작성년도}, 책번호=${책번호}, 일련번호=${일련번호}`,
    );
    console.log(`👤 삭제 사용자: ${사용자코드}, 수정일자: ${수정일자}`);
    console.log('='.repeat(80));

    // Step 1: 세금계산서 테이블 사용구분 = 9 업데이트
    const taxInvoiceQuery = `
      UPDATE 세금계산서
      SET
        사용구분 = 9,
        수정일자 = @수정일자,
        사용자코드 = @사용자코드
      WHERE 사업장코드 = @사업장코드
        AND 작성년도 = @작성년도
        AND 책번호 = @책번호
        AND 일련번호 = @일련번호
    `;

    await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성년도', sql.VarChar(4), 작성년도)
      .input('책번호', sql.Real, parseFloat(책번호))
      .input('일련번호', sql.Real, parseFloat(일련번호))
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(taxInvoiceQuery);

    console.log('✅ [Step 1] 세금계산서 테이블 사용구분 = 9 업데이트 완료');

    // Step 2: 자재입출내역 테이블 사용구분 = 9 업데이트
    const inventoryQuery = `
      UPDATE 자재입출내역
      SET
        사용구분 = 9,
        수정일자 = @수정일자,
        사용자코드 = @사용자코드
      WHERE 사업장코드 = @사업장코드
        AND 작성년도 = @작성년도
        AND 책번호 = @책번호
        AND 일련번호 = @일련번호
        AND 입출고구분 = 2
    `;

    const inventoryResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성년도', sql.VarChar(4), 작성년도)
      .input('책번호', sql.Real, parseFloat(책번호))
      .input('일련번호', sql.Real, parseFloat(일련번호))
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(inventoryQuery);

    console.log(
      `✅ [Step 2] 자재입출내역 테이블 사용구분 = 9 업데이트 완료 (${inventoryResult.rowsAffected[0]}건)`,
    );
    console.log('='.repeat(80));

    res.json({
      success: true,
      message: '세금계산서가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('❌ 세금계산서 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '세금계산서 삭제에 실패했습니다.',
      error: error.message,
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
      ORDER BY t.거래일자 ASC, t.거래번호 ASC
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
        ORDER BY i.입출고시간
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

// ✅ 매입전표 작성 (자재입출내역에 INSERT + 회계전표 자동생성)
app.post('/api/purchase-statements', async (req, res) => {
  const transaction = new sql.Transaction(pool);

  try {
    const { 거래일자, 입출고구분, 매입처코드, 적요, details } = req.body;

    // 디버깅: 받은 데이터 로그
    console.log('📥 매입전표 작성 요청 받음:', {
      거래일자,
      입출고구분,
      매입처코드: `'${매입처코드}'`,
      매입처코드길이: 매입처코드?.length || 0,
      적요,
      품목수: details?.length || 0,
    });

    // 세션 검증
    const 사용자코드 = req.session?.user?.사용자코드;
    const 사업장코드 = req.session?.user?.사업장코드;

    if (!사용자코드 || !사업장코드) {
      return res.status(401).json({
        success: false,
        message: '로그인이 필요합니다.',
      });
    }

    // 📋 필수 필드 검증 (데이터 품질 보장)
    if (!거래일자 || !매입처코드 || !details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: '필수 정보가 누락되었습니다. (거래일자, 매입처코드, 상세내역)',
      });
    }

    // 📅 거래일자 형식 및 범위 검증
    if (거래일자.length !== 8 || !/^\d{8}$/.test(거래일자)) {
      return res.status(400).json({
        success: false,
        message: '거래일자는 YYYYMMDD 형식(8자리 숫자)이어야 합니다.',
      });
    }

    const year = parseInt(거래일자.substring(0, 4));
    if (year < 1900 || year > 2100) {
      return res.status(400).json({
        success: false,
        message: '거래일자가 유효하지 않습니다. (1900년~2100년 사이여야 합니다)',
      });
    }

    // 🏢 매입처코드 검증 (빈값 방지)
    if (매입처코드.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '매입처코드는 필수입니다.',
      });
    }

    // 📦 상세내역 검증
    for (let i = 0; i < details.length; i++) {
      const detail = details[i];

      if (!detail.자재코드 || detail.자재코드.trim() === '') {
        return res.status(400).json({
          success: false,
          message: `${i + 1}번째 항목: 자재코드가 누락되었습니다.`,
        });
      }

      if (!detail.수량 || detail.수량 <= 0) {
        return res.status(400).json({
          success: false,
          message: `${i + 1}번째 항목: 수량은 0보다 커야 합니다.`,
        });
      }

      // 단가는 0 허용 (나중에 수정 가능)
      if (detail.단가 === null || detail.단가 === undefined) {
        return res.status(400).json({
          success: false,
          message: `${i + 1}번째 항목: 단가가 누락되었습니다.`,
        });
      }
    }

    // 트랜잭션 시작
    await transaction.begin();

    // 거래번호 생성 (로그 테이블 사용)
    const 베이스코드 = 거래일자;
    const 테이블명 = '자재입출내역';

    const logResult = await new sql.Request(transaction)
      .input('테이블명', sql.VarChar(20), 테이블명)
      .input('베이스코드', sql.VarChar(20), 베이스코드).query(`
        SELECT 최종로그 FROM 로그
        WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
      `);

    let 거래번호;
    if (logResult.recordset.length > 0) {
      거래번호 = logResult.recordset[0].최종로그 + 1;
      await new sql.Request(transaction)
        .input('최종로그', sql.Real, 거래번호)
        .input('테이블명', sql.VarChar(20), 테이블명)
        .input('베이스코드', sql.VarChar(20), 베이스코드).query(`
          UPDATE 로그 SET 최종로그 = @최종로그
          WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
        `);
    } else {
      거래번호 = 1;
      await new sql.Request(transaction)
        .input('테이블명', sql.VarChar(20), 테이블명)
        .input('베이스코드', sql.VarChar(20), 베이스코드)
        .input('최종로그', sql.Real, 거래번호).query(`
          INSERT INTO 로그 (테이블명, 베이스코드, 최종로그)
          VALUES (@테이블명, @베이스코드, @최종로그)
        `);
    }

    // ✅ 베이스 시간 생성 (품목별 입출고시간을 다르게 부여하기 위해)
    const baseTime = new Date();

    const 수정일자 = 거래일자;

    // 💰 합계금액 계산 (미지급금 발생 금액)
    let 총공급가액 = 0;
    let 총부가세 = 0;

    // 1️⃣ 각 상세내역을 자재입출내역에 INSERT
    for (let index = 0; index < details.length; index++) {
      const detail = details[index];
      const { 자재코드, 수량, 단가 } = detail;

      const 분류코드 = 자재코드.substring(0, 2);
      const 세부코드 = 자재코드.substring(2);

      const 입고수량 = 수량;
      const 입고단가 = 단가;
      const 입고부가 = Math.round(입고수량 * 입고단가 * 0.1);

      // 합계 누적
      총공급가액 += 입고수량 * 입고단가;
      총부가세 += 입고부가;

      // ✅ 품목별로 입출고시간 생성 (밀리초 증가로 입력 순서 보장)
      const itemTime = new Date(baseTime.getTime() + index);
      const 입출고시간 =
        itemTime.getHours().toString().padStart(2, '0') +
        itemTime.getMinutes().toString().padStart(2, '0') +
        itemTime.getSeconds().toString().padStart(2, '0') +
        itemTime.getMilliseconds().toString().padStart(3, '0');

      await new sql.Request(transaction)
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('분류코드', sql.VarChar(2), 분류코드)
        .input('세부코드', sql.VarChar(18), 세부코드)
        .input('입출고구분', sql.TinyInt, 입출고구분 || 1) // 기본: 입고
        .input('입출고일자', sql.VarChar(8), 거래일자)
        .input('입출고시간', sql.VarChar(9), 입출고시간)
        .input('입고수량', sql.Money, 입고수량)
        .input('입고단가', sql.Money, 입고단가)
        .input('입고부가', sql.Money, 입고부가)
        .input('매입처코드', sql.VarChar(8), 매입처코드)
        .input('거래일자', sql.VarChar(8), 거래일자)
        .input('거래번호', sql.Real, 거래번호)
        .input('적요', sql.VarChar(50), 적요 || '')
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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

    // 거래시간 생성 (미지급금내역용)
    const 거래시간 =
      baseTime.getHours().toString().padStart(2, '0') +
      baseTime.getMinutes().toString().padStart(2, '0') +
      baseTime.getSeconds().toString().padStart(2, '0') +
      baseTime.getMilliseconds().toString().padStart(3, '0');

    await new sql.Request(transaction)
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
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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

    console.log(
      `✅ 미지급금내역 자동 생성: ${매입처코드} - ${미지급금지급금액.toLocaleString()}원`,
    );

    // 3️⃣ 회계전표 자동 생성 (Stored Procedure 호출)
    // 매입처명 조회
    const supplierResult = await new sql.Request(transaction)
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .query(`SELECT 매입처명 FROM 매입처 WHERE 매입처코드 = @매입처코드`);

    const 매입처명 =
      supplierResult.recordset.length > 0 ? supplierResult.recordset[0].매입처명 : '';

    // SP 호출 (부가세 분리)
    const spResult = await new sql.Request(transaction)
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, 거래번호)
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .input('매입처명', sql.NVarChar(100), 매입처명)
      .input('공급가액', sql.Money, 총공급가액)
      .input('부가세액', sql.Money, 총부가세)
      .input('작성자코드', sql.VarChar(4), 사용자코드)
      .input('적요', sql.NVarChar(200), 적요 || null)
      .execute('sp_매입전표_회계전표_자동생성');

    const 회계전표번호 = spResult.recordset.length > 0 ? spResult.recordset[0].전표번호 : null;

    console.log(`✅ 회계전표 자동 생성 (SP): ${회계전표번호}`);

    // 트랜잭션 커밋
    await transaction.commit();

    console.log(`✅ 매입전표 작성 완료: ${거래일자}-${거래번호}`);

    // 사용자명 조회
    const userResult = await pool
      .request()
      .input('사용자코드', sql.VarChar(4), 사용자코드)
      .query(`SELECT 사용자명 FROM 사용자 WHERE 사용자코드 = @사용자코드`);

    const 사용자명 =
      userResult.recordset.length > 0 ? userResult.recordset[0].사용자명 : '알 수 없음';

    res.json({
      success: true,
      message: '매입전표, 미지급금, 회계전표가 생성되었습니다.',
      data: {
        거래일자,
        거래번호,
        전표번호: `${거래일자}-${거래번호}`,
        회계전표번호,
        미지급금지급금액,
        사용자코드,
        사용자명,
        매입처코드,
        매입처명,
      },
    });
  } catch (err) {
    // 트랜잭션 롤백
    if (transaction) {
      await transaction.rollback();
      console.log('❌ 트랜잭션 롤백 완료');
    }

    console.error('❌ 매입전표 작성 에러:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ✅ 매입전표 수정 (회계전표 및 미지급금 자동 업데이트)
app.put('/api/purchase-statements/:date/:no', requireAuth, async (req, res) => {
  const transaction = new sql.Transaction(pool);

  try {
    const { date: 거래일자, no: 거래번호 } = req.params;
    const { 입출고구분, 매입처코드, 적요, details } = req.body;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';

    console.log(`✅ 매입전표 수정 요청: ${거래일자}-${거래번호}`);

    // 유효성 검사
    if (!details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: '최소 1개 이상의 품목이 필요합니다.',
      });
    }

    if (!매입처코드) {
      return res.status(400).json({
        success: false,
        message: '매입처코드가 필요합니다.',
      });
    }

    // 트랜잭션 시작
    await transaction.begin();

    // 1️⃣ 기존 자재입출내역 삭제
    await new sql.Request(transaction)
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호))
      .input('입출고구분', sql.TinyInt, 1) // 입고 (매입)
      .query(`
        DELETE FROM 자재입출내역
        WHERE 거래일자 = @거래일자
          AND 거래번호 = @거래번호
          AND 입출고구분 = @입출고구분
      `);

    console.log(`✅ 기존 자재입출내역 삭제 완료: ${거래일자}-${거래번호}`);

    // 2️⃣ 기존 미지급금내역 삭제 (적요 패턴 기준)
    await new sql.Request(transaction)
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .input('적요', sql.VarChar(50), `매입전표 ${거래일자}-${거래번호}`).query(`
        DELETE FROM 미지급금내역
        WHERE 사업장코드 = @사업장코드
          AND 매입처코드 = @매입처코드
          AND 적요 = @적요
      `);

    console.log(`✅ 기존 미지급금내역 삭제 완료: ${거래일자}-${거래번호}`);

    // 3️⃣ 기존 회계전표 삭제 (적요 패턴 기준)
    await new sql.Request(transaction)
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성일자', sql.VarChar(8), 거래일자)
      .input('적요패턴', sql.NVarChar(100), `%매입전표 ${거래일자}-${거래번호}%`).query(`
        DELETE FROM 회계전표내역
        WHERE 사업장코드 = @사업장코드
          AND 작성일자 = @작성일자
          AND 적요 LIKE @적요패턴
      `);

    console.log(`✅ 기존 회계전표 삭제 완료: ${거래일자}-${거래번호}`);

    // 4️⃣ 베이스 시간 생성 (품목별 입출고시간을 다르게 부여하기 위해)
    const baseTime = new Date();

    const 수정일자 = 거래일자;

    // 💰 합계금액 계산
    let 총공급가액 = 0;
    let 총부가세 = 0;

    // 5️⃣ 새로운 자재입출내역 INSERT
    for (let index = 0; index < details.length; index++) {
      const detail = details[index];
      const { 자재코드, 수량, 단가 } = detail;

      const 분류코드 = 자재코드.substring(0, 2);
      const 세부코드 = 자재코드.substring(2);

      const 입고수량 = 수량;
      const 입고단가 = 단가;
      const 입고부가 = Math.round(입고수량 * 입고단가 * 0.1);

      // 합계 누적
      총공급가액 += 입고수량 * 입고단가;
      총부가세 += 입고부가;

      // ✅ 품목별로 입출고시간 생성 (밀리초 증가로 입력 순서 보장)
      const itemTime = new Date(baseTime.getTime() + index);
      const 입출고시간 =
        itemTime.getHours().toString().padStart(2, '0') +
        itemTime.getMinutes().toString().padStart(2, '0') +
        itemTime.getSeconds().toString().padStart(2, '0') +
        itemTime.getMilliseconds().toString().padStart(3, '0');

      await new sql.Request(transaction)
        .input('사업장코드', sql.VarChar(2), 사업장코드)
        .input('분류코드', sql.VarChar(2), 분류코드)
        .input('세부코드', sql.VarChar(18), 세부코드)
        .input('입출고구분', sql.TinyInt, 입출고구분 || 1)
        .input('입출고일자', sql.VarChar(8), 거래일자)
        .input('입출고시간', sql.VarChar(9), 입출고시간)
        .input('입고수량', sql.Money, 입고수량)
        .input('입고단가', sql.Money, 입고단가)
        .input('입고부가', sql.Money, 입고부가)
        .input('매입처코드', sql.VarChar(8), 매입처코드)
        .input('거래일자', sql.VarChar(8), 거래일자)
        .input('거래번호', sql.Real, parseFloat(거래번호))
        .input('적요', sql.VarChar(50), detail.적요 || 적요 || '')
        .input('수정일자', sql.VarChar(8), 수정일자)
        .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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

    console.log(`✅ 자재입출내역 재생성 완료: ${거래일자}-${거래번호} (${details.length}건)`);

    // 6️⃣ 미지급금내역 재생성
    const 미지급금지급금액 = 총공급가액 + 총부가세;

    // 미지급금 시간 생성 (자재입출내역용 baseTime과 동일)
    const 거래시간 =
      baseTime.getHours().toString().padStart(2, '0') +
      baseTime.getMinutes().toString().padStart(2, '0') +
      baseTime.getSeconds().toString().padStart(2, '0') +
      baseTime.getMilliseconds().toString().padStart(3, '0');

    await new sql.Request(transaction)
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .input('미지급금지급일자', sql.VarChar(8), 거래일자)
      .input('미지급금지급시간', sql.VarChar(9), 거래시간)
      .input('미지급금지급금액', sql.Money, 미지급금지급금액)
      .input('결제방법', sql.VarChar(10), '')
      .input('만기일자', sql.VarChar(8), '')
      .input('어음번호', sql.VarChar(20), '')
      .input('적요', sql.VarChar(50), `매입전표 ${거래일자}-${거래번호}`)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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

    console.log(`✅ 미지급금내역 재생성 완료: ${미지급금지급금액.toLocaleString()}원`);

    // 7️⃣ 회계전표 재생성 (Stored Procedure 호출)
    const supplierResult = await new sql.Request(transaction)
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .query(`SELECT 매입처명 FROM 매입처 WHERE 매입처코드 = @매입처코드`);

    const 매입처명 =
      supplierResult.recordset.length > 0 ? supplierResult.recordset[0].매입처명 : '';

    const spResult = await new sql.Request(transaction)
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호))
      .input('매입처코드', sql.VarChar(8), 매입처코드)
      .input('매입처명', sql.NVarChar(100), 매입처명)
      .input('공급가액', sql.Money, 총공급가액)
      .input('부가세액', sql.Money, 총부가세)
      .input('작성자코드', sql.VarChar(4), 사용자코드)
      .input('적요', sql.NVarChar(200), 적요 || null)
      .execute('sp_매입전표_회계전표_자동생성');

    const 회계전표번호 = spResult.recordset.length > 0 ? spResult.recordset[0].전표번호 : null;

    console.log(`✅ 회계전표 재생성 완료 (SP): ${회계전표번호}`);

    // 트랜잭션 커밋
    await transaction.commit();

    console.log(`✅ 매입전표 수정 완료 (회계전표 자동 업데이트): ${거래일자}-${거래번호}`);

    res.json({
      success: true,
      message: '매입전표, 미지급금, 회계전표가 수정되었습니다.',
      data: {
        거래일자,
        거래번호,
        전표번호: `${거래일자}-${거래번호}`,
        회계전표번호,
        미지급금지급금액,
        총공급가액,
        총부가세,
      },
    });
  } catch (err) {
    // 트랜잭션 롤백
    if (transaction) {
      await transaction.rollback();
      console.log('❌ 트랜잭션 롤백 완료');
    }

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

    console.log(`✅ 매입전표 삭제 요청 (소프트 삭제): ${거래일자}-${거래번호}`);

    // 소프트 삭제: 사용구분을 9로 설정 (실제 데이터는 삭제하지 않음)
    const result = await pool
      .request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, parseFloat(거래번호)).query(`
        UPDATE 자재입출내역
        SET 사용구분 = 9
        WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호 AND 사용구분 = 0
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: '매입전표를 찾을 수 없습니다.',
      });
    }

    console.log(
      `✅ 매입전표 소프트 삭제 완료: ${거래일자}-${거래번호} (${result.rowsAffected[0]}건)`,
    );

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
    const { 매입처코드, 시작일자, 종료일자 } = req.query;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    let query = `
      SELECT
        k.미지급금지급일자,
        k.미지급금지급시간,
        k.매입처코드,
        m.매입처명,
        k.미지급금지급금액,
        k.결제방법,
        k.만기일자,
        k.어음번호,
        k.적요,
        k.사용자코드
      FROM 미지급금내역 AS k
        LEFT JOIN 매입처 AS m
          ON k.매입처코드 = m.매입처코드
          AND m.사용구분 = 0
      WHERE k.사업장코드 = @사업장코드      
    `;

    const request = pool.request().input('사업장코드', sql.VarChar(2), 사업장코드);

    if (매입처코드) {
      query += ` AND k.매입처코드 = @매입처코드`;
      request.input('매입처코드', sql.VarChar(8), 매입처코드);
    }

    if (시작일자 && 종료일자) {
      query += ` AND k.미지급금지급일자 BETWEEN @시작일자 AND @종료일자`;
      request.input('시작일자', sql.VarChar(8), 시작일자);
      request.input('종료일자', sql.VarChar(8), 종료일자);
    }

    query += ` ORDER BY k.미지급금지급일자 ASC, k.미지급금지급시간 ASC`;

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('미지급금 조회 오류:', err);
    res.status(500).json({ success: false, message: 'DB 조회 실패' });
  }
});

// ✅ 미지급금 등록
app.post('/api/accounts-payable', requireAuth, async (req, res) => {
  try {
    const { 매입처코드, 미지급금지급일자, 미지급금지급금액, 결제방법, 만기일자, 어음번호, 적요 } =
      req.body;
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

    await pool
      .request()
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
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
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
    const purchaseResult = await pool.request().input('매입처코드', sql.VarChar(8), supplierCode)
      .query(`
        SELECT
          ISNULL(SUM(입고수량 * 입고단가 * 1.1), 0) AS 총매입액
        FROM 자재입출내역
        WHERE 매입처코드 = @매입처코드
          AND 입출고구분 = 1
          AND 사용구분 = 0
      `);

    // 2. 총 지급액 계산 (미지급금내역에서 지급 금액)
    const paymentResult = await pool.request().input('매입처코드', sql.VarChar(8), supplierCode)
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
// 미수금 관리 API
// ================================

// ✅ 미수금 내역 조회 (매출처별)
app.get('/api/accounts-receivable', async (req, res) => {
  try {
    const { 매출처코드, 시작일자, 종료일자 } = req.query;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    let query = `
      SELECT
        미수금내역.미수금입금일자,
        미수금내역.미수금입금시간,
        미수금내역.매출처코드,
        매출처.매출처명,
        미수금내역.미수금입금금액,
        미수금내역.결제방법,
        미수금내역.만기일자,
        미수금내역.어음번호,
        미수금내역.적요,
        미수금내역.사용자코드
      FROM 미수금내역
        LEFT JOIN 매출처
          ON 미수금내역.매출처코드 = 매출처.매출처코드
          AND 매출처.사용구분 = 0
      WHERE 미수금내역.사업장코드 = @사업장코드
    `;

    const request = pool.request().input('사업장코드', sql.VarChar(2), 사업장코드);

    if (매출처코드) {
      query += ` AND 미수금내역.매출처코드 = @매출처코드`;
      request.input('매출처코드', sql.VarChar(8), 매출처코드);
    }

    if (시작일자 && 종료일자) {
      query += ` AND 미수금내역.미수금입금일자 BETWEEN @시작일자 AND @종료일자`;
      request.input('시작일자', sql.VarChar(8), 시작일자);
      request.input('종료일자', sql.VarChar(8), 종료일자);
    }

    query += ` ORDER BY 미수금내역.미수금입금일자 DESC, 미수금내역.미수금입금시간 DESC`;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('미수금 내역 조회 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ✅ 미수금 입금 처리 (회계담당자가 실제 입금 확인 시 사용)
app.post('/api/accounts-receivable', requireAuth, async (req, res) => {
  try {
    const { 매출처코드, 미수금입금일자, 미수금입금금액, 결제방법, 만기일자, 어음번호, 적요 } =
      req.body;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';

    // 유효성 검사
    if (!매출처코드 || !미수금입금일자 || !미수금입금금액) {
      return res.status(400).json({
        success: false,
        message: '필수 정보가 누락되었습니다. (매출처코드, 입금일자, 입금금액)',
      });
    }

    // 현재 시간
    const now = new Date();
    const 미수금입금시간 =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0') +
      now.getMilliseconds().toString().padStart(3, '0');

    const 수정일자 = 미수금입금일자;

    await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매출처코드', sql.VarChar(8), 매출처코드)
      .input('미수금입금일자', sql.VarChar(8), 미수금입금일자)
      .input('미수금입금시간', sql.VarChar(9), 미수금입금시간)
      .input('미수금입금금액', sql.Money, 미수금입금금액)
      .input('결제방법', sql.TinyInt, 결제방법 || 0) // 0=현금, 1=수표, 2=어음, 3=기타
      .input('만기일자', sql.VarChar(8), 만기일자 || '')
      .input('어음번호', sql.VarChar(20), 어음번호 || '')
      .input('적요', sql.VarChar(50), 적요 || '')
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        INSERT INTO 미수금내역 (
          사업장코드, 매출처코드, 미수금입금일자, 미수금입금시간,
          미수금입금금액, 결제방법, 만기일자, 어음번호, 적요,
          수정일자, 사용자코드
        ) VALUES (
          @사업장코드, @매출처코드, @미수금입금일자, @미수금입금시간,
          @미수금입금금액, @결제방법, @만기일자, @어음번호, @적요,
          @수정일자, @사용자코드
        )
      `);

    console.log(`✅ 미수금 입금 처리 완료: ${매출처코드} - ${미수금입금금액}원`);

    res.json({
      success: true,
      message: '미수금 입금 처리가 완료되었습니다.',
      data: {
        매출처코드,
        미수금입금일자,
        미수금입금금액,
        결제방법,
      },
    });
  } catch (err) {
    console.error('❌ 미수금 입금 처리 에러:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ✅ 매출처별 미수금 잔액 조회
app.get('/api/accounts-receivable/balance/:customerCode', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    // 1. 총 매출액 계산 (자재입출내역에서 출고 금액)
    const salesResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매출처코드', sql.VarChar(8), customerCode).query(`
        SELECT
          ISNULL(SUM((출고수량 * 출고단가) + 출고부가), 0) AS 총매출액
        FROM 자재입출내역
        WHERE 사업장코드 = @사업장코드
          AND 매출처코드 = @매출처코드
          AND 입출고구분 = 2
          AND 사용구분 = 0
      `);

    // 2. 총 입금액 계산 (미수금내역에서 입금 금액)
    const receivedResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('매출처코드', sql.VarChar(8), customerCode).query(`
        SELECT
          ISNULL(SUM(미수금입금금액), 0) AS 총입금액
        FROM 미수금내역
        WHERE 사업장코드 = @사업장코드
          AND 매출처코드 = @매출처코드
      `);

    const 총매출액 = salesResult.recordset[0].총매출액;
    const 총입금액 = receivedResult.recordset[0].총입금액;
    const 미수금잔액 = 총매출액 - 총입금액;

    res.json({
      success: true,
      data: {
        매출처코드: customerCode,
        총매출액,
        총입금액,
        미수금잔액,
      },
    });
  } catch (err) {
    console.error('미수금 잔액 조회 오류:', err);
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

/*
 * ========================================
 * 출력물관리 - 일계표 API
 * ========================================
 */
app.get('/api/daily-report', async (req, res) => {
  try {
    const { date } = req.query;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '조회일자를 입력해주세요.',
      });
    }

    console.log('✅ 일계표 조회 요청:', { date, 사업장코드 });

    // sp일계표인쇄 저장 프로시저 로직을 쿼리로 구현
    const query = `
      -- 1. 전일이월 (회계전표내역마감)
      SELECT T1.사업장코드, T2.사업장명, '1' AS 그룹1, '1' AS 그룹2, '' AS 작성시간,
             '경   비' AS 구분,
             '' AS 계정코드, '전일이월' AS 계정명,
             0 AS 수입1, 0 AS 수입2,
             0 AS 지출1, 0 AS 지출2,
             SUM(T1.입금누계금액 - T1.출금누계금액) AS 잔액
        FROM 회계전표내역마감 T1
        LEFT JOIN 사업장 T2 ON T2.사업장코드 = T1.사업장코드
       WHERE T1.사업장코드 = @사업장코드
         AND T1.마감년월 >= (SUBSTRING(@date, 1, 4) + '00')
         AND T1.마감년월 < SUBSTRING(@date, 1, 6)
       GROUP BY T1.사업장코드, T2.사업장명

      UNION ALL

      -- 2. 전일이월 (회계전표내역)
      SELECT T1.사업장코드, T2.사업장명, '1' AS 그룹1, '1' AS 그룹2, '' AS 작성시간,
             '경   비' AS 구분,
             '' AS 계정코드, '전일이월' AS 계정명,
             0 AS 수입1, 0 AS 수입2,
             0 AS 지출1, 0 AS 지출2,
             SUM(T1.입금금액 - T1.출금금액) AS 잔액
        FROM 회계전표내역 T1
        LEFT JOIN 사업장 T2 ON T2.사업장코드 = T1.사업장코드
       WHERE T1.사업장코드 = @사업장코드 AND T1.사용구분 = 0
         AND (T1.작성일자 >= (SUBSTRING(@date, 1, 6) + '01') AND T1.작성일자 < @date)
       GROUP BY T1.사업장코드, T2.사업장명

      UNION ALL

      -- 3. 경비 (회계전표내역 - 당일)
      SELECT T1.사업장코드, T2.사업장명, '1' AS 그룹1, '1' AS 그룹2, T1.작성시간 AS 작성시간,
             '경   비' AS 구분,
             T1.계정코드 AS 계정코드, T1.적요 AS 계정명,
             SUM(T1.입금금액) AS 수입1, 0 AS 수입2,
             SUM(T1.출금금액) AS 지출1, 0 AS 지출2,
             0 AS 잔액
        FROM 회계전표내역 T1
        LEFT JOIN 사업장 T2 ON T2.사업장코드 = T1.사업장코드
        LEFT JOIN 계정과목 T3 ON T3.계정코드 = T1.계정코드
       WHERE T1.사업장코드 = @사업장코드 AND T1.사용구분 = 0
         AND T1.작성일자 = @date
       GROUP BY T1.사업장코드, T2.사업장명, T1.작성시간, T1.계정코드, T1.적요

      UNION ALL

      -- 4. 매입 (자재입출내역 - 입고)
      SELECT T1.사업장코드, T2.사업장명, '2' AS 그룹1, '1' AS 그룹2, '' AS 작성시간,
             '매   입' AS 구분,
             T1.매입처코드 AS 계정코드, T3.매입처명 AS 계정명,
             SUM(T1.입고수량 * T1.입고단가) AS 수입1,
             (SUM(T1.입고수량 * T1.입고단가) * 1.1) AS 수입2,
             0 AS 지출1, 0 AS 지출2,
             0 AS 잔액
        FROM 자재입출내역 T1
        LEFT JOIN 사업장 T2 ON T2.사업장코드 = T1.사업장코드
        LEFT JOIN 매입처 T3 ON T3.사업장코드 = T1.사업장코드 AND T3.매입처코드 = T1.매입처코드
       WHERE T1.사업장코드 = @사업장코드 AND T1.사용구분 = 0
         AND T1.입출고일자 = @date
         AND T1.입출고구분 = 1
       GROUP BY T1.사업장코드, T2.사업장명, T3.매입처명, T1.매입처코드

      UNION ALL

      -- 5. 매출 (자재입출내역 - 출고)
      SELECT T1.사업장코드, T2.사업장명, '2' AS 그룹1, '2' AS 그룹2, '' AS 작성시간,
             '매   출' AS 구분,
             T1.매출처코드 AS 계정코드, T3.매출처명 AS 계정명,
             0 AS 수입1, 0 AS 수입2,
             SUM(T1.출고수량 * T1.출고단가) AS 지출1,
             (SUM(T1.출고수량 * T1.출고단가) * 1.1) AS 지출2,
             0 AS 잔액
        FROM 자재입출내역 T1
        LEFT JOIN 사업장 T2 ON T2.사업장코드 = T1.사업장코드
        LEFT JOIN 매출처 T3 ON T3.사업장코드 = T1.사업장코드 AND T3.매출처코드 = T1.매출처코드
       WHERE T1.사업장코드 = @사업장코드 AND T1.사용구분 = 0
         AND T1.입출고일자 = @date
         AND (T1.입출고구분 = 2 OR T1.입출고구분 = 8)
       GROUP BY T1.사업장코드, T2.사업장명, T3.매출처명, T1.매출처코드

      UNION ALL

      -- 6. 입금 (미수금내역)
      SELECT T1.사업장코드, T2.사업장명, '3' AS 그룹1, '1' AS 그룹2, '' AS 작성시간,
             '입   금' AS 구분,
             T1.매출처코드 AS 계정코드, T3.매출처명 AS 계정명,
             SUM(ISNULL(T1.미수금입금금액,0)) AS 수입1,
             SUM(ISNULL(T1.미수금입금금액,0)) AS 수입2,
             0 AS 지출1, 0 AS 지출2,
             0 AS 잔액
        FROM 미수금내역 T1
        LEFT JOIN 사업장 T2 ON T2.사업장코드 = T1.사업장코드
        LEFT JOIN 매출처 T3 ON T3.사업장코드 = T1.사업장코드 AND T3.매출처코드 = T1.매출처코드
       WHERE T1.사업장코드 = @사업장코드
         AND T1.미수금입금일자 = @date
       GROUP BY T1.사업장코드, T2.사업장명, T3.매출처명, T1.매출처코드

      UNION ALL

      -- 7. 출금 (미지급금내역)
      SELECT T1.사업장코드, T2.사업장명, '3' AS 그룹1, '2' AS 그룹2, '' AS 작성시간,
             '출   금' AS 구분,
             T1.매입처코드 AS 계정코드, T3.매입처명 AS 계정명,
             0 AS 수입1, 0 AS 수입2,
             SUM(ISNULL(T1.미지급금지급금액,0)) AS 지출1,
             SUM(ISNULL(T1.미지급금지급금액,0)) AS 지출2,
             0 AS 잔액
        FROM 미지급금내역 T1
        LEFT JOIN 사업장 T2 ON T2.사업장코드 = T1.사업장코드
        LEFT JOIN 매입처 T3 ON T3.사업장코드 = T1.사업장코드 AND T3.매입처코드 = T1.매입처코드
       WHERE T1.사업장코드 = @사업장코드
         AND T1.미지급금지급일자 = @date
       GROUP BY T1.사업장코드, T2.사업장명, T3.매입처명, T1.매입처코드

      ORDER BY 그룹1, 그룹2, 작성시간
    `;

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('date', sql.VarChar(8), date)
      .query(query);

    console.log('✅ 일계표 조회 결과:', result.recordset.length, '건');

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error('❌ 일계표 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ===================================
// 현금출납내역 관리 API (Cash Book Management)
// ===================================

/**
 * 계정과목 목록 조회
 * GET /api/account-categories
 */
app.get('/api/account-categories', async (_req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT 계정코드, 계정명, 적요
      FROM 계정과목
      WHERE 사용구분 = 0
      ORDER BY 계정코드
    `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error('❌ 계정과목 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

/**
 * 현금출납내역 목록 조회
 * GET /api/cash-history?startDate=20251101&endDate=20251130&입출구분=1
 */
app.get('/api/cash-history', async (req, res) => {
  try {
    const { startDate, endDate, 입출구분, 계정코드 } = req.query;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    console.log('📞 현금출납내역 조회 요청:', {
      사업장코드,
      startDate,
      endDate,
      입출구분,
      계정코드,
    });

    let query = `
      SELECT
        h.사업장코드,
        h.작성일자,
        h.작성시간,
        h.계정코드,
        a.계정명,
        h.입출구분,
        h.입금금액,
        h.출금금액,
        h.적요,
        h.작성자코드,
        u.사용자명 AS 작성자명,
        u.사용자명,
        h.수정일자,
        h.사용자코드
      FROM 회계전표내역 h
        LEFT JOIN 계정과목 a ON h.계정코드 = a.계정코드
        LEFT JOIN 사용자 u ON h.작성자코드 = u.사용자코드
      WHERE h.사업장코드 = @사업장코드
        AND h.사용구분 = 0
    `;

    const request = pool.request().input('사업장코드', sql.VarChar(2), 사업장코드);

    // 날짜 필터
    if (startDate) {
      query += ` AND h.작성일자 >= @startDate`;
      request.input('startDate', sql.VarChar(8), startDate);
    }
    if (endDate) {
      query += ` AND h.작성일자 <= @endDate`;
      request.input('endDate', sql.VarChar(8), endDate);
    }

    // 입출구분 필터
    if (입출구분) {
      query += ` AND h.입출구분 = @입출구분`;
      request.input('입출구분', sql.TinyInt, parseInt(입출구분));
    }

    // 계정코드 필터 (합계잔액시산표 상세보기에서 사용)
    if (계정코드) {
      query += ` AND h.계정코드 = @계정코드`;
      request.input('계정코드', sql.VarChar(4), 계정코드);
    }

    query += ` ORDER BY h.작성일자 DESC, h.작성시간 DESC`;

    console.log('📝 실행 쿼리:', query);

    const result = await request.query(query);

    console.log('✅ 현금출납내역 조회 결과:', {
      total: result.recordset.length,
      sample: result.recordset.length > 0 ? result.recordset[0] : null,
    });

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('❌ 현금출납내역 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

/**
 * 현금출납내역 상세 조회
 * GET /api/cash-history/:date/:time
 */
app.get('/api/cash-history/:date/:time', async (req, res) => {
  try {
    const { date, time } = req.params;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성일자', sql.VarChar(8), date)
      .input('작성시간', sql.VarChar(9), time).query(`
        SELECT
          h.사업장코드,
          h.작성일자,
          h.작성시간,
          h.계정코드,
          a.계정명,
          h.입출구분,
          h.입금금액,
          h.출금금액,
          h.적요,
          h.작성자코드,
          u.사용자명 AS 작성자명,
          h.수정일자,
          h.사용자코드
        FROM 회계전표내역 h
          LEFT JOIN 계정과목 a ON h.계정코드 = a.계정코드
          LEFT JOIN 사용자 u ON h.작성자코드 = u.사용자코드
        WHERE h.사업장코드 = @사업장코드
          AND h.작성일자 = @작성일자
          AND h.작성시간 = @작성시간
          AND h.사용구분 = 0
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 현금출납내역을 찾을 수 없습니다.',
      });
    }

    res.json({
      success: true,
      data: result.recordset[0],
    });
  } catch (err) {
    console.error('❌ 현금출납내역 상세 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

/**
 * 현금출납내역 등록
 * POST /api/cash-history
 */
app.post('/api/cash-history', async (req, res) => {
  try {
    const { 작성일자, 계정코드, 입출구분, 입금금액, 출금금액, 적요 } = req.body;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';
    const 사용자명 = req.session?.user?.사용자명 || '관리자';

    // 필수 필드 검증
    if (!작성일자 || !계정코드 || !입출구분) {
      return res.status(400).json({
        success: false,
        message: '필수 항목을 모두 입력해주세요.',
      });
    }

    // 작성시간 생성 (HHMMSSMMM 형식 - VARCHAR(9))
    const now = new Date();
    const 작성시간 =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0') +
      now.getMilliseconds().toString().padStart(3, '0');

    const 수정일자 = now.toISOString().slice(0, 10).replace(/-/g, '');

    // INSERT
    await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성일자', sql.VarChar(8), 작성일자)
      .input('작성시간', sql.VarChar(9), 작성시간)
      .input('계정코드', sql.VarChar(4), 계정코드)
      .input('입출구분', sql.TinyInt, parseInt(입출구분))
      .input('입금금액', sql.Money, parseFloat(입금금액) || 0)
      .input('출금금액', sql.Money, parseFloat(출금금액) || 0)
      .input('적요', sql.VarChar(60), 적요 || '')
      .input('작성자코드', sql.VarChar(4), 사용자코드)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        INSERT INTO 회계전표내역 (
          사업장코드, 작성일자, 작성시간, 계정코드, 입출구분,
          입금금액, 출금금액, 적요, 사용구분, 작성자코드, 수정일자, 사용자코드
        ) VALUES (
          @사업장코드, @작성일자, @작성시간, @계정코드, @입출구분,
          @입금금액, @출금금액, @적요, 0, @작성자코드, @수정일자, @사용자코드
        )
      `);

    // 계정명 조회
    const accountResult = await pool
      .request()
      .input('계정코드', sql.VarChar(4), 계정코드)
      .query('SELECT 계정명 FROM 계정과목 WHERE 계정코드 = @계정코드');

    const 계정명 = accountResult.recordset[0]?.계정명 || '';

    res.json({
      success: true,
      message: '현금출납내역이 등록되었습니다.',
      data: {
        사업장코드,
        작성일자,
        작성시간,
        계정코드,
        계정명,
        사용자코드,
        사용자명,
      },
    });
  } catch (err) {
    console.error('❌ 현금출납내역 등록 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

/**
 * 현금출납내역 수정
 * PUT /api/cash-history/:date/:time
 */
app.put('/api/cash-history/:date/:time', async (req, res) => {
  try {
    const { date, time } = req.params;
    const { 작성일자, 계정코드, 입출구분, 입금금액, 출금금액, 적요 } = req.body;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';

    // 필수 필드 검증
    if (!작성일자 || !계정코드 || !입출구분) {
      return res.status(400).json({
        success: false,
        message: '필수 항목을 모두 입력해주세요.',
      });
    }

    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 기존 레코드 존재 확인
    const checkResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성일자', sql.VarChar(8), date)
      .input('작성시간', sql.VarChar(9), time).query(`
        SELECT * FROM 회계전표내역
        WHERE 사업장코드 = @사업장코드
          AND 작성일자 = @작성일자
          AND 작성시간 = @작성시간
          AND 사용구분 = 0
      `);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 현금출납내역을 찾을 수 없습니다.',
      });
    }

    // UPDATE
    await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('원작성일자', sql.VarChar(8), date)
      .input('원작성시간', sql.VarChar(9), time)
      .input('작성일자', sql.VarChar(8), 작성일자)
      .input('계정코드', sql.VarChar(4), 계정코드)
      .input('입출구분', sql.TinyInt, parseInt(입출구분))
      .input('입금금액', sql.Money, parseFloat(입금금액) || 0)
      .input('출금금액', sql.Money, parseFloat(출금금액) || 0)
      .input('적요', sql.VarChar(60), 적요 || '')
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        UPDATE 회계전표내역
        SET 작성일자 = @작성일자,
            계정코드 = @계정코드,
            입출구분 = @입출구분,
            입금금액 = @입금금액,
            출금금액 = @출금금액,
            적요 = @적요,
            수정일자 = @수정일자,
            사용자코드 = @사용자코드
        WHERE 사업장코드 = @사업장코드
          AND 작성일자 = @원작성일자
          AND 작성시간 = @원작성시간
          AND 사용구분 = 0
      `);

    res.json({
      success: true,
      message: '현금출납내역이 수정되었습니다.',
    });
  } catch (err) {
    console.error('❌ 현금출납내역 수정 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

/**
 * 현금출납내역 삭제 (Soft Delete)
 * DELETE /api/cash-history/:date/:time
 */
app.delete('/api/cash-history/:date/:time', async (req, res) => {
  try {
    const { date, time } = req.params;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';
    const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 기존 레코드 존재 확인
    const checkResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성일자', sql.VarChar(8), date)
      .input('작성시간', sql.VarChar(9), time).query(`
        SELECT * FROM 회계전표내역
        WHERE 사업장코드 = @사업장코드
          AND 작성일자 = @작성일자
          AND 작성시간 = @작성시간
          AND 사용구분 = 0
      `);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 현금출납내역을 찾을 수 없습니다.',
      });
    }

    // Soft delete (사용구분 = 9)
    await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('작성일자', sql.VarChar(8), date)
      .input('작성시간', sql.VarChar(9), time)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .input('사용자코드', sql.VarChar(4), 사용자코드).query(`
        UPDATE 회계전표내역
        SET 사용구분 = 9,
            수정일자 = @수정일자,
            사용자코드 = @사용자코드
        WHERE 사업장코드 = @사업장코드
          AND 작성일자 = @작성일자
          AND 작성시간 = @작성시간
      `);

    res.json({
      success: true,
      message: '현금출납내역이 삭제되었습니다.',
    });
  } catch (err) {
    console.error('❌ 현금출납내역 삭제 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ====================================
// 자재입출내역 조회 API (합계잔액시산표 상세보기용)
// ====================================

/**
 * 자재입출내역 조회 (매입/매출)
 * GET /api/material-transactions?startDate=20251101&endDate=20251130&입출구분=1
 */
app.get('/api/material-transactions', async (req, res) => {
  try {
    const { startDate, endDate, 입출구분 } = req.query;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    console.log('📞 자재입출내역 조회 요청:', {
      사업장코드,
      startDate,
      endDate,
      입출구분,
    });

    let query = `
      SELECT
        i.사업장코드,
        i.거래일자,
        i.거래번호,
        i.분류코드,
        i.세부코드,
        i.입출고구분,
        i.매입처코드,
        i.매출처코드,
        i.입고수량,
        i.입고단가,
        i.입고부가,
        i.출고수량,
        i.출고단가,
        i.출고부가,
        m.자재명,
        CASE
          WHEN i.입출고구분 = 1 THEN sup.매입처명
          WHEN i.입출고구분 = 2 THEN cus.매출처명
        END AS 거래처명,
        CASE
          WHEN i.입출고구분 = 1 THEN sup.매입처명
        END AS 매입처명,
        CASE
          WHEN i.입출고구분 = 2 THEN cus.매출처명
        END AS 매출처명
      FROM 자재입출내역 i
        LEFT JOIN 자재 m
          ON i.분류코드 = m.분류코드
          AND i.세부코드 = SUBSTRING(m.세부코드, 3, 16)
        LEFT JOIN 매입처 sup
          ON i.매입처코드 = sup.매입처코드
          AND i.사업장코드 = sup.사업장코드
        LEFT JOIN 매출처 cus
          ON i.매출처코드 = cus.매출처코드
          AND i.사업장코드 = cus.사업장코드
      WHERE i.사업장코드 = @사업장코드
        AND i.사용구분 = 0
    `;

    const request = pool.request().input('사업장코드', sql.VarChar(2), 사업장코드);

    // 날짜 필터
    if (startDate) {
      query += ` AND i.거래일자 >= @startDate`;
      request.input('startDate', sql.VarChar(8), startDate);
    }
    if (endDate) {
      query += ` AND i.거래일자 <= @endDate`;
      request.input('endDate', sql.VarChar(8), endDate);
    }

    // 입출고구분 필터 (1=매입, 2=매출)
    if (입출구분) {
      query += ` AND i.입출고구분 = @입출고구분`;
      request.input('입출고구분', sql.TinyInt, parseInt(입출구분));
    }

    query += ` ORDER BY i.거래일자 DESC, i.거래번호 DESC`;

    console.log('📝 실행 쿼리:', query);

    const result = await request.query(query);

    console.log('✅ 자재입출내역 조회 결과:', {
      total: result.recordset.length,
      sample: result.recordset.length > 0 ? result.recordset[0] : null,
    });

    // 모달창 표시 데이터 상세 로그
    if (result.recordset.length > 0) {
      console.log('📊 모달창 표시 데이터 (첫 3건):');
      result.recordset.slice(0, 3).forEach((row, idx) => {
        console.log(`  [${idx + 1}]`, {
          거래일자: row.거래일자,
          거래번호: row.거래번호,
          입출고구분: row.입출고구분 === 1 ? '매입(입고)' : '매출(출고)',
          거래처명: row.거래처명 || row.매입처명 || row.매출처명,
          자재명: row.자재명,
          수량: row.입출고구분 === 1 ? row.입고수량 : row.출고수량,
          단가: row.입출고구분 === 1 ? row.입고단가 : row.출고단가,
          금액:
            row.입출고구분 === 1
              ? (row.입고수량 || 0) * (row.입고단가 || 0)
              : (row.출고수량 || 0) * (row.출고단가 || 0),
        });
      });

      // 전체 데이터 구조 확인
      console.log('📋 전체 데이터 구조 (모든 필드):');
      console.log(Object.keys(result.recordset[0]));
    } else {
      console.log('⚠️ 조회된 데이터가 없습니다.');
    }

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('❌ 자재입출내역 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류: ' + err.message,
    });
  }
});

// ====================================
// 월마감 API
// ====================================

/**
 * 회계전표 월마감 처리
 * POST /api/accounting/close-month
 */
app.post('/api/accounting/close-month', async (req, res) => {
  try {
    const { 마감년월, 계정코드 } = req.body;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';
    const 사용자코드 = req.session?.user?.사용자코드 || '8080';

    // 필수 필드 검증
    if (!마감년월) {
      return res.status(400).json({
        success: false,
        message: '마감년월을 입력해주세요.',
      });
    }

    // 마감년월 형식 검증 (YYYYMM)
    if (!/^\d{6}$/.test(마감년월)) {
      return res.status(400).json({
        success: false,
        message: '마감년월 형식이 올바르지 않습니다. (YYYYMM)',
      });
    }

    // 마감일자 = 해당 월의 마지막 날 계산
    const year = parseInt(마감년월.substring(0, 4));
    const month = parseInt(마감년월.substring(4, 6));
    const lastDay = new Date(year, month, 0).getDate();
    const 마감일자 = 마감년월 + lastDay.toString().padStart(2, '0');

    console.log('✅ 월마감 처리 시작:', { 사업장코드, 마감년월, 마감일자, 계정코드 });

    // 계정코드가 지정된 경우 해당 계정만 마감, 없으면 전체 계정 마감
    if (계정코드) {
      // 특정 계정만 마감
      await pool
        .request()
        .input('ParBranchCode', sql.VarChar(2), 사업장코드)
        .input('ParDate', sql.VarChar(8), 마감일자)
        .input('ParMagamGbn', sql.TinyInt, 4) // 회계전표내역 마감
        .input('ParKindCode', sql.VarChar(2), '')
        .input('ParMtCode', sql.VarChar(20), '')
        .input('ParIOGbn', sql.TinyInt, 1)
        .input('ParSupplierCode', sql.VarChar(8), '')
        .input('ParAccountCode', sql.VarChar(4), 계정코드)
        .execute('sp자동마감작업갱신');

      console.log('✅ 월마감 완료 (단일 계정):', 계정코드);

      res.json({
        success: true,
        message: `${마감년월} 월마감이 완료되었습니다. (계정코드: ${계정코드})`,
        data: {
          마감년월,
          마감일자,
          계정코드,
        },
      });
    } else {
      // 전체 계정 마감
      // 1. 활성화된 모든 계정과목 조회
      const accountsResult = await pool.request().query(`
        SELECT 계정코드, 계정명
        FROM 계정과목
        WHERE 사용구분 = 0
        ORDER BY 계정코드
      `);

      const accounts = accountsResult.recordset;

      if (accounts.length === 0) {
        return res.status(400).json({
          success: false,
          message: '마감할 계정과목이 없습니다.',
        });
      }

      // 2. 각 계정별로 마감 프로시저 실행
      for (const account of accounts) {
        await pool
          .request()
          .input('ParBranchCode', sql.VarChar(2), 사업장코드)
          .input('ParDate', sql.VarChar(8), 마감일자)
          .input('ParMagamGbn', sql.TinyInt, 4) // 회계전표내역 마감
          .input('ParKindCode', sql.VarChar(2), '')
          .input('ParMtCode', sql.VarChar(20), '')
          .input('ParIOGbn', sql.TinyInt, 1)
          .input('ParSupplierCode', sql.VarChar(8), '')
          .input('ParAccountCode', sql.VarChar(4), account.계정코드)
          .execute('sp자동마감작업갱신');

        console.log('  ✓ 계정마감 완료:', account.계정코드, account.계정명);
      }

      console.log('✅ 월마감 완료 (전체 계정):', accounts.length, '개');

      res.json({
        success: true,
        message: `${마감년월} 월마감이 완료되었습니다. (${accounts.length}개 계정)`,
        data: {
          마감년월,
          마감일자,
          계정수: accounts.length,
        },
      });
    }
  } catch (err) {
    console.error('❌ 월마감 처리 오류:', err);
    res.status(500).json({
      success: false,
      message: '월마감 처리 중 오류가 발생했습니다: ' + err.message,
    });
  }
});

// ====================================
// 합계잔액시산표 API
// ====================================

/**
 * 합계잔액시산표 조회
 * GET /api/trial-balance
 * Query params: date (YYYYMMDD)
 */
app.get('/api/trial-balance', async (req, res) => {
  try {
    const { date } = req.query;
    const 사업장코드 = req.session?.user?.사업장코드 || '01';

    // 날짜 형식 검증
    if (!date || !/^\d{8}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: '올바른 날짜 형식이 아닙니다 (YYYYMMDD)',
      });
    }

    // 년월 추출 (YYYYMM)
    const 년월 = date.substring(0, 6);
    const 월초일자 = 년월 + '01';

    console.log('📊 합계잔액시산표 조회:', { 사업장코드, date, 년월, 월초일자 });

    // 1. 기존 저장 프로시저 호출 (기존 시스템 데이터)
    const spResult = await pool
      .request()
      .input('ParBranchCode', sql.VarChar(2), 사업장코드)
      .input('ParDate', sql.VarChar(8), date)
      .execute('sp합계시산표');

    console.log('  ✓ 저장 프로시저 조회 완료:', spResult.recordset.length, '건');

    // 2. 회계전표 테이블에서 직접 조회 (신규 회계전표 시스템 데이터)
    const voucherResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('조회일자', sql.VarChar(8), date)
      .input('월초일자', sql.VarChar(8), 월초일자).query(`
        SELECT
          c.계정코드,
          c.계정명,
          c.계정구분,
          -- 당월 차변 합계
          ISNULL(SUM(CASE
            WHEN v.차대구분 = 'D' AND v.전표일자 >= @월초일자 AND v.전표일자 <= @조회일자
            THEN v.금액
            ELSE 0
          END), 0) AS 차변당월,
          -- 누계 차변 합계 (기초부터 조회일까지)
          ISNULL(SUM(CASE
            WHEN v.차대구분 = 'D' AND v.전표일자 <= @조회일자
            THEN v.금액
            ELSE 0
          END), 0) AS 차변누계,
          -- 당월 대변 합계
          ISNULL(SUM(CASE
            WHEN v.차대구분 = 'C' AND v.전표일자 >= @월초일자 AND v.전표일자 <= @조회일자
            THEN v.금액
            ELSE 0
          END), 0) AS 대변당월,
          -- 누계 대변 합계 (기초부터 조회일까지)
          ISNULL(SUM(CASE
            WHEN v.차대구분 = 'C' AND v.전표일자 <= @조회일자
            THEN v.금액
            ELSE 0
          END), 0) AS 대변누계
        FROM 계정과목 c
          LEFT JOIN 회계전표 v
            ON c.계정코드 = v.계정코드
            AND v.사업장코드 = @사업장코드
            AND v.사용구분 = 0
        WHERE c.사용구분 = 0
        GROUP BY c.계정코드, c.계정명, c.계정구분
        HAVING
          -- 거래가 있는 계정만 표시
          SUM(CASE WHEN v.차대구분 = 'D' THEN v.금액 ELSE 0 END) > 0
          OR SUM(CASE WHEN v.차대구분 = 'C' THEN v.금액 ELSE 0 END) > 0
        ORDER BY c.계정코드
      `);

    console.log('  ✓ 회계전표 테이블 조회 완료:', voucherResult.recordset.length, '건');

    // 3. 두 결과를 계정코드별로 합산
    const accountMap = new Map();

    // 기존 프로시저 결과 추가
    spResult.recordset.forEach((row) => {
      const code = row.계정코드 || '';
      accountMap.set(code, {
        계정코드: code,
        계정명: row.계정명 || '',
        계정구분: row.계정구분 || '',
        차변당월: row.차변당월 || 0,
        차변누계: row.차변누계 || 0,
        대변당월: row.대변당월 || 0,
        대변누계: row.대변누계 || 0,
      });
    });

    // 회계전표 결과 합산
    voucherResult.recordset.forEach((row) => {
      const code = row.계정코드 || '';
      const existing = accountMap.get(code);

      if (existing) {
        // 기존 데이터에 합산
        existing.차변당월 += row.차변당월 || 0;
        existing.차변누계 += row.차변누계 || 0;
        existing.대변당월 += row.대변당월 || 0;
        existing.대변누계 += row.대변누계 || 0;
      } else {
        // 새 계정 추가
        accountMap.set(code, {
          계정코드: code,
          계정명: row.계정명 || '',
          계정구분: row.계정구분 || '',
          차변당월: row.차변당월 || 0,
          차변누계: row.차변누계 || 0,
          대변당월: row.대변당월 || 0,
          대변누계: row.대변누계 || 0,
        });
      }
    });

    // 4. 결과 가공
    const data = Array.from(accountMap.values())
      .map((row) => {
        // 차변잔액 = 차변누계 - 대변누계
        // 대변잔액 = 대변누계 - 차변누계 (차변잔액이 음수일 때)
        const 차변합계 = row.차변누계 || 0;
        const 대변합계 = row.대변누계 || 0;
        const 잔액 = 차변합계 - 대변합계;

        return {
          계정코드: row.계정코드,
          계정명: row.계정명,
          계정구분: row.계정구분,
          차변당월: row.차변당월,
          차변누계: row.차변누계,
          대변당월: row.대변당월,
          대변누계: row.대변누계,
          차변잔액: 잔액 >= 0 ? 잔액 : 0,
          대변잔액: 잔액 < 0 ? Math.abs(잔액) : 0,
        };
      })
      .sort((a, b) => a.계정코드.localeCompare(b.계정코드)); // 계정코드순 정렬

    console.log('✅ 합산 완료 - 총 계정 수:', data.length);

    res.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (err) {
    console.error('❌ 합계잔액시산표 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '합계잔액시산표 조회 중 오류가 발생했습니다: ' + err.message,
    });
  }
});

// =============================================
// 📊 회계전표 조회 API
// =============================================
app.get('/api/accounting-vouchers', async (req, res) => {
  try {
    const 사업장코드 = req.session.user?.사업장코드 || '01';
    const { startDate, endDate, voucherType } = req.query;

    let query = `
      SELECT
        회계전표.전표번호,
        회계전표.전표순번,
        회계전표.사업장코드,
        회계전표.전표일자,
        회계전표.전표시간,
        회계전표.계정코드,
        계정과목.계정명,
        회계전표.차대구분,
        회계전표.금액,
        회계전표.적요,
        회계전표.참조전표,
        회계전표.작성자코드,
        사용자.사용자명
      FROM 회계전표
        LEFT JOIN 계정과목
          ON 회계전표.계정코드 = 계정과목.계정코드
        LEFT JOIN 사용자
          ON 회계전표.작성자코드 = 사용자.사용자코드
      WHERE 회계전표.사업장코드 = @사업장코드
        AND 회계전표.사용구분 = 0
    `;

    const request = pool.request();
    request.input('사업장코드', sql.VarChar(2), 사업장코드);

    // 날짜 필터
    if (startDate) {
      query += ` AND 회계전표.전표일자 >= @startDate`;
      request.input('startDate', sql.VarChar(8), startDate.replace(/-/g, ''));
    }
    if (endDate) {
      query += ` AND 회계전표.전표일자 <= @endDate`;
      request.input('endDate', sql.VarChar(8), endDate.replace(/-/g, ''));
    }

    // 전표 유형 필터 (참조전표 기준)
    if (voucherType) {
      query += ` AND 회계전표.참조전표 LIKE @voucherType`;
      request.input('voucherType', sql.VarChar(20), `${voucherType}%`);
    }

    query += ` ORDER BY 회계전표.전표일자 DESC, 회계전표.전표번호 DESC, 회계전표.전표순번 ASC`;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('❌ 회계전표 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '회계전표 조회 중 오류가 발생했습니다: ' + err.message,
    });
  }
});

// ==========================================
// 자재입출내역 조회 API (거래일자 + 거래번호)
// ==========================================
app.get('/api/inventory-transactions/:date/:no', async (req, res) => {
  try {
    const 사업장코드 = req.session.user?.사업장코드 || '01';
    const { date, no } = req.params;

    const result = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('거래일자', sql.VarChar(8), date)
      .input('거래번호', sql.Real, parseFloat(no)).query(`
        SELECT
          i.*,
          자재.자재명,
          자재.규격,
          자재.단위,
          매출처.매출처명,
          매입처.매입처명
        FROM 자재입출내역 i
          LEFT JOIN 자재
            ON i.분류코드 = 자재.분류코드
            AND i.세부코드 = 자재.세부코드
          LEFT JOIN 매출처
            ON i.매출처코드 = 매출처.매출처코드
            AND i.사업장코드 = 매출처.사업장코드
          LEFT JOIN 매입처
            ON i.매입처코드 = 매입처.매입처코드
            AND i.사업장코드 = 매입처.사업장코드
        WHERE i.사업장코드 = @사업장코드
          AND i.거래일자 = @거래일자
          AND i.거래번호 = @거래번호
          AND i.사용구분 = 0
        ORDER BY i.일련번호
      `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (err) {
    console.error('❌ 자재입출내역 조회 오류:', err);
    res.status(500).json({
      success: false,
      message: '자재입출내역 조회 중 오류가 발생했습니다: ' + err.message,
    });
  }
});

// ==========================================
// 회계전표 일괄 수정 API
// ==========================================
app.put('/api/accounting-vouchers/batch-update', async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '수정할 전표 정보가 없습니다.',
      });
    }

    const 사업장코드 = req.session.user?.사업장코드 || '01';

    // 트랜잭션 시작
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const update of updates) {
        const { 전표번호, 전표일자, 전표순번, 금액, 적요 } = update;

        await transaction
          .request()
          .input('전표번호', sql.VarChar(20), 전표번호)
          .input('전표일자', sql.VarChar(8), 전표일자)
          .input('전표순번', sql.Real, 전표순번)
          .input('사업장코드', sql.VarChar(2), 사업장코드)
          .input('금액', sql.Money, 금액)
          .input('적요', sql.NVarChar(100), 적요).query(`
            UPDATE 회계전표
            SET 금액 = @금액,
                적요 = @적요
            WHERE 전표번호 = @전표번호
              AND 전표일자 = @전표일자
              AND 전표순번 = @전표순번
              AND 사업장코드 = @사업장코드
          `);
      }

      await transaction.commit();

      res.json({
        success: true,
        message: `${updates.length}건의 회계전표가 수정되었습니다.`,
      });

      console.log(`✅ 회계전표 일괄 수정 완료: ${updates.length}건`);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('❌ 회계전표 일괄 수정 오류:', err);
    res.status(500).json({
      success: false,
      message: '회계전표 수정 중 오류가 발생했습니다: ' + err.message,
    });
  }
});

// ==========================================
// 회계전표 일괄 삭제 API (소프트 삭제)
// ==========================================
app.delete('/api/accounting-vouchers/batch-delete', async (req, res) => {
  try {
    const { deleteList } = req.body;

    if (!deleteList || !Array.isArray(deleteList) || deleteList.length === 0) {
      return res.status(400).json({
        success: false,
        message: '삭제할 전표 정보가 없습니다.',
      });
    }

    const 사업장코드 = req.session.user?.사업장코드 || '01';

    // 트랜잭션 시작
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const item of deleteList) {
        const { 전표번호, 전표일자, 전표순번 } = item;

        await transaction
          .request()
          .input('전표번호', sql.VarChar(20), 전표번호)
          .input('전표일자', sql.VarChar(8), 전표일자)
          .input('전표순번', sql.Real, 전표순번)
          .input('사업장코드', sql.VarChar(2), 사업장코드).query(`
            UPDATE 회계전표
            SET 사용구분 = 1
            WHERE 전표번호 = @전표번호
              AND 전표일자 = @전표일자
              AND 전표순번 = @전표순번
              AND 사업장코드 = @사업장코드
          `);
      }

      await transaction.commit();

      res.json({
        success: true,
        message: `${deleteList.length}건의 회계전표가 삭제되었습니다.`,
      });

      console.log(`✅ 회계전표 일괄 삭제 완료: ${deleteList.length}건`);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('❌ 회계전표 일괄 삭제 오류:', err);
    res.status(500).json({
      success: false,
      message: '회계전표 삭제 중 오류가 발생했습니다: ' + err.message,
    });
  }
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

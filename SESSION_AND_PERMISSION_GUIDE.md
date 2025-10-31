# 세션 관리 및 권한 관리 가이드

## 목적

이 문서는 다음을 명확히 하기 위해 작성되었습니다:
1. **로그인 세션 관리**: 사용자 인증 및 세션 유지
2. **사용자 정보 추적**: 모든 작업에서 "누가" 작업했는지 기록
3. **메뉴별 권한 관리**: 향후 개발할 권한 기반 접근 제어 (Role-Based Access Control)

---

## 현재 구현 상태

### 1. 세션 관리 (✅ 구현 완료)

#### 세션 설정
**위치**: [server.js:46-63](server.js#L46-L63)

```javascript
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24시간
      httpOnly: true,
      secure: false, // HTTPS 사용 시 true로 변경
    },
  }),
);
```

#### 로그인 API
**위치**: [server.js:151-239](server.js#L151-L239)

**기능**:
- 사용자코드와 비밀번호 검증 (bcrypt 해시 지원)
- 사용자 테이블에 `시작일시`, `로그인여부='Y'` 업데이트
- 세션에 사용자 정보 저장:
  ```javascript
  req.session.user = {
    사용자코드: user.사용자코드,
    사용자명: user.사용자명,
    사용자권한: user.사용자권한,
    사업장코드: user.사업장코드,
    사업장명: user.사업장명,
  };
  ```

#### 로그아웃 API
**위치**: [server.js:242-276](server.js#L242-L276)

**기능**:
- 사용자 테이블에 `종료일시` 설정, `로그인여부='N'` 업데이트
- 세션 파괴: `req.session.destroy()`

---

### 2. 인증 미들웨어 (✅ 구현 완료, 미적용)

#### requireAuth() 미들웨어
**위치**: [server.js:111-119](server.js#L111-L119)

**목적**: 로그인된 사용자만 API 접근 허용

```javascript
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: '로그인이 필요합니다.',
  });
}
```

**사용 예시**:
```javascript
// 로그인 필수 API
app.get('/api/customers', requireAuth, async (req, res) => {
  // ...
});
```

#### requireRole() 미들웨어
**위치**: [server.js:125-146](server.js#L125-L146)

**목적**: 특정 권한을 가진 사용자만 접근 허용

```javascript
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
```

**사용 예시**:
```javascript
// 관리자 전용 API
app.delete('/api/customers/:code', requireRole('99'), async (req, res) => {
  // 사용자권한 = '99' (관리자)만 접근 가능
});

// 여러 권한 허용
app.post('/api/quotations', requireRole(['99', '50', '30']), async (req, res) => {
  // 권한 99, 50, 30 중 하나를 가진 사용자만 접근 가능
});
```

---

### 3. 사용자 정보 추적 (✅ 구현 완료)

모든 작성 API에서 세션의 사용자코드를 사용하여 "누가" 작업했는지 기록합니다.

#### 견적서 생성
**위치**: [server.js:1509-1515](server.js#L1509-L1515)

```javascript
const 사용자코드 = req.session?.user?.사용자코드;
if (!사용자코드) {
  return res.status(401).json({
    success: false,
    message: '로그인이 필요합니다.',
  });
}
```

#### 발주서 생성
**위치**: [server.js:2268](server.js#L2268)

```javascript
const 사용자코드 = req.session?.user?.사용자코드 || '8080'; // 기본값 사용 (보안 취약)
```

⚠️ **문제**: 세션이 없으면 기본값 '8080' 사용 → 누가 작업했는지 추적 불가

#### 거래명세서 생성
**위치**: [server.js:3213](server.js#L3213)

```javascript
const 사용자코드 = req.session?.user?.사용자코드 || '8080'; // 기본값 사용 (보안 취약)
```

⚠️ **문제**: 동일한 보안 취약점

#### 매입전표 생성
**위치**: [server.js:3554](server.js#L3554)

```javascript
const 사용자코드 = req.session?.user?.사용자코드 || '8080'; // 기본값 사용 (보안 취약)
```

⚠️ **문제**: 동일한 보안 취약점

---

## 개선 사항 (즉시 적용 권장)

### 1. 모든 생성 API에 requireAuth 적용

**현재 문제**:
- 세션이 없어도 기본값 '8080'으로 작업 가능
- 누가 작업했는지 정확히 추적 불가
- 로그인하지 않은 사용자도 데이터 생성 가능

**해결 방법**:
```javascript
// ❌ 현재 (취약)
app.post('/api/orders', async (req, res) => {
  const 사용자코드 = req.session?.user?.사용자코드 || '8080';
  // ...
});

// ✅ 개선 (안전)
app.post('/api/orders', requireAuth, async (req, res) => {
  const 사용자코드 = req.session.user.사용자코드; // 항상 존재함
  // ...
});
```

**적용 대상 API**:
- `POST /api/quotations_add` - 견적서 작성 (일부 구현됨)
- `POST /api/orders` - 발주서 작성
- `POST /api/transactions` - 거래명세서 작성
- `POST /api/purchase-statements` - 매입전표 작성
- `POST /api/customers` - 매출처 등록
- `POST /api/suppliers` - 매입처 등록
- `POST /api/materials` - 자재 등록
- 모든 PUT, DELETE API

---

## 향후 개발: 메뉴별 권한 관리

### 사용자 권한 코드 체계

현재 사용자 테이블의 `사용자권한` 필드를 활용:

| 권한 코드 | 권한 명칭 | 설명 |
|---------|---------|------|
| 99 | 시스템 관리자 | 모든 메뉴 접근 및 관리 가능 |
| 50 | 영업 관리자 | 매출 관련 메뉴 전체 접근 |
| 40 | 구매 관리자 | 매입 관련 메뉴 전체 접근 |
| 30 | 영업 담당 | 견적, 거래명세서 작성 가능 (조회/수정 제한) |
| 20 | 구매 담당 | 발주, 매입전표 작성 가능 (조회/수정 제한) |
| 10 | 일반 사용자 | 조회 전용 |

### 메뉴별 권한 매핑 (예시)

#### 매출 관리
```javascript
// 거래명세서 작성
app.post('/api/transactions', requireRole(['99', '50', '30']), async (req, res) => {
  // 관리자, 영업 관리자, 영업 담당만 작성 가능
});

// 거래명세서 삭제
app.delete('/api/transactions/:date/:no', requireRole(['99', '50']), async (req, res) => {
  // 관리자, 영업 관리자만 삭제 가능
});

// 거래명세서 조회
app.get('/api/transactions', requireAuth, async (req, res) => {
  // 로그인한 모든 사용자 조회 가능
});
```

#### 매입 관리
```javascript
// 매입전표 작성
app.post('/api/purchase-statements', requireRole(['99', '40', '20']), async (req, res) => {
  // 관리자, 구매 관리자, 구매 담당만 작성 가능
});

// 매입전표 삭제
app.delete('/api/purchase-statements/:date/:no', requireRole(['99', '40']), async (req, res) => {
  // 관리자, 구매 관리자만 삭제 가능
});
```

#### 기준 정보 관리
```javascript
// 매출처 등록
app.post('/api/customers', requireRole(['99', '50']), async (req, res) => {
  // 관리자, 영업 관리자만 등록 가능
});

// 매입처 등록
app.post('/api/suppliers', requireRole(['99', '40']), async (req, res) => {
  // 관리자, 구매 관리자만 등록 가능
});

// 자재 등록
app.post('/api/materials', requireRole(['99', '50', '40']), async (req, res) => {
  // 관리자, 영업/구매 관리자만 등록 가능
});
```

### 데이터 필터링 (Row-Level Security)

사용자 권한에 따라 **자신의 데이터만** 볼 수 있도록 제한:

```javascript
app.get('/api/quotations', requireAuth, async (req, res) => {
  const { 사용자코드, 사용자권한, 사업장코드 } = req.session.user;

  let whereClause = 'WHERE q.사용구분 = 0';

  // 일반 사용자 (권한 10~30): 자신이 작성한 견적만 조회
  if (parseInt(사용자권한) < 40) {
    whereClause += ` AND q.사용자코드 = '${사용자코드}'`;
  }

  // 관리자 (권한 40+): 같은 사업장 전체 조회
  if (parseInt(사용자권한) >= 40 && parseInt(사용자권한) < 99) {
    whereClause += ` AND q.사업장코드 = '${사업장코드}'`;
  }

  // 시스템 관리자 (권한 99): 모든 사업장 조회 가능

  const query = `
    SELECT * FROM 견적 q
    ${whereClause}
    ORDER BY q.견적일자 DESC
  `;

  // ...
});
```

---

## 프론트엔드 권한 처리

### 메뉴 표시 제어

로그인 시 받은 사용자 권한에 따라 메뉴를 표시/숨김:

```javascript
// index.html - showMenuByPermission 함수 예시
function showMenuByPermission() {
  const userPermission = sessionStorage.getItem('사용자권한');

  // 매출 관리 메뉴
  if (parseInt(userPermission) >= 30) {
    document.getElementById('salesMenu').style.display = 'block';
  }

  // 매입 관리 메뉴
  if (parseInt(userPermission) >= 20) {
    document.getElementById('purchaseMenu').style.display = 'block';
  }

  // 기준 정보 관리 메뉴
  if (parseInt(userPermission) >= 40) {
    document.getElementById('masterMenu').style.display = 'block';
  }

  // 시스템 관리 메뉴
  if (parseInt(userPermission) === 99) {
    document.getElementById('systemMenu').style.display = 'block';
  }
}
```

### 버튼 활성화/비활성화

```javascript
// 거래명세서 페이지
function loadTransactionPage() {
  const userPermission = sessionStorage.getItem('사용자권한');

  // 작성 버튼
  if (parseInt(userPermission) >= 30) {
    document.getElementById('btnCreateTransaction').disabled = false;
  } else {
    document.getElementById('btnCreateTransaction').disabled = true;
  }

  // 삭제 버튼
  if (parseInt(userPermission) >= 50) {
    document.getElementById('btnDeleteTransaction').disabled = false;
  } else {
    document.getElementById('btnDeleteTransaction').disabled = true;
  }
}
```

---

## 구현 우선순위

### Phase 1: 인증 강화 (즉시 적용 권장)
1. ✅ 모든 작성/수정/삭제 API에 `requireAuth` 미들웨어 적용
2. ✅ 기본값 '8080' 제거, 세션 필수화
3. ✅ 프론트엔드 로그인 체크 강화

### Phase 2: 기본 권한 관리 (1차 개발)
1. ✅ 주요 API에 `requireRole` 미들웨어 적용
   - 견적서: 영업 권한 (30+)
   - 발주서: 구매 권한 (20+)
   - 매출처/매입처 관리: 관리자 권한 (40+)
2. ✅ 프론트엔드 메뉴 권한 제어
3. ✅ 버튼 권한 제어

### Phase 3: 고급 권한 관리 (2차 개발)
1. ⏳ 데이터 필터링 (Row-Level Security)
2. ⏳ 권한 관리 UI (관리자 화면)
3. ⏳ 감사 로그 (Audit Log) - 모든 작업 기록
4. ⏳ 권한별 대시보드 커스터마이징

---

## 보안 체크리스트

### 백엔드
- [ ] 모든 작성/수정/삭제 API에 `requireAuth` 적용
- [ ] 민감한 작업에 `requireRole` 적용
- [ ] SQL Injection 방지 (parameterized queries 사용)
- [ ] 세션 타임아웃 설정 (현재 24시간)
- [ ] HTTPS 사용 시 `secure: true` 설정
- [ ] 비밀번호 bcrypt 해싱 (현재 지원)

### 프론트엔드
- [ ] 로그인 페이지 리다이렉트
- [ ] 세션 만료 시 재로그인 유도
- [ ] 권한 없는 메뉴 숨김
- [ ] API 오류 시 적절한 메시지 표시
- [ ] 로그인 정보 sessionStorage/localStorage 보안 처리

---

## 참고 사항

### 사용자 테이블 구조
```sql
CREATE TABLE 사용자 (
  사용자코드 VARCHAR(4) PRIMARY KEY,
  사용자명 VARCHAR(20),
  사용자권한 VARCHAR(2),     -- 권한 코드 (99, 50, 40, 30, 20, 10)
  사업장코드 VARCHAR(2),
  로그인비밀번호 VARCHAR(100), -- bcrypt 해시 또는 평문
  시작일시 VARCHAR(17),       -- 로그인 시간
  종료일시 VARCHAR(17),       -- 로그아웃 시간
  로그인여부 VARCHAR(1),      -- 'Y' or 'N'
  사용구분 TINYINT            -- 0=활성, 1=비활성
)
```

### 세션 데이터 구조
```javascript
req.session.user = {
  사용자코드: '0687',
  사용자명: '장준호',
  사용자권한: '99',
  사업장코드: '01',
  사업장명: '제이씨엠전기'
}
```

---

## 문의 및 수정 이력

**최초 작성**: 2025-10-31
**작성 목적**: 세션 관리 및 권한 관리 체계 명확화
**향후 업데이트**: 권한 관리 구현 시 이 문서 업데이트 필요

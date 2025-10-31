# 시스템 개선 권장 사항

작성일: 2025-11-01

## 우선순위 1: 보안 강화 (High Priority)

### 1.1 발주서 저장 시 세션 검증 추가
**현재 문제:**
- 발주서는 로그인 없이도 기본값 '8080'으로 작성 가능
- 사업장코드를 사용자가 요청 본문으로 전송하여 조작 가능

**개선 방안:**
```javascript
// server.js - POST /api/orders
// 견적서와 동일하게 세션 검증 추가
const 사용자코드 = req.session?.user?.사용자코드;
const 사업장코드 = req.session?.user?.사업장코드;

if (!사용자코드 || !사업장코드) {
  return res.status(401).json({
    success: false,
    message: '로그인이 필요합니다.',
  });
}
```

**파일 위치:** `server.js:2224` (POST /api/orders)

### 1.2 모든 API 엔드포인트에 인증 미들웨어 적용
**현재 문제:**
- 대부분의 API가 인증 없이 접근 가능
- `requireAuth` 미들웨어가 정의되어 있지만 사용되지 않음

**개선 방안:**
```javascript
// 읽기 전용 API
app.get('/api/customers', requireAuth, async (req, res) => { ... });
app.get('/api/suppliers', requireAuth, async (req, res) => { ... });

// 쓰기 API (역할 기반 권한 추가)
app.post('/api/quotations_add', requireAuth, requireRole(['99', '50']), async (req, res) => { ... });
app.post('/api/orders', requireAuth, requireRole(['99', '40']), async (req, res) => { ... });
```

**참고 문서:** `SESSION_AND_PERMISSION_GUIDE.md`

## 우선순위 2: 데이터 무결성 강화 (High Priority)

### 2.1 트랜잭션 적용
**현재 문제:**
- 견적서, 발주서 모두 트랜잭션 없이 저장
- 마스터 저장 후 디테일 저장 실패 시 불완전한 데이터가 DB에 남음

**개선 방안:**
```javascript
// 견적서, 발주서 모두 동일한 패턴 적용
const transaction = new sql.Transaction(pool);

try {
  await transaction.begin();

  // 1. 로그에서 번호 조회
  const request1 = new sql.Request(transaction);
  const logResult = await request1.query(...);

  // 2. 마스터 삽입
  const request2 = new sql.Request(transaction);
  await request2.query(...);

  // 3. 디테일 삽입
  for (const detail of details) {
    const request3 = new sql.Request(transaction);
    await request3.query(...);
  }

  // 4. 로그 업데이트
  const request4 = new sql.Request(transaction);
  await request4.query(...);

  await transaction.commit();
} catch (err) {
  await transaction.rollback();
  throw err;
}
```

**파일 위치:**
- `server.js:1503` (POST /api/quotations_add)
- `server.js:2224` (POST /api/orders)

### 2.2 외래키 제약조건 검증
**현재 문제:**
- 존재하지 않는 매출처코드, 매입처코드, 자재코드로 저장 가능
- DB에서 외래키 제약조건이 있다면 에러, 없다면 고아 레코드 생성

**개선 방안:**
```javascript
// 저장 전 외래키 존재 여부 확인
const customerCheck = await pool.request()
  .input('매출처코드', sql.VarChar(8), 매출처코드)
  .query('SELECT COUNT(*) as cnt FROM 매출처 WHERE 매출처코드 = @매출처코드 AND 사용구분 = 0');

if (customerCheck.recordset[0].cnt === 0) {
  return res.status(400).json({ success: false, message: '존재하지 않는 매출처입니다.' });
}
```

## 우선순위 3: 입력 검증 강화 (Medium Priority)

### 3.1 날짜 형식 검증
**현재 문제:**
- 잘못된 날짜 형식 (예: '20251301', '20250231')도 저장됨

**개선 방안:**
```javascript
function validateDate(dateStr) {
  if (!/^\d{8}$/.test(dateStr)) return false;

  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6));
  const day = parseInt(dateStr.substring(6, 8));

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
         date.getMonth() === month - 1 &&
         date.getDate() === day;
}
```

### 3.2 숫자 범위 검증
**현재 문제:**
- 음수 수량, 음수 단가 등 비정상 값도 저장됨

**개선 방안:**
```javascript
if (detail.수량 <= 0) {
  return res.status(400).json({ success: false, message: '수량은 0보다 커야 합니다.' });
}

if (detail.단가 < 0) {
  return res.status(400).json({ success: false, message: '단가는 음수일 수 없습니다.' });
}
```

### 3.3 문자열 길이 검증
**현재 문제:**
- DB 컬럼 크기를 초과하는 문자열 저장 시 잘림 또는 에러

**개선 방안:**
```javascript
if (제목 && 제목.length > 30) {
  return res.status(400).json({ success: false, message: '제목은 30자를 초과할 수 없습니다.' });
}
```

## 우선순위 4: 코드 일관성 개선 (Medium Priority)

### 4.1 API 호출 방식 통일
**현재 문제:**
- 견적서: 하드코딩된 URL `'http://localhost:3000/api/quotations_add'`
- 발주서: `apiCall()` 헬퍼 함수 사용

**개선 방안:**
```javascript
// quotation.js - 견적서도 apiCall() 사용
const result = await apiCall('/quotations_add', 'POST', requestData);
```

**파일 위치:** `js/quotation.js:2154`

### 4.2 필드 타입 통일
**현재 문제:**
- 결제방법: 견적서=`TinyInt`, 발주서=`VarChar(20)`
- 상태코드: 견적서=`TinyInt`, 발주서=`Int`

**개선 방안:**
- DB 스키마 확인 후 통일된 데이터 타입 사용
- 또는 각 테이블의 실제 컬럼 타입에 맞게 코드 수정

### 4.3 DataTable 새로고침 방식 통일
**현재 문제:**
- 견적서: `quotationTable.ajax.reload()`
- 발주서: `window.loadOrders()` (전체 재생성)

**개선 방안:**
```javascript
// order.js - DataTable을 전역 변수로 관리하고 reload() 사용
if (typeof orderTable !== 'undefined') {
  orderTable.ajax.reload(null, false); // 현재 페이지 유지
}
```

## 우선순위 5: 세금 처리 로직 정리 (Low Priority)

### 5.1 발주서에 세금 필드 추가 여부 결정
**현재 상황:**
- 견적서: 입고부가, 출고부가 저장
- 발주서: 세금 정보 저장 안 함

**질문:**
- 발주서에도 세금 정보가 필요한가?
- 비즈니스 요구사항에 따라 결정 필요

## 우선순위 6: 로그 및 모니터링 개선 (Low Priority)

### 6.1 에러 로그 구조화
**개선 방안:**
```javascript
// 에러 로깅 헬퍼 함수
function logError(context, err, additionalInfo = {}) {
  console.error('❌ 에러 발생:', {
    timestamp: new Date().toISOString(),
    context,
    message: err.message,
    stack: err.stack,
    ...additionalInfo
  });
}

// 사용 예시
catch (err) {
  logError('발주서 생성', err, {
    발주일자: master.발주일자,
    사용자코드,
    details: details.length
  });
}
```

### 6.2 성공 로그 최소화
**현재 문제:**
- 모든 성공 케이스에 console.log 출력
- 운영 환경에서는 불필요한 로그 증가

**개선 방안:**
```javascript
// 환경 변수로 로그 레벨 제어
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // debug, info, warn, error

function logInfo(message, data) {
  if (LOG_LEVEL === 'debug') {
    console.log('✅', message, data);
  }
}
```

## 구현 순서 권장

1. **1단계 (긴급)**: 보안 강화 (1.1, 1.2)
2. **2단계 (중요)**: 데이터 무결성 (2.1, 2.2)
3. **3단계 (안정화)**: 입력 검증 (3.1, 3.2, 3.3)
4. **4단계 (정리)**: 코드 일관성 (4.1, 4.2, 4.3)
5. **5단계 (선택)**: 세금 처리, 로그 개선 (5.1, 6.1, 6.2)

## 참고 문서

- `SESSION_AND_PERMISSION_GUIDE.md` - 세션 및 권한 관리 가이드
- `CLAUDE.md` - 프로젝트 전체 구조 및 패턴
- `COMPARISON_RESULTS.txt` - 견적서/발주서 코드 비교 분석

## 변경 이력

- 2025-11-01: 초안 작성 (발주서 저장 문제 해결 후)
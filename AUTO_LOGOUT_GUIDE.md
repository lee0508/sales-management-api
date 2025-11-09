# 자동 로그아웃 기능 구현 가이드

## 개요

브라우저 비정상 종료 또는 장시간 비활성 시 사용자를 자동으로 로그아웃하는 기능입니다.

## 구현된 기능

### 1. **Heartbeat 메커니즘** (주 방식)
- **목적**: 정상적인 사용자 활동 감지 및 세션 유지
- **동작 방식**:
  - 로그인 성공 후 5분마다 서버에 활동 신호 전송
  - 서버는 `사용자` 테이블의 `마지막활동시간` 필드 업데이트
- **엔드포인트**: `POST /api/auth/heartbeat`

### 2. **세션 타임아웃 체커** (백업 방식)
- **목적**: 네트워크 문제나 비정상 종료 시 자동 정리
- **동작 방식**:
  - 서버에서 5분마다 비활성 사용자 체크
  - 30분 이상 활동이 없는 사용자 자동 로그아웃
- **서버 시작 시 자동 실행**

### 3. **브라우저 종료 시 강제 로그아웃** (보조 방식)
- **목적**: 브라우저 닫기/탭 닫기 시 즉시 로그아웃
- **동작 방식**:
  - `beforeunload` 이벤트 감지
  - `navigator.sendBeacon()` API로 강제 로그아웃 요청 전송
- **엔드포인트**: `POST /api/auth/force-logout`

## 데이터베이스 변경사항

### 사용자 테이블 컬럼 추가

```sql
ALTER TABLE 사용자
ADD 마지막활동시간 VARCHAR(17) NULL
```

**컬럼 정보**:
- `마지막활동시간`: 사용자의 마지막 활동 시간 (YYYYMMDDHHMMSSmmm 형식)
- 로그인 시 자동 초기화
- Heartbeat마다 업데이트

**마이그레이션 스크립트**: `scripts/add-last-activity-column.js`

```bash
node scripts/add-last-activity-column.js
```

## API 엔드포인트

### 1. Heartbeat API

**Endpoint**: `POST /api/auth/heartbeat`

**인증**: 세션 필요 (`requireAuth` 미들웨어 사용하지 않음 - 현재는 세션 체크만)

**Request**: 없음 (세션에서 사용자 정보 확인)

**Response**:
```json
{
  "success": true,
  "message": "Heartbeat received"
}
```

**Error Response** (세션 만료):
```json
{
  "success": false,
  "message": "로그인이 필요합니다."
}
```
- HTTP Status: 401

**구현 위치**: [server.js:317-350](server.js#L317-L350)

---

### 2. 강제 로그아웃 API

**Endpoint**: `POST /api/auth/force-logout`

**인증**: 없음 (브라우저 종료 시 사용)

**Request**:
- `FormData` 또는 `URLSearchParams` 형식
- `사용자코드` 또는 `userId` 필드

**Example** (sendBeacon):
```javascript
const data = new URLSearchParams();
data.append('사용자코드', '0687');
navigator.sendBeacon('/api/auth/force-logout', data);
```

**Response**:
```json
{
  "success": true,
  "message": "강제 로그아웃 되었습니다."
}
```

**특징**:
- 사용자 정보가 없어도 성공 응답 (이미 로그아웃 상태일 수 있음)
- 에러 발생 시에도 200 응답 (sendBeacon은 응답 처리 안 함)

**구현 위치**: [server.js:352-412](server.js#L352-L412)

---

## 프론트엔드 구현

### 전역 변수

```javascript
let currentUser = null;         // 현재 로그인한 사용자 정보
let heartbeatInterval = null;   // Heartbeat 타이머
```

**위치**: [index.html:6443-6444](index.html#L6443-L6444)

---

### Heartbeat 함수

#### startHeartbeat()
**기능**: 5분 간격으로 서버에 활동 신호 전송

```javascript
function startHeartbeat() {
  stopHeartbeat(); // 기존 타이머 중지

  heartbeatInterval = setInterval(async () => {
    const response = await fetch('/api/auth/heartbeat', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.status === 401) {
      stopHeartbeat();
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      location.reload();
    }
  }, 5 * 60 * 1000); // 5분
}
```

**위치**: [index.html:6707-6736](index.html#L6707-L6736)

**호출 시점**:
- 로그인 성공 시 ([index.html:6673](index.html#L6673))

---

#### stopHeartbeat()
**기능**: Heartbeat 타이머 중지

```javascript
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
```

**위치**: [index.html:6741-6747](index.html#L6741-L6747)

**호출 시점**:
- 로그아웃 시 ([index.html:6761](index.html#L6761))
- 세션 만료 감지 시

---

### 브라우저 종료 이벤트 처리

```javascript
window.addEventListener('beforeunload', function (e) {
  if (currentUser && currentUser.사용자코드) {
    const data = new URLSearchParams();
    data.append('사용자코드', currentUser.사용자코드);

    navigator.sendBeacon('/api/auth/force-logout', data);
  }
});
```

**위치**: [index.html:6826-6836](index.html#L6826-L6836)

**특징**:
- `sendBeacon()` API 사용 - 브라우저 종료 시에도 확실하게 전송
- 비동기 요청이지만 응답을 기다리지 않음
- 새로고침/탭 닫기/브라우저 종료 모두 감지

---

## 서버 측 구현

### 세션 타임아웃 체커

**함수**: `startSessionTimeoutChecker()`

**위치**: [server.js:116-164](server.js#L116-L164)

**동작 방식**:
```javascript
function startSessionTimeoutChecker() {
  const TIMEOUT_MINUTES = 30;      // 타임아웃: 30분
  const CHECK_INTERVAL = 5 * 60 * 1000; // 체크 주기: 5분

  setInterval(async () => {
    const cutoffTimestamp = /* 현재 시간 - 30분 */;

    // 30분 이상 활동이 없는 사용자 조회
    const result = await pool.request()
      .input('cutoffTime', sql.VarChar(17), cutoffTimestamp)
      .query(`
        SELECT 사용자코드, 사용자명, 마지막활동시간
        FROM 사용자
        WHERE 로그인여부 = 'Y'
          AND 마지막활동시간 IS NOT NULL
          AND 마지막활동시간 < @cutoffTime
      `);

    if (result.recordset.length > 0) {
      // 비활성 사용자 자동 로그아웃
      await pool.request()
        .input('cutoffTime', sql.VarChar(17), cutoffTimestamp)
        .input('종료일시', sql.VarChar(17), 종료일시)
        .query(`
          UPDATE 사용자
          SET 종료일시 = @종료일시, 로그인여부 = 'N'
          WHERE 로그인여부 = 'Y'
            AND 마지막활동시간 IS NOT NULL
            AND 마지막활동시간 < @cutoffTime
        `);

      console.log(`⏰ 세션 타임아웃: ${result.recordset.length}명 자동 로그아웃`);
    }
  }, CHECK_INTERVAL);
}
```

**서버 시작 시 실행**: [server.js:103](server.js#L103)

---

### 로그인 시 마지막활동시간 초기화

**위치**: [server.js:270-280](server.js#L270-L280)

```javascript
// 로그인 시간 및 마지막 활동 시간 업데이트
await pool.request()
  .input('사용자코드', sql.VarChar(4), userId)
  .input('시작일시', sql.VarChar(17), 시작일시)
  .query(`
    UPDATE 사용자
    SET 시작일시 = @시작일시,
        로그인여부 = 'Y',
        마지막활동시간 = @시작일시
    WHERE 사용자코드 = @사용자코드
  `);
```

---

## 설정 값

### 타임아웃 설정

**서버 측** ([server.js:117](server.js#L117)):
```javascript
const TIMEOUT_MINUTES = 30;        // 30분 후 자동 로그아웃
const CHECK_INTERVAL = 5 * 60 * 1000; // 5분마다 체크
```

**프론트엔드** ([index.html:6735](index.html#L6735)):
```javascript
heartbeatInterval = setInterval(async () => {
  // Heartbeat 전송
}, 5 * 60 * 1000); // 5분마다 전송
```

### 타임아웃 시간 변경하기

1. **서버 측 타임아웃 변경**:
   - `server.js` 파일의 `TIMEOUT_MINUTES` 값 수정
   - 예: 60분으로 변경 시 `const TIMEOUT_MINUTES = 60;`

2. **Heartbeat 주기 변경** (권장: 타임아웃의 1/6):
   - `index.html`의 `startHeartbeat()` 함수 수정
   - 예: 10분 간격 시 `10 * 60 * 1000`

**권장 설정**:
- 타임아웃 30분 → Heartbeat 5분
- 타임아웃 60분 → Heartbeat 10분

---

## 테스트 방법

### 1. Heartbeat 테스트

1. 로그인 후 브라우저 개발자 도구 콘솔 확인
2. 5분 후 `💓 Heartbeat 전송 성공` 메시지 확인
3. 서버 로그에서 마지막활동시간 업데이트 확인

### 2. 세션 타임아웃 테스트

**빠른 테스트** (타임아웃 시간 단축):
1. `server.js`의 `TIMEOUT_MINUTES`를 1분으로 변경
2. 로그인 후 1분 동안 아무 활동 없이 대기
3. 5분 후 서버 로그에서 자동 로그아웃 메시지 확인

```javascript
// 테스트용 설정
const TIMEOUT_MINUTES = 1;  // 1분 (원래: 30)
const CHECK_INTERVAL = 1 * 60 * 1000; // 1분마다 체크 (원래: 5분)
```

**서버 로그 예시**:
```
⏰ 세션 타임아웃: 1명의 사용자 자동 로그아웃
   - 장준호 (0687), 마지막 활동: 20251109010500000
```

### 3. 브라우저 종료 테스트

1. 로그인
2. 브라우저 탭 닫기 또는 브라우저 종료
3. 서버 로그 확인:
   ```
   ✅ 강제 로그아웃 성공 - 사용자코드: 0687
   ```
4. 데이터베이스에서 `로그인여부='N'` 확인

### 4. 새로고침 테스트

**주의**: 현재 구현은 새로고침 시에도 로그아웃됩니다.

**새로고침 허용하려면**:
```javascript
// index.html - beforeunload 이벤트 수정
window.addEventListener('beforeunload', function (e) {
  // 새로고침 감지
  if (performance.navigation.type === 1) {
    return; // 새로고침은 로그아웃 안 함
  }

  // 나머지 코드...
});
```

---

## 서버 시작 방법

### Windows 환경

**일반 실행** (Git Bash 경로 변환 문제 없음):
```bash
npm start
```

**Git Bash 사용 시** (MSYS 경로 변환 문제 발생):
```bash
MSYS_NO_PATHCONV=1 npm start
# 또는
MSYS_NO_PATHCONV=1 node server.js
```

**Windows CMD/PowerShell** (권장):
```cmd
npm start
```

---

## 문제 해결

### Git Bash 경로 변환 오류

**오류 메시지**:
```
PathError [TypeError]: Missing parameter name at index 2: C:/Program Files/Git/sales-management-api
```

**원인**: Git Bash의 MSYS가 `/sales-management-api`를 Windows 경로로 변환

**해결 방법**:
```bash
MSYS_NO_PATHCONV=1 node server.js
```

또는 Windows CMD/PowerShell 사용 권장

---

### Heartbeat 전송 실패 (401 오류)

**원인**: 세션 만료

**자동 처리**:
- 프론트엔드에서 자동으로 세션 만료 경고 표시
- 페이지 리로드로 로그인 페이지 이동

**수동 처리**:
- 로그인 페이지로 이동하여 재로그인

---

## 향후 개선 사항

### 1. 새로고침 허용
현재는 새로고침 시에도 로그아웃됩니다. `performance.navigation.type`으로 새로고침을 감지하여 예외 처리 가능합니다.

### 2. 타임아웃 경고
세션 만료 5분 전 사용자에게 경고 표시:
```javascript
// 예: 25분 후 경고 표시
setTimeout(() => {
  if (confirm('5분 후 자동 로그아웃됩니다. 계속 사용하시겠습니까?')) {
    // Heartbeat 즉시 전송
    fetch('/api/auth/heartbeat', { method: 'POST', credentials: 'include' });
  }
}, 25 * 60 * 1000);
```

### 3. 사용자별 타임아웃 설정
`사용자` 테이블에 `타임아웃시간` 컬럼 추가:
```sql
ALTER TABLE 사용자 ADD 타임아웃시간 INT DEFAULT 30; -- 분 단위
```

### 4. 활동 감지 자동화
마우스/키보드 활동 감지하여 자동 Heartbeat:
```javascript
let lastActivity = Date.now();

['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
  document.addEventListener(event, () => {
    lastActivity = Date.now();
  }, true);
});

// Heartbeat 시 마지막 활동 시간 체크
```

---

## 관련 파일

### 백엔드
- [server.js:116-164](server.js#L116-L164) - 세션 타임아웃 체커
- [server.js:270-280](server.js#L270-L280) - 로그인 시 마지막활동시간 초기화
- [server.js:317-350](server.js#L317-L350) - Heartbeat API
- [server.js:352-412](server.js#L352-L412) - 강제 로그아웃 API

### 프론트엔드
- [index.html:6444](index.html#L6444) - 전역 변수
- [index.html:6707-6747](index.html#L6707-L6747) - Heartbeat 함수
- [index.html:6826-6836](index.html#L6826-L6836) - beforeunload 이벤트

### 마이그레이션
- `scripts/add-last-activity-column.js` - 데이터베이스 컬럼 추가

---

## 요약

✅ **구현 완료**:
1. 데이터베이스 컬럼 추가 (`마지막활동시간`)
2. Heartbeat API 구현 (5분 간격)
3. 세션 타임아웃 체커 (30분 비활성 시 자동 로그아웃)
4. 브라우저 종료 시 강제 로그아웃 (sendBeacon)
5. 프론트엔드 통합 (로그인/로그아웃 시 Heartbeat 시작/중지)

✅ **보안 강화**:
- 중복 로그인 방지
- 비활성 사용자 자동 정리
- 브라우저 종료 시 즉시 로그아웃

✅ **운영 편의성**:
- 서버 로그로 자동 로그아웃 모니터링
- 타임아웃 시간 쉽게 조정 가능
- 마이그레이션 스크립트 제공

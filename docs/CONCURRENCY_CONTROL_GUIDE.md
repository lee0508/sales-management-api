# 동시성 제어 가이드 (Concurrency Control Guide)

## 개요

VB6 시스템과 웹 시스템의 1개월 병행 운영 기간 동안 데이터 충돌을 방지하기 위한 가이드입니다.

## 핵심 원칙

```
✅ VB6 시스템: 수정 불필요 (30년 검증된 코드 유지)
✅ 웹 시스템: 방어적 프로그래밍 (충돌 감지 및 회피)
✅ DB 레벨: 동시성 제어 (UPDLOCK 활용)
```

## 충돌 시나리오 및 해결 방안

### 1. 자동번호 생성 충돌 (로그 테이블)

#### 문제 상황

```
시간  VB6 사용자                웹 사용자
───────────────────────────────────────────────
10:00 견적서 작성 시작
10:01 로그 조회: 최종로그=5     로그 조회: 최종로그=5
10:02 새번호 계산: 6             새번호 계산: 6
10:03 견적 INSERT (번호=6)
10:04                            견적 INSERT (번호=6) ❌ 충돌!
10:05 로그 UPDATE (최종로그=6)  로그 UPDATE (최종로그=6)
```

**결과**: 같은 번호의 견적서가 2개 생성됨 (Primary Key 오류 발생 가능)

#### 해결 방안: DB 레벨 행 잠금 (UPDLOCK)

**Before (현재 코드):**
```javascript
// ❌ 충돌 가능
const logResult = await new sql.Request(transaction)
  .input('테이블명', sql.VarChar(50), '견적')
  .input('베이스코드', sql.VarChar(50), 견적일자)
  .query(`
    SELECT 최종로그 FROM 로그
    WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
  `);
```

**After (개선 코드):**
```javascript
// ✅ 충돌 방지
const logResult = await new sql.Request(transaction)
  .input('테이블명', sql.VarChar(50), '견적')
  .input('베이스코드', sql.VarChar(50), 견적일자)
  .query(`
    SELECT 최종로그 FROM 로그 WITH (UPDLOCK, ROWLOCK)
    WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
  `);
```

**동작 원리:**
```
시간  VB6 사용자                     웹 사용자
─────────────────────────────────────────────────────────
10:01 로그 조회 (UPDLOCK 획득)
10:02 새번호 계산: 6                로그 조회 시도 → 대기 중...
10:03 견적 INSERT (번호=6)
10:04 로그 UPDATE
10:05 COMMIT (잠금 해제)            로그 조회 성공 (최종로그=6)
10:06                               새번호 계산: 7
10:07                               견적 INSERT (번호=7) ✅ 정상
```

**핵심:**
- `WITH (UPDLOCK, ROWLOCK)`: 해당 행에 업데이트 잠금 설정
- VB6 또는 웹에서 먼저 조회한 쪽이 잠금 획득
- 다른 쪽은 트랜잭션 완료까지 대기
- VB6 코드 수정 불필요 (DB가 자동 처리)

#### 적용 대상

- **견적서 작성** (POST /api/quotations)
- **발주서 작성** (POST /api/orders)
- **거래명세서 작성** (POST /api/transactions)
- **매입전표 작성** (POST /api/purchase-statements)

---

### 2. 동일 레코드 수정 충돌

#### 문제 상황

```
시간  VB6 사용자                      웹 사용자
─────────────────────────────────────────────────────────
10:00 견적서 조회 (금액=1,000,000)
10:01                                견적서 조회 (금액=1,000,000)
10:02 금액 수정: 1,500,000
10:03 저장 완료 (금액=1,500,000)
10:04                                금액 수정: 2,000,000
10:05                                저장 (금액=2,000,000)
                                     → VB6 수정 내역 손실! ❌
```

**결과**: VB6에서 수정한 1,500,000원이 사라지고 2,000,000원으로 덮어씌워짐

#### 해결 방안: 낙관적 잠금 (Optimistic Locking)

**개념:**
- 수정 시점에 데이터가 변경되었는지 확인
- 변경되었으면 오류 반환, 사용자에게 알림
- 변경 안되었으면 정상 수정

**구현 방법 1: 수정일시 활용 (테이블 변경 불필요)**

```javascript
// UPDATE API에서
app.put('/api/quotations/:date/:no', async (req, res) => {
  const { 견적일자, 견적번호 } = req.params;
  const { 수정일시_조회시, 금액, 비고 } = req.body;

  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // 1. 현재 수정일시 조회
    const current = await new sql.Request(transaction)
      .input('견적일자', sql.VarChar(8), 견적일자)
      .input('견적번호', sql.Real, 견적번호)
      .query(`
        SELECT 수정일시 FROM 견적
        WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호
      `);

    // 2. 조회 시점과 현재 시점의 수정일시 비교
    if (current.recordset[0].수정일시 !== 수정일시_조회시) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: '다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도하세요.',
        code: 'CONFLICT'
      });
    }

    // 3. 수정 진행
    const result = await new sql.Request(transaction)
      .input('견적일자', sql.VarChar(8), 견적일자)
      .input('견적번호', sql.Real, 견적번호)
      .input('금액', sql.Money, 금액)
      .input('비고', sql.NVarChar(sql.MAX), 비고)
      .input('수정일시', sql.VarChar(17), 현재일시)
      .query(`
        UPDATE 견적
        SET 금액 = @금액,
            비고 = @비고,
            수정일시 = @수정일시
        WHERE 견적일자 = @견적일자
          AND 견적번호 = @견적번호
      `);

    await transaction.commit();
    res.json({ success: true });

  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
});
```

**구현 방법 2: 버전 컬럼 추가 (권장 - 더 명확함)**

```sql
-- 테이블에 버전 컬럼 추가
ALTER TABLE 견적 ADD 버전 INT DEFAULT 1;
ALTER TABLE 발주 ADD 버전 INT DEFAULT 1;
ALTER TABLE 자재입출내역 ADD 버전 INT DEFAULT 1;
```

```javascript
// UPDATE API에서
app.put('/api/quotations/:date/:no', async (req, res) => {
  const { 견적일자, 견적번호 } = req.params;
  const { 버전_조회시, 금액, 비고 } = req.body;

  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // 조회 시점의 버전과 일치하는 경우에만 UPDATE
    const result = await new sql.Request(transaction)
      .input('견적일자', sql.VarChar(8), 견적일자)
      .input('견적번호', sql.Real, 견적번호)
      .input('버전_조회시', sql.Int, 버전_조회시)
      .input('금액', sql.Money, 금액)
      .input('비고', sql.NVarChar(sql.MAX), 비고)
      .query(`
        UPDATE 견적
        SET 금액 = @금액,
            비고 = @비고,
            버전 = 버전 + 1,
            수정일시 = GETDATE()
        WHERE 견적일자 = @견적일자
          AND 견적번호 = @견적번호
          AND 버전 = @버전_조회시
      `);

    // rowsAffected = 0 이면 다른 사용자가 수정했음
    if (result.rowsAffected[0] === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: '다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도하세요.',
        code: 'CONFLICT'
      });
    }

    await transaction.commit();
    res.json({ success: true });

  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
});
```

**프론트엔드 처리:**
```javascript
// 조회 시 버전 저장
const quotation = await fetch(`/api/quotations/${date}/${no}`).then(r => r.json());
const originalVersion = quotation.data.버전;

// 수정 시 버전 함께 전송
const response = await fetch(`/api/quotations/${date}/${no}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    버전_조회시: originalVersion,
    금액: newAmount,
    비고: newNote
  })
});

// 충돌 감지 시 사용자에게 알림
if (response.status === 409) {
  alert('다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도하세요.');
  location.reload();
}
```

#### 적용 대상

- **견적서 수정** (PUT /api/quotations/:date/:no)
- **발주서 수정** (PUT /api/orders/:date/:no)
- **거래명세서 수정** (PUT /api/transactions/:date/:no)
- **매입전표 수정** (PUT /api/purchase-statements/:date/:no)

---

### 3. 삭제 충돌

#### 문제 상황

```
시간  VB6 사용자                웹 사용자
─────────────────────────────────────────────────
10:00 견적서 조회 (사용구분=0)
10:01                           견적서 삭제 (사용구분=9)
10:02 내용 수정 중...
10:03 저장 시도
      → 삭제된 데이터 수정 ❌
```

#### 해결 방안: 삭제 전후 사용구분 확인

```javascript
// DELETE API에서
app.delete('/api/quotations/:date/:no', async (req, res) => {
  const { date: 견적일자, no: 견적번호 } = req.params;

  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // 1. 삭제 전 사용구분 확인
    const check = await new sql.Request(transaction)
      .input('견적일자', sql.VarChar(8), 견적일자)
      .input('견적번호', sql.Real, 견적번호)
      .query(`
        SELECT 사용구분 FROM 견적
        WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호
      `);

    if (check.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '견적서를 찾을 수 없습니다.'
      });
    }

    if (check.recordset[0].사용구분 === 9) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: '이미 삭제된 견적서입니다.',
        code: 'ALREADY_DELETED'
      });
    }

    // 2. Soft Delete 수행
    const result = await new sql.Request(transaction)
      .input('견적일자', sql.VarChar(8), 견적일자)
      .input('견적번호', sql.Real, 견적번호)
      .query(`
        UPDATE 견적
        SET 사용구분 = 9
        WHERE 견적일자 = @견적일자
          AND 견적번호 = @견적번호
          AND 사용구분 = 0
      `);

    // 3. rowsAffected = 0 이면 동시 삭제됨
    if (result.rowsAffected[0] === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: '다른 사용자가 이미 삭제했습니다.',
        code: 'CONCURRENT_DELETE'
      });
    }

    // 4. 견적내역도 삭제
    await new sql.Request(transaction)
      .input('견적일자', sql.VarChar(8), 견적일자)
      .input('견적번호', sql.Real, 견적번호)
      .query(`
        UPDATE 견적내역
        SET 사용구분 = 9
        WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호
      `);

    await transaction.commit();
    res.json({ success: true, message: '견적서가 삭제되었습니다.' });

  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
});
```

**UPDATE API에서도 삭제 확인:**
```javascript
// UPDATE 시작 전
const check = await new sql.Request(transaction)
  .input('견적일자', sql.VarChar(8), 견적일자)
  .input('견적번호', sql.Real, 견적번호)
  .query(`
    SELECT 사용구분 FROM 견적
    WHERE 견적일자 = @견적일자 AND 견적번호 = @견적번호
  `);

if (check.recordset[0].사용구분 === 9) {
  await transaction.rollback();
  return res.status(410).json({
    success: false,
    message: '이 견적서는 이미 삭제되었습니다.',
    code: 'GONE'
  });
}
```

---

## 구현 우선순위

### Phase 1: 자동번호 생성 충돌 방지 (최우선) 🔥

**목표**: VB6와 웹에서 같은 번호 생성 방지

**작업:**
1. 로그 테이블 SELECT 쿼리에 `WITH (UPDLOCK, ROWLOCK)` 추가
2. 적용 대상:
   - POST /api/quotations (견적서 작성)
   - POST /api/orders (발주서 작성)
   - POST /api/transactions (거래명세서 작성)
   - POST /api/purchase-statements (매입전표 작성)

**예상 작업 시간**: 1시간

**테스트 방법**:
```javascript
// 두 개의 브라우저 탭에서 동시에 견적서 작성 시도
// → 다른 번호가 생성되어야 함
```

---

### Phase 2: 수정 충돌 방지 (중요)

**목표**: 동일 레코드 동시 수정 시 데이터 손실 방지

**작업:**
1. 수정일시 또는 버전 기반 낙관적 잠금 구현
2. 적용 대상:
   - PUT /api/quotations/:date/:no
   - PUT /api/orders/:date/:no
   - PUT /api/transactions/:date/:no
   - PUT /api/materials/:code

**예상 작업 시간**: 3-4시간

---

### Phase 3: 삭제 충돌 방지 (권장)

**목표**: 삭제된 데이터 수정 시도 방지

**작업:**
1. DELETE API에 사용구분 이중 확인 로직 추가
2. UPDATE API에 사용구분 검증 로직 추가

**예상 작업 시간**: 2시간

---

## 에러 코드 체계

### HTTP Status Codes

| 코드 | 의미 | 사용 시나리오 |
|------|------|---------------|
| 409 Conflict | 충돌 발생 | 동시 수정, 동시 삭제 |
| 410 Gone | 리소스 삭제됨 | 삭제된 데이터 수정 시도 |
| 423 Locked | 리소스 잠김 | 다른 사용자 수정 중 (미사용) |

### 애플리케이션 에러 코드

```javascript
{
  "CONFLICT": "다른 사용자가 이미 수정했습니다.",
  "ALREADY_DELETED": "이미 삭제된 데이터입니다.",
  "CONCURRENT_DELETE": "다른 사용자가 방금 삭제했습니다.",
  "GONE": "이 데이터는 삭제되었습니다."
}
```

---

## 프론트엔드 가이드

### 충돌 감지 시 사용자 경험

```javascript
// 409 Conflict 처리
if (response.status === 409) {
  const data = await response.json();

  if (data.code === 'CONFLICT') {
    alert('⚠️ 다른 사용자가 이미 수정했습니다.\n\n최신 데이터를 확인하시겠습니까?');
    // 페이지 새로고침 또는 데이터 재조회
    location.reload();
  }

  if (data.code === 'ALREADY_DELETED') {
    alert('ℹ️ 이 데이터는 이미 삭제되었습니다.');
    // 목록으로 이동
    window.location.href = '/quotations';
  }
}

// 410 Gone 처리
if (response.status === 410) {
  alert('ℹ️ 이 데이터는 삭제되어 수정할 수 없습니다.');
  window.location.href = '/quotations';
}
```

---

## 테스트 시나리오

### 1. 자동번호 생성 동시성 테스트

```bash
# 두 개의 터미널에서 동시 실행
curl -X POST http://localhost:3000/api/quotations \
  -H "Content-Type: application/json" \
  -d '{"견적일자":"20251123","매출처코드":"C001",...}'

# 예상 결과: 서로 다른 번호 생성 (예: 1번, 2번)
```

### 2. 동시 수정 충돌 테스트

```javascript
// Browser Tab 1
const quotation = await fetch('/api/quotations/20251123/1').then(r => r.json());
const version1 = quotation.data.버전;

// Browser Tab 2
const quotation2 = await fetch('/api/quotations/20251123/1').then(r => r.json());
const version2 = quotation2.data.버전;  // version1과 동일

// Tab 1에서 먼저 수정
await fetch('/api/quotations/20251123/1', {
  method: 'PUT',
  body: JSON.stringify({ 버전_조회시: version1, 금액: 1000000 })
});
// → 성공

// Tab 2에서 수정 시도
await fetch('/api/quotations/20251123/1', {
  method: 'PUT',
  body: JSON.stringify({ 버전_조회시: version2, 금액: 2000000 })
});
// → 409 Conflict 반환 (버전이 이미 증가했으므로)
```

---

## 요약

### ✅ 구현 완료 시 보장되는 사항

1. **자동번호 중복 생성 불가**: VB6와 웹에서 같은 번호 생성 방지
2. **수정 데이터 손실 방지**: 동시 수정 시 먼저 수정한 내역 보존
3. **삭제 데이터 보호**: 삭제된 데이터 수정 시도 차단
4. **사용자 알림**: 충돌 발생 시 명확한 메시지 제공

### ⚠️ 주의사항

1. **VB6는 수정하지 않음**: 모든 방어 로직은 웹 시스템에만 적용
2. **DB 레벨 잠금 활용**: VB6도 자동으로 혜택 받음 (UPDLOCK)
3. **트랜잭션 필수**: 모든 동시성 제어는 트랜잭션 내에서 수행
4. **성능 모니터링**: 잠금으로 인한 대기 시간 모니터링 필요

### 📋 다음 단계

1. Phase 1 구현 및 테스트
2. 실 사용자 환경에서 모니터링
3. Phase 2, 3 순차 적용
4. 병행 운영 기간 중 이슈 수집 및 개선

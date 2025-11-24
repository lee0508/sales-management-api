# 매입전표 수정 시 회계전표 자동 업데이트 가이드

## 개요

매입전표 수정 시 관련된 모든 회계 데이터가 자동으로 업데이트되는 기능을 구현했습니다.

**구현일**: 2025-11-23

**구현 방식**: 방법 1 (자동 처리) - 매입전표 수정 시 회계전표 및 미지급금 내역 자동 삭제/재생성

## 핵심 개념

### 단일 트랜잭션 처리

매입전표 수정 시 다음 3개 테이블이 **동시에** 업데이트됩니다:

1. **자재입출내역** - 품목별 입고 상세 내역
2. **미지급금내역** - 미지급금 발생 기록
3. **회계전표내역** - 회계 분개 전표

**중요**: 모든 작업은 단일 트랜잭션으로 처리되어 데이터 무결성을 보장합니다.

## API 명세

### PUT /api/purchase-statements/:date/:no

매입전표 수정 및 회계전표 자동 업데이트

**Endpoint**: `PUT /api/purchase-statements/:date/:no`

**Path Parameters**:
- `date` (string, required): 거래일자 (YYYYMMDD 형식, 예: "20251123")
- `no` (number, required): 거래번호 (예: 1)

**Request Body**:
```json
{
  "입출고구분": 1,
  "매입처코드": "00000001",
  "적요": "원자재 매입",
  "details": [
    {
      "자재코드": "0101MOFS105",
      "수량": 100,
      "단가": 5000,
      "적요": "LED 전구"
    },
    {
      "자재코드": "0102WIRE200",
      "수량": 50,
      "단가": 3000,
      "적요": "전선"
    }
  ]
}
```

**필수 필드**:
- `매입처코드` (string) - 매입처 코드 (8자리)
- `details` (array) - 최소 1개 이상의 품목 필요
  - `자재코드` (string) - 분류코드(2) + 세부코드(16~18)
  - `수량` (number) - 입고 수량 (> 0)
  - `단가` (number) - 입고 단가

**Response**:
```json
{
  "success": true,
  "message": "매입전표, 미지급금, 회계전표가 수정되었습니다.",
  "data": {
    "거래일자": "20251123",
    "거래번호": 1,
    "전표번호": "20251123-1",
    "회계전표번호": "20251123001",
    "미지급금지급금액": 550000,
    "총공급가액": 500000,
    "총부가세": 50000
  }
}
```

## 처리 프로세스

### 수정 프로세스 (7단계)

```
PUT /api/purchase-statements/:date/:no
         ↓
┌─────────────────────────────────────────────────┐
│ 🔄 TRANSACTION START                            │
│                                                 │
│ 1️⃣ 기존 자재입출내역 삭제                       │
│    DELETE FROM 자재입출내역                     │
│    WHERE 거래일자 = @거래일자                   │
│      AND 거래번호 = @거래번호                   │
│      AND 입출고구분 = 1 (입고)                  │
│                                                 │
│ 2️⃣ 기존 미지급금내역 삭제                       │
│    DELETE FROM 미지급금내역                     │
│    WHERE 적요 = '매입전표 YYYYMMDD-번호'        │
│                                                 │
│ 3️⃣ 기존 회계전표내역 삭제                       │
│    DELETE FROM 회계전표내역                     │
│    WHERE 전표일자 = @거래일자                   │
│      AND 적요 LIKE '%매입전표 YYYYMMDD-번호%'   │
│         ↓                                       │
│ 4️⃣ 합계금액 계산                                │
│    총공급가액 = SUM(입고수량 × 입고단가)         │
│    총부가세 = SUM(입고수량 × 입고단가 × 0.1)     │
│         ↓                                       │
│ 5️⃣ 새로운 자재입출내역 INSERT                   │
│    각 품목별 입고 기록 생성                      │
│         ↓                                       │
│ 6️⃣ 새로운 미지급금내역 INSERT                   │
│    미지급금지급금액 = 총공급가액 + 총부가세      │
│         ↓                                       │
│ 7️⃣ 새로운 회계전표 생성 (Stored Procedure)      │
│    EXEC sp_매입전표_회계전표_자동생성            │
│                                                 │
│ ✅ TRANSACTION COMMIT                           │
└─────────────────────────────────────────────────┘
```

## 데이터 삭제 전략

### 1. 자재입출내역 삭제

```sql
DELETE FROM 자재입출내역
WHERE 거래일자 = @거래일자
  AND 거래번호 = @거래번호
  AND 입출고구분 = 1  -- 입고 (매입) 건만 삭제
```

**이유**: 거래일자 + 거래번호 + 입출고구분으로 정확히 해당 매입전표만 식별

### 2. 미지급금내역 삭제

```sql
DELETE FROM 미지급금내역
WHERE 사업장코드 = @사업장코드
  AND 매입처코드 = @매입처코드
  AND 적요 = '매입전표 20251123-1'  -- 정확한 적요 매칭
```

**이유**: 적요 필드에 자동 생성 시 입력한 패턴 사용 (매입전표 YYYYMMDD-번호)

### 3. 회계전표내역 삭제

```sql
DELETE FROM 회계전표내역
WHERE 사업장코드 = @사업장코드
  AND 전표일자 = @거래일자
  AND 적요 LIKE '%매입전표 20251123-1%'  -- LIKE 패턴 매칭
```

**이유**: Stored Procedure가 생성한 회계전표의 적요에 매입전표 정보 포함

## 트랜잭션 무결성

### 트랜잭션 구조

```javascript
const transaction = new sql.Transaction(pool);

try {
  await transaction.begin();

  // 1. DELETE operations
  // 2. INSERT operations
  // 3. SP execution

  await transaction.commit();
} catch (err) {
  await transaction.rollback();
  throw err;
}
```

### 보장 사항

1. **원자성 (Atomicity)**: 7개 단계가 모두 성공하거나 모두 실패
2. **일관성 (Consistency)**: 자재입출내역, 미지급금, 회계전표가 항상 동기화
3. **격리성 (Isolation)**: 다른 트랜잭션과 간섭 없음
4. **지속성 (Durability)**: 커밋 후 데이터 영구 저장

## 사용 예시

### cURL 예시

```bash
curl -X PUT http://localhost:3000/api/purchase-statements/20251123/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=<session_id>" \
  -d '{
    "입출고구분": 1,
    "매입처코드": "00000001",
    "적요": "원자재 매입 (수정)",
    "details": [
      {
        "자재코드": "0101MOFS105",
        "수량": 150,
        "단가": 5500,
        "적요": "LED 전구 10W (수량/단가 변경)"
      }
    ]
  }'
```

### JavaScript (fetch) 예시

```javascript
async function updatePurchaseStatement(date, no) {
  const response = await fetch(`/api/purchase-statements/${date}/${no}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      입출고구분: 1,
      매입처코드: '00000001',
      적요: '원자재 매입 (수정)',
      details: [
        {
          자재코드: '0101MOFS105',
          수량: 150,
          단가: 5500,
          적요: 'LED 전구 10W (수량/단가 변경)',
        },
      ],
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('매입전표 수정 완료:', result.data);
    console.log('회계전표번호:', result.data.회계전표번호);
    console.log('미지급금:', result.data.미지급금지급금액.toLocaleString() + '원');
  } else {
    console.error('수정 실패:', result.message);
  }
}
```

## 주의사항

### 1. 필수 필드 누락

**문제**:
```json
{
  "details": [...]
  // 매입처코드 누락!
}
```

**결과**: 400 Bad Request - "매입처코드가 필요합니다."

**해결**: 반드시 `매입처코드` 필드 포함

### 2. 빈 상세내역

**문제**:
```json
{
  "매입처코드": "00000001",
  "details": []  // 빈 배열
}
```

**결과**: 400 Bad Request - "최소 1개 이상의 품목이 필요합니다."

**해결**: 최소 1개 이상의 품목 포함

### 3. 트랜잭션 실패 시

트랜잭션 중 오류 발생 시 **모든 변경사항이 자동 롤백**됩니다.

**로그 예시**:
```
❌ 트랜잭션 롤백 완료
❌ 매입전표 수정 에러: Error: Invalid column name '세부코드'
```

**확인 사항**:
- 자재코드 형식 검증 (4~20자)
- 수량/단가 양수 검증
- 매입처 존재 여부 확인

## 데이터 검증

### 수정 전 데이터 조회

```sql
-- 자재입출내역 확인
SELECT * FROM 자재입출내역
WHERE 거래일자 = '20251123' AND 거래번호 = 1 AND 입출고구분 = 1

-- 미지급금내역 확인
SELECT * FROM 미지급금내역
WHERE 적요 = '매입전표 20251123-1'

-- 회계전표내역 확인
SELECT * FROM 회계전표내역
WHERE 전표일자 = '20251123' AND 적요 LIKE '%매입전표 20251123-1%'
```

### 수정 후 데이터 검증

```sql
-- 총 금액 일치 확인
SELECT
  (SELECT SUM((입고수량 * 입고단가) + 입고부가)
   FROM 자재입출내역
   WHERE 거래일자 = '20251123' AND 거래번호 = 1) AS 자재입출총액,
  (SELECT 미지급금지급금액
   FROM 미지급금내역
   WHERE 적요 = '매입전표 20251123-1') AS 미지급금액
-- 두 값이 동일해야 함
```

## 구현 위치

**파일**: [server.js](../server.js)

**라인**: 6570-6793

**함수**: `app.put('/api/purchase-statements/:date/:no', ...)`

## 관련 문서

- [ACCOUNTS_RECEIVABLE_PAYABLE_GUIDE.md](./ACCOUNTS_RECEIVABLE_PAYABLE_GUIDE.md) - 미수금/미지급금 전체 가이드
- [CLAUDE.md](../CLAUDE.md) - 프로젝트 전체 문서 (매입관리 프로세스 섹션 참조)

## 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2025-11-23 | 매입전표 수정 시 회계전표 자동 업데이트 기능 최초 구현 | Claude Code |
| 2025-11-23 | 트랜잭션 기반 삭제/재생성 로직 구현 | Claude Code |
| 2025-11-23 | 문서 작성 완료 | Claude Code |

## FAQ

### Q1. 매입전표 수정 시 기존 미지급금 지급 기록도 삭제되나요?

**A**: 아니요. **자동 생성된 미지급금 발생 기록만** 삭제됩니다.

삭제 조건:
```sql
WHERE 적요 = '매입전표 20251123-1'
```

회계담당자가 수동으로 입력한 실제 지급 기록(적요가 다름)은 삭제되지 않습니다.

### Q2. 회계전표가 이미 결산 처리된 경우에도 삭제되나요?

**A**: 네, 현재 구현에서는 삭제됩니다.

**권장 사항**:
- 결산 처리된 전표는 수정 불가 처리 (프론트엔드 검증)
- 또는 결산 처리 여부 확인 로직 추가

```javascript
// 향후 개선 예시
const closingCheck = await pool.request()
  .input('전표일자', sql.VarChar(8), 거래일자)
  .query('SELECT 마감여부 FROM 회계마감 WHERE 전표일자 = @전표일자');

if (closingCheck.recordset[0]?.마감여부 === 'Y') {
  return res.status(400).json({
    success: false,
    message: '이미 결산 처리된 전표는 수정할 수 없습니다.',
  });
}
```

### Q3. 수정 중 오류가 발생하면 어떻게 되나요?

**A**: 모든 변경사항이 자동으로 롤백됩니다.

트랜잭션 보장:
- 7개 단계 중 하나라도 실패 시 전체 롤백
- 데이터베이스는 수정 이전 상태로 복원
- 사용자에게 오류 메시지 반환

### Q4. 매입처코드를 변경할 수 있나요?

**A**: 네, 가능합니다.

Request Body에 다른 매입처코드를 입력하면:
1. 기존 매입처의 미지급금 기록 삭제
2. 새로운 매입처로 미지급금 기록 생성

**주의**: 기존 매입처의 미지급금 잔액에 영향을 주므로 신중하게 처리하세요.

## 결론

이 기능은 **매입전표 수정 시 모든 관련 회계 데이터를 자동으로 동기화**하여:

1. ✅ **데이터 무결성 보장** - 트랜잭션 기반 처리
2. ✅ **수동 작업 제거** - 회계담당자가 별도로 수정할 필요 없음
3. ✅ **오류 최소화** - 자동 계산 및 재생성
4. ✅ **일관성 유지** - 자재입출, 미지급금, 회계전표 항상 동기화

향후 개선 사항:
- [ ] 결산 처리 여부 확인 로직 추가
- [ ] 수정 이력 로그 테이블 구현
- [ ] 매입처 변경 시 경고 메시지

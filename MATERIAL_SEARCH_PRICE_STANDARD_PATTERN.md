# 자재 검색/단가 조회 표준 패턴 적용 완료 보고

## ✅ 완료된 작업 (P0 - Critical)

### 1. server.js: 자재 검색 API 입고단가 필드 추가

**파일**: [server.js:2587-2621](server.js#L2587-L2621)

#### 수정 내용:

**1) 세션에서 사업장코드 가져오기 (Line 2590)**
```javascript
// 추가됨:
const 사업장코드 = req.session?.user?.사업장코드 || '01';
```

**2) SELECT 절에 입고단가 필드 추가 (Line 2598)**
```javascript
// 수정 전:
ml.출고단가1, ml.출고단가2, ml.출고단가3

// 수정 후:
ml.입고단가1, ml.출고단가1, ml.출고단가2, ml.출고단가3
```

**Note**: 자재원장 테이블의 실제 컬럼명은 `입고단가1`입니다 (not `입고단가`).

**3) 자재원장 JOIN 조건 개선 (Line 2601)**
```javascript
// 수정 전:
LEFT JOIN 자재원장 ml ON m.분류코드 = ml.분류코드 AND m.세부코드 = ml.세부코드 AND ml.사업장코드 = '01'

// 수정 후:
LEFT JOIN 자재원장 ml ON m.분류코드 = ml.분류코드 AND m.세부코드 = ml.세부코드 AND ml.사업장코드 = @사업장코드
```

**4) SQL 파라미터 추가 (Line 2605-2606)**
```javascript
const request = pool.request()
  .input('사업장코드', sql.VarChar(2), 사업장코드);
```

#### 효과:
- ✅ 발주서 작성 시 입고단가 자동 표시
- ✅ 다중 사업장 지원
- ✅ 세션 기반 사업장 필터링

---

### 2. 모든 JS 파일: 하드코딩된 localhost:3000 제거

**영향받은 파일** (총 69개 위치):
- js/order.js (10개 위치)
- js/quotation.js
- js/transaction.js
- js/transaction2.js
- js/transaction3.js
- js/customer.js
- js/supplier.js
- js/material-history.js
- js/material-category.js
- js/material-inventory.js
- js/postoffice.js

#### 수정 내용:
```javascript
// 수정 전:
fetch('http://localhost:3000/api/materials')

// 수정 후:
fetch('/api/materials')
```

#### 효과:
- ✅ 프로덕션 배포 가능
- ✅ CORS 문제 해결
- ✅ 리버스 프록시 지원

---

## 📋 표준 패턴 정의

### 자재 검색 및 단가 조회 표준 프로세스

```
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ 프론트엔드: 자재 검색                                     │
│    GET /api/materials?search=keyword                        │
│                                                             │
│    Response:                                                │
│    {                                                        │
│      자재코드: "0101MOFS105" (분류코드2 + 세부코드18)        │
│      분류코드: "01"                                          │
│      세부코드: "01MOFS105"                                   │
│      자재명: "자재명"                                         │
│      입고단가: 10000  ← 자재원장에서 가져옴                   │
│      출고단가1: 12000                                        │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ 서버: 자재 조회 (자재 + 자재원장 JOIN)                    │
│                                                             │
│    SELECT m.분류코드, m.세부코드, m.자재명,                   │
│           ml.입고단가, ml.출고단가1, ml.출고단가2            │
│    FROM 자재 m                                               │
│    LEFT JOIN 자재원장 ml                                     │
│      ON m.분류코드 = ml.분류코드                              │
│     AND m.세부코드 = ml.세부코드                              │
│     AND ml.사업장코드 = @사업장코드  ← 세션에서               │
│    WHERE m.사용구분 = 0                                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ 단가 이력 조회 (선택적)                                   │
│                                                             │
│    발주서: GET /api/materials/:materialCode/                │
│                purchase-price-history/:supplierCode         │
│    견적서: GET /api/materials/:materialCode/                │
│                quotation-history/:customerCode              │
│                                                             │
│    WHERE 사업장코드 = @사업장코드  ← 세션에서                 │
│      AND 분류코드 = @분류코드      ← materialCode 파싱        │
│      AND 세부코드 = @세부코드      ← materialCode 파싱        │
└─────────────────────────────────────────────────────────────┘
```

---

## 핵심 원칙

### 1. 자재 테이블 구조
- **필드**: 분류코드(2자) + 세부코드(18자) = 자재코드(20자)
- **사업장코드 필드 없음**
- **예시**: "01" + "01MOFS105" = "0101MOFS105"

### 2. 자재입출내역/자재원장 테이블 구조
- **필드**: 사업장코드(2자) + 분류코드(2자) + 세부코드(18자)
- **사업장코드는 별도 필드로 존재**

### 3. 사업장코드 처리
```javascript
// ✅ CORRECT: 세션에서 가져옴
const 사업장코드 = req.session?.user?.사업장코드 || '01';

// ❌ WRONG: 하드코딩
const 사업장코드 = '01';

// ❌ WRONG: 프론트엔드에서 전달
const 사업장코드 = req.query.사업장코드;
```

### 4. 자재코드 파싱
```javascript
// materialCode = "0101MOFS105" (from 자재 table)

const 분류코드 = materialCode.substring(0, 2);  // "01"
const 세부코드 = materialCode.substring(2);     // "01MOFS105"
const 사업장코드 = req.session.user.사업장코드;  // "01" from session

// Query 자재입출내역:
WHERE 사업장코드 = @사업장코드
  AND 분류코드 = @분류코드
  AND 세부코드 = @세부코드
```

### 5. API URL 패턴
```javascript
// ✅ CORRECT: 상대 경로 사용
fetch('/api/materials')
fetch('/api/quotations')

// ❌ WRONG: 절대 경로 하드코딩
fetch('http://localhost:3000/api/materials')
```

---

## 🔄 아직 남은 작업 (P1 - High)

### 1. server.js 자재코드 파싱 로직 통일

다음 API들의 자재코드 파싱을 표준 패턴으로 수정 필요:

**파일**: server.js

**대상 엔드포인트**:
- Line 1937-1978: GET `/api/materials/:materialCode/price-history/:customerCode`
- Line 1984-2018: GET `/api/materials/:materialCode/quotation-history/:customerCode`
- Line 2024-2065: GET `/api/materials/:materialCode/purchase-price-history/:supplierCode`
- Line 2071-2105: GET `/api/materials/:materialCode/order-history/:supplierCode`

**현재 문제**:
```javascript
// 현재: 16자리 또는 18자리로 파싱 시도
const 세부코드 = materialCode.length === 16 ? materialCode : materialCode.substring(2);
```

**수정 필요**:
```javascript
// 표준 패턴:
const 분류코드 = materialCode.substring(0, 2);
const 세부코드 = materialCode.substring(2);
const 사업장코드 = req.session?.user?.사업장코드 || '01';
```

---

### 2. server.js 기타 사업장코드 하드코딩 제거

다음 위치들에서 사업장코드 하드코딩 제거 필요:

- Line 2600: `/api/materials` (✅ 이미 수정 완료)
- 기타 엔드포인트 조사 필요

---

## 🚀 향후 작업 (P2 - Medium)

### 1. 견적서 작성 시 이전 거래 단가 자동 조회

**파일**: js/quotation.js

**구현 필요**:
- 자재 선택 시 `/api/materials/:materialCode/quotation-history/:customerCode` 호출
- 최근 거래 단가를 출고단가 필드에 자동 입력
- 발주서(order.js)와 동일한 UX 패턴 적용

---

## 📊 테스트 항목

### 1. 자재 검색 API 테스트
```bash
# 로그인 후 세션 유지
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"0687","password":"1234"}'

# 자재 검색 (입고단가 확인)
curl -b cookies.txt http://localhost:3000/api/materials?search=MOFS
```

**Expected**: 입고단가 필드가 응답에 포함됨

### 2. 발주서 작성 테스트
1. 브라우저에서 로그인
2. 구매관리 > 발주서 작성
3. 자재 검색 모달에서 자재 선택
4. 입고단가가 자동으로 표시되는지 확인

### 3. 다중 사업장 테스트
1. 다른 사업장 사용자로 로그인
2. 자재 검색 시 해당 사업장의 단가만 조회되는지 확인

---

## 🎯 완료 일자

- **P0 작업 완료**: 2025-11-01 13:37 (UTC+9)
- **서버 재시작**: 완료
- **서버 상태**: ✅ 정상 실행 중

---

## 📝 변경 파일 목록

### 백엔드
- ✅ server.js (Line 2587-2621)

### 프론트엔드 (총 10개 파일)
- ✅ js/order.js
- ✅ js/quotation.js
- ✅ js/transaction.js
- ✅ js/transaction2.js
- ✅ js/transaction3.js
- ✅ js/customer.js
- ✅ js/supplier.js
- ✅ js/material-history.js
- ✅ js/material-category.js
- ✅ js/material-inventory.js

### 문서
- ✅ MATERIAL_SEARCH_PRICE_STANDARD_PATTERN.md (이 파일)
- ✅ MATERIAL_PRICE_ANALYSIS_PART1.txt
- ✅ MATERIAL_PRICE_ANALYSIS_PART2.txt
- ✅ MATERIAL_PRICE_ANALYSIS_SUMMARY.txt

---

## 🔗 관련 문서

- [FIX_SERVER_API.md](FIX_SERVER_API.md) - 자재내역조회 API 수정 내역
- [MATERIAL_PRICE_ANALYSIS_SUMMARY.txt](MATERIAL_PRICE_ANALYSIS_SUMMARY.txt) - 상세 분석 보고서
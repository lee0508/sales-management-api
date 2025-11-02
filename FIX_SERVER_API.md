# 서버 API 수정 완료 보고

## ✅ 수정 완료된 사항

### 1. server.js의 /api/materials/transaction-history 엔드포인트

#### 수정된 코드 위치: server.js lines 2653-2710

#### 변경 사항:

**1) materialCode 파싱 로직 수정 (lines 2653-2657)**
```javascript
// 수정 전:
const 사업장코드 = materialCode.substring(0, 2);    // "01" (잘못된 로직)
const 분류코드 = materialCode.substring(2, 4);       // "01"
const 세부코드 = materialCode.substring(4);          // "CODE04489"
const 세부코드_with_prefix = 사업장코드 + 세부코드; // "01CODE04489"

// 수정 후:
const 분류코드 = materialCode.substring(0, 2);       // "01"
const 세부코드 = materialCode.substring(2);          // "01MOFS105"
const 사업장코드 = req.session?.user?.사업장코드 || '01';

console.log('📊 파싱된 코드:', { 사업장코드, 분류코드, 세부코드 });
```

**2) WHERE 절 수정 (line 2704)**
```javascript
// 수정 전:
AND (t.세부코드 = @세부코드_with_prefix OR t.세부코드 = @세부코드)

// 수정 후:
AND t.세부코드 = @세부코드
```

**3) SQL 파라미터 수정 (lines 2707-2710)**
```javascript
// 수정 전:
.input('세부코드_with_prefix', sql.VarChar(18), 세부코드_with_prefix)
.input('세부코드', sql.VarChar(18), 세부코드);

// 수정 후:
const request = pool.request()
  .input('사업장코드', sql.VarChar(2), 사업장코드)
  .input('분류코드', sql.VarChar(2), 분류코드)
  .input('세부코드', sql.VarChar(18), 세부코드);
```

### 2. 프론트엔드 수정 (js/material-history.js)

#### 수정된 코드 위치: lines 138, 148

**변경 사항: 하드코딩된 사업장코드 제거**
```javascript
// 수정 전:
const fullMaterialCode = '01' + material.자재코드;
document.getElementById('historySelectedMaterialCode').value = fullMaterialCode;

// 수정 후:
document.getElementById('historySelectedMaterialCode').value = material.자재코드;
```

## 수정 이유

### 올바른 데이터 흐름:

```
1️⃣ 프론트엔드: 자재 테이블에서 검색
   └─ 자재코드 = 분류코드(2) + 세부코드(18)
   └─ 예: "0101MOFS105" = "01" + "01MOFS105"

2️⃣ 프론트엔드 → 서버: materialCode 전달
   └─ materialCode = "0101MOFS105" (자재.분류코드 + 자재.세부코드)

3️⃣ 서버: 코드 파싱
   └─ 분류코드 = materialCode.substring(0, 2) → "01"
   └─ 세부코드 = materialCode.substring(2) → "01MOFS105"
   └─ 사업장코드 = req.session.user.사업장코드 → "01" (로그인 세션에서)

4️⃣ 서버: 자재입출내역 테이블 조회
   └─ WHERE 사업장코드 = '01'
          AND 분류코드 = '01'
          AND 세부코드 = '01MOFS105'
```

### 핵심 원칙:

1. **자재 테이블**: 사업장코드 필드 없음
   - 분류코드(2자) + 세부코드(18자) = 자재코드(20자)

2. **자재입출내역 테이블**: 사업장코드, 분류코드, 세부코드 3개 필드 모두 존재
   - 사업장코드(2자) + 분류코드(2자) + 세부코드(18자)

3. **사업장코드는 로그인 세션에서 가져옴**
   - `req.session.user.사업장코드`
   - 프론트엔드에서 하드코딩하지 않음

4. **세부코드에 "01" 접두사 포함**
   - VB6.0 레거시 버그로 인한 데이터
   - 현재 데이터베이스에 그대로 저장되어 있음
   - "01" 분리하지 않고 그대로 사용

## 테스트 방법

1. 브라우저에서 `http://localhost:3000` 접속
2. 로그인 (사업장코드 세션에 저장됨)
3. 자재관리 > 자재내역조회 메뉴 이동
4. 검색창에 "MOFS105" 또는 자재명 입력
5. 검색 버튼 클릭 또는 Enter
6. 거래내역 DataTable에 결과 표시 확인

## 예상 결과

브라우저 콘솔에 다음과 같은 로그가 표시되어야 함:

```
🔍 [자재내역조회 API] 호출됨
📥 Query params: { materialCode: '0101MOFS105', ... }
📊 파싱된 코드: {
  사업장코드: '01',
  분류코드: '01',
  세부코드: '01MOFS105'
}
```

서버 콘솔에도 동일한 로그 출력됨.

## 완료 일자

2025-11-01 13:23 (UTC+9)
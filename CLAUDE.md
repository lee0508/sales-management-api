# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean-language sales management system with Node.js/Express REST API backend and vanilla HTML/CSS/JavaScript frontend. Connects to Microsoft SQL Server (YmhDB) with Korean table/column names.

## Database Connection

**Technology**: mssql package (node-mssql) v12.0.0
**Server**: MS SQL Server
**Database**: YmhDB
**Connection**: Connection pooling configured in server.js (lines 46-63)

Database credentials are stored in `.env` file (see `.env.template` for setup):
```bash
DB_USER=sa
DB_PASSWORD=your_password
DB_SERVER=localhost
DB_DATABASE=YmhDB
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

Connection pool settings:
- Max connections: 10
- Min connections: 0
- Idle timeout: 30 seconds

## Starting the Server

### Initial Setup
```bash
# Copy environment template
cp .env.template .env

# Edit .env with your database credentials and base path
# Then install dependencies
npm install

# Test database connection
node scripts/test-db.js

# Start server
npm start                    # Starts server on port 3000
```

### Server Configuration

**Environment Variables** (`.env` file):
- `PORT`: Server port (default: 3000)
- `BASE_PATH`: Application base path for deployment (default: `/sales-management-api`)
  - Allows flexible deployment with custom folder names
  - Example values: `/sales-management-api`, `/erp`, `/company-system`

**Access URLs**:
- Web Application: `http://localhost:3000{BASE_PATH}/index.html`
  - Default: `http://localhost:3000/sales-management-api/index.html`
  - Custom: `http://localhost:3000/erp/index.html` (if BASE_PATH=/erp)
- API Endpoints: `http://localhost:3000/api/*` (BASE_PATH does not affect API routes)

**Deployment Example**:
```bash
# Company A deployment
BASE_PATH=/erp-system

# Company B deployment
BASE_PATH=/sales-app

# Development
BASE_PATH=/sales-management-api
```

### Utility Scripts
Located in `/scripts` directory:
- **test-db.js**: Tests database connection and verifies environment setup
- **hash-password.js**: Generates bcrypt hash for a password
  ```bash
  node scripts/hash-password.js "mypassword"
  ```
- **migrate-passwords.js**: Batch migrates plaintext passwords to bcrypt (requires backup first)

## Key Database Schema Patterns

### Korean Table Names (Important)
All database tables and columns use Korean names:
- 사용자 (Users)
- 사업장 (Workplaces)
- 매출처 (Customers/Sales Clients)
- 매입처 (Suppliers/Purchase Vendors)
- 견적 (Quotations) + 견적내역 (Quotation Details)
- 발주 (Purchase Orders) + 발주내역 (Order Details)
- 자재 (Materials) + 자재분류 (Material Categories) + 자재원장 (Material Ledger) + **자재입출내역 (Inventory Transactions - 핵심!)**
- 세금계산서 (Tax Invoices)
- 미수금내역 (Accounts Receivable)
- 미지급금내역 (Accounts Payable)
- 로그 (Log table for auto-incrementing IDs)

### 자재입출내역 Table - 입출고 구분 (CRITICAL!)

**IMPORTANT**: The `자재입출내역` table serves BOTH sales (출고) and purchase (입고) transactions. The `입출고구분` field determines the type:

```sql
-- 자재입출내역 구분
입출고구분 = 1  →  매입전표 (입고/Purchase)
입출고구분 = 2  →  거래명세서 (출고/Sales)
```

| 입출고구분 | 업무 | 거래처 필드 | 수량/단가/부가 | 비고 |
|---------|------|-----------|--------------|------|
| **1** | 매입 (입고) | 매입처코드 | 입고수량, 입고단가, 입고부가 | 공급업체로부터 자재 구매 |
| **2** | 매출 (출고) | 매출처코드 | 출고수량, 출고단가, 출고부가 | 고객에게 자재 판매 |

**Query Examples**:
```sql
-- 매입전표 조회
SELECT * FROM 자재입출내역
WHERE 입출고구분 = 1 AND 거래일자 = '20251001' AND 사용구분 = 0

-- 거래명세서 조회
SELECT * FROM 자재입출내역
WHERE 입출고구분 = 2 AND 거래일자 = '20251001' AND 사용구분 = 0
```

### Master-Detail Pattern
Quotations (견적) and Purchase Orders (발주) follow master-detail architecture:
- **Master table**: Header information (date, number, customer/supplier, totals)
- **Detail table**: Line items (materials, quantities, prices)
- Composite keys: `일자 + 번호` (date + number)

### Soft Delete Pattern
Uses `사용구분` (usage flag) field:
- 0 = active/in-use
- 1 = deleted/inactive

### Auto-Incrementing Numbers (로그 Table)

**IMPORTANT**: The `로그` table is NOT for login logs - it's a **sequence number generator** for document numbering.

#### Purpose:
Manages auto-incrementing sequential numbers for documents (quotations, purchase orders, transactions) on a per-date basis.

#### Table Structure:
```sql
CREATE TABLE 로그 (
  테이블명 VARCHAR(50),      -- Table name: "견적", "발주", "거래명세서"
  베이스코드 VARCHAR(50),     -- Base code: 사업장코드 + 일자 (e.g., "0120251029")
  최종로그 REAL,             -- Last used number for this date
  최종로그1 REAL,            -- Reserved field
  수정일자 VARCHAR(8),       -- Modification date
  사용자코드 VARCHAR(4)      -- User code
)
```

#### How It Works:

1. **Generate Base Code**: `사업장코드 + 일자`
   - Example: "01" + "20251029" = "0120251029"

2. **Query for Last Number**:
   ```sql
   SELECT 최종로그 FROM 로그
   WHERE 테이블명 = '견적' AND 베이스코드 = '0120251029'
   ```

3. **Generate New Number**:
   - If record exists: `새번호 = 최종로그 + 1`
   - If no record: `새번호 = 1`

4. **Update or Insert**:
   ```sql
   -- Update existing
   UPDATE 로그 SET 최종로그 = @새번호
   WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드

   -- Insert new
   INSERT INTO 로그 (테이블명, 베이스코드, 최종로그)
   VALUES (@테이블명, @베이스코드, @새번호)
   ```

#### Example Usage:

**Scenario**: Creating quotation on 2025-10-29
```javascript
// Step 1: Generate base code
const 베이스코드 = '01' + '20251029'; // "0120251029"

// Step 2: Query log table
const result = await query(`
  SELECT 최종로그 FROM 로그
  WHERE 테이블명 = '견적' AND 베이스코드 = '0120251029'
`);

// Step 3: Calculate new number
let 견적번호 = 1;
if (result.length > 0) {
  견적번호 = result[0].최종로그 + 1;
}

// Result: First quotation of the day = 1, second = 2, etc.
```

#### Document Numbering Format:
- **Quotation**: `YYYYMMDD-번호` (e.g., "20251029-1", "20251029-2")
- **Purchase Order**: `YYYYMMDD-번호`
- **Transaction**: `YYYYMMDD-번호`

#### Implementation Locations:
- Quotation creation: server.js lines ~1390-1402
- Purchase order creation: server.js lines ~1991-1998
- Transaction creation: server.js lines ~2982-2989

### Date Format
Dates stored as VARCHAR(8) in YYYYMMDD format (e.g., "20251022")
Timestamps as VARCHAR(17) in YYYYMMDDHHMMSSmmm format

### Material Code Structure (CRITICAL)

**IMPORTANT**: Material codes are stored differently across tables. Understanding this structure is crucial for correct data handling.

#### Table-Specific Storage Patterns:

1. **자재 (Materials) Table**:
   - `분류코드`: 2 characters (category code) - e.g., "01"
   - `세부코드`: 18 characters = **"01" (사업장코드) + actual 세부코드** - e.g., "01MOFS105"
   - **Note**: The 세부코드 field includes the workplace code as a prefix!

2. **자재입출내역 (Inventory Transactions) Table**:
   - `사업장코드`: 2 characters (workplace code) - e.g., "01"
   - `분류코드`: 2 characters (category code) - e.g., "01"
   - `세부코드`: 16 characters (pure detail code) - e.g., "MOFS105"
   - **Note**: Three separate fields

3. **자재시세 (Material Pricing) Table**:
   - `사업장코드`: 2 characters (workplace code)
   - `분류코드`: 2 characters (category code)
   - `세부코드`: 16 characters (pure detail code)
   - **Note**: Three separate fields

4. **자재원장 (Material Ledger) Table**:
   - `사업장코드`: 2 characters (workplace code)
   - `분류코드`: 2 characters (category code)
   - `세부코드`: 16 characters (pure detail code)
   - **Note**: Three separate fields

#### Full Material Code Composition:
When displaying or concatenating material codes:
- **Full code**: `사업장코드 (2) + 분류코드 (2) + 세부코드 (16)` = 20 characters total
- **Example**: "01" + "01" + "MOFS105" = "0101MOFS105"

#### Display Logic:
When showing material codes to users:
- Remove `사업장코드` (first 2 chars)
- Remove `분류코드` (next 2 chars)
- **Display only**: `세부코드` (last 16 chars)
- **Example**: "0101MOFS105" → display "MOFS105"

#### Query Pattern:
When querying from 자재 table:
```sql
-- 자재코드 = 분류코드 + 세부코드
-- BUT 세부코드 already contains 사업장코드!
SELECT (분류코드 + 세부코드) as 자재코드 FROM 자재
-- Returns: "01" + "01MOFS105" = "010101MOFS105" (WRONG!)

-- Correct approach:
-- Remove first 2 chars from 세부코드 before concatenating
SELECT (분류코드 + SUBSTRING(세부코드, 3, 16)) as 자재코드 FROM 자재
-- Returns: "01" + "MOFS105" = "01MOFS105" (CORRECT!)
```

#### Frontend Display:
Always use `substring(4)` to display only the pure detail code:
```javascript
// For full material code: "0101MOFS105"
const displayCode = materialCode.substring(4); // "MOFS105"
```

## Business Process Workflows

### 매출관리 프로세스 (Sales Management Process)

**거래명세서 작성 시 영향받는 테이블:**

```
거래명세서 작성 (POST /api/transactions)
         ↓
┌────────────────────────────────────────────────┐
│ 1️⃣ 자재입출내역 테이블 (✅ 현재 구현됨)         │
│    INSERT with:                                │
│    - 입출고구분 = 2 (출고)                      │
│    - 매출처코드                                 │
│    - 출고수량, 출고단가, 출고부가                │
│    - 거래일자, 거래번호                         │
│                                                │
│    공급가액 = 출고수량 × 출고단가               │
│    부가세 = 출고부가 (10%)                      │
│    합계 = 공급가액 + 부가세                     │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ 2️⃣ 세금계산서 테이블 (❌ TODO - 추후 구현)     │
│    INSERT when status = "확정" or "발행완료":   │
│    - 작성일자 = 거래일자                        │
│    - 매출처코드                                 │
│    - 공급가액 = SUM(출고수량 × 출고단가)        │
│    - 세액 = SUM(출고부가)                      │
│    - 합계금액 = 공급가액 + 세액                 │
│                                                │
│    전자세금계산서 발행 준비                     │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ 3️⃣ 미수금내역 테이블 (❌ TODO - 추후 구현)     │
│    INSERT when status = "확정":                │
│    - 매출처코드                                 │
│    - 미수금발생일자 = 거래일자                  │
│    - 미수금발생금액 = 합계금액                  │
│                                                │
│    이후 입금 처리로 미수금 차감                 │
└────────────────────────────────────────────────┘
```

**Implementation Status:**
- ✅ **Step 1**: 자재입출내역 INSERT implemented (server.js lines 3208-3333)
- ❌ **Step 2**: 세금계산서 generation (장부 테이블 - to be implemented later)
- ❌ **Step 3**: 미수금내역 tracking (to be implemented later)

### 매입관리 프로세스 (Purchase Management Process)

**매입전표 작성 시 영향받는 테이블:**

```
매입전표 작성 (POST /api/purchase-statements)
         ↓
┌────────────────────────────────────────────────┐
│ ✅ AUTOMATIC PROCESS (단일 트랜잭션)            │
│                                                │
│ 1️⃣ 자재입출내역 테이블                         │
│    INSERT with:                                │
│    - 입출고구분 = 1 (입고)                      │
│    - 매입처코드                                 │
│    - 입고수량, 입고단가, 입고부가                │
│    - 거래일자, 거래번호                         │
│                                                │
│    공급가액 = 입고수량 × 입고단가               │
│    부가세 = 입고부가 (10%)                      │
│    합계 = 공급가액 + 부가세                     │
│         ↓                                      │
│         ↓ (자동 계산 후 즉시 실행)              │
│         ↓                                      │
│ 2️⃣ 미지급금내역 테이블                         │
│    AUTO INSERT immediately after:              │
│    - 매입처코드                                 │
│    - 미지급금지급일자 = 거래일자                │
│    - 미지급금지급금액 = SUM(합계금액)           │
│    - 적요 = "매입전표 거래일자-거래번호"        │
│                                                │
│    ⚡ 매입전표 작성 시 자동 생성됨!              │
└────────────────────────────────────────────────┘
```

**Implementation Status:**
- ✅ **Steps 1 & 2**: 자재입출내역 + 미지급금내역 AUTOMATIC insertion (server.js lines 3585-3680)
  - Single API call creates both records
  - 거래일자 기준으로 자동 생성
  - Total amount calculated during inventory insertion
  - Accounts payable generated immediately in same transaction
- ✅ **Additional APIs**: 미지급금내역 management (server.js lines 3787-3941)
  - GET /api/accounts-payable/balance/:supplierCode - 잔액 조회
  - Manual POST /api/accounts-payable also available if needed

**Key Formula:**
```javascript
// 매입전표
총매입액 = SUM(입고수량 × 입고단가 × 1.1) FROM 자재입출내역 WHERE 입출고구분 = 1
총지급액 = SUM(미지급금지급금액) FROM 미지급금내역
미지급잔액 = 총매입액 - 총지급액

// 거래명세서
총매출액 = SUM(출고수량 × 출고단가 × 1.1) FROM 자재입출내역 WHERE 입출고구분 = 2
총입금액 = SUM(미수금입금금액) FROM 미수금내역 (TODO)
미수금잔액 = 총매출액 - 총입금액
```

---

## 장부관리 (Ledger Management) - 향후 개발 예정

### 매입처장부관리 (Supplier Ledger Management)

**목적**: 매입처별 미지급금 현황 및 거래내역 조회

**데이터 구조**:
```
매입처장부관리 화면
         ↓
┌────────────────────────────────────────────────┐
│ 📊 기준 테이블: 미지급금내역                    │
│                                                │
│ SELECT * FROM 미지급금내역                     │
│ WHERE 매입처코드 = @매입처코드                  │
│ ORDER BY 미지급금지급일자 DESC                  │
│                                                │
│ 표시 항목:                                      │
│ - 미지급금지급일자 (거래일자)                   │
│ - 미지급금지급금액 (발생금액)                   │
│ - 결제방법, 만기일자, 어음번호                  │
│ - 적요 (참조: 매입전표 번호)                    │
│ - 누적잔액 계산                                 │
└────────────────────────────────────────────────┘
         ↓ (세부내역 조회 시)
┌────────────────────────────────────────────────┐
│ 📝 세부내역: 자재입출내역 테이블                │
│                                                │
│ SELECT * FROM 자재입출내역                     │
│ WHERE 거래일자 = @거래일자                      │
│   AND 거래번호 = @거래번호                      │
│   AND 입출고구분 = 1                            │
│   AND 매입처코드 = @매입처코드                  │
│                                                │
│ 표시 항목:                                      │
│ - 자재코드, 자재명, 규격, 단위                  │
│ - 입고수량, 입고단가, 입고부가                  │
│ - 공급가액 = 입고수량 × 입고단가                │
│ - 부가세 = 입고부가                             │
└────────────────────────────────────────────────┘
```

**구현 가이드**:
```javascript
// 매입처 장부 조회 API (예정)
GET /api/supplier-ledger/:supplierCode

// Response 구조:
{
  success: true,
  data: {
    매입처코드: "00000001",
    매입처명: "공급업체명",
    총미지급액: 5000000,      // 누적 미지급금
    총지급액: 3000000,        // 누적 지급액
    미지급잔액: 2000000,      // 잔액
    거래내역: [
      {
        미지급금지급일자: "20251029",
        미지급금지급금액: 1000000,
        결제방법: "현금",
        적요: "매입전표 20251029-1",
        // 세부내역 링크
        거래일자: "20251029",
        거래번호: 1
      }
    ]
  }
}

// 세부내역 조회 (기존 API 활용)
GET /api/purchase-statements/:date/:no
```

---

### 매출처장부관리 (Customer Ledger Management)

**목적**: 매출처별 미수금 현황 및 거래내역 조회

**데이터 구조**:
```
매출처장부관리 화면
         ↓
┌────────────────────────────────────────────────┐
│ 📊 기준 테이블: 미수금내역 (TODO - 미구현)      │
│                                                │
│ SELECT * FROM 미수금내역                       │
│ WHERE 매출처코드 = @매출처코드                  │
│ ORDER BY 미수금발생일자 DESC                    │
│                                                │
│ 표시 항목:                                      │
│ - 미수금발생일자 (거래일자)                     │
│ - 미수금발생금액 (발생금액)                     │
│ - 미수금입금일자, 미수금입금금액 (입금처리)     │
│ - 결제방법, 만기일자, 어음번호                  │
│ - 적요 (참조: 거래명세서 번호)                  │
│ - 누적잔액 계산                                 │
└────────────────────────────────────────────────┘
         ↓ (세부내역 조회 시)
┌────────────────────────────────────────────────┐
│ 📝 세부내역: 자재입출내역 테이블                │
│                                                │
│ SELECT * FROM 자재입출내역                     │
│ WHERE 거래일자 = @거래일자                      │
│   AND 거래번호 = @거래번호                      │
│   AND 입출고구분 = 2                            │
│   AND 매출처코드 = @매출처코드                  │
│                                                │
│ 표시 항목:                                      │
│ - 자재코드, 자재명, 규격, 단위                  │
│ - 출고수량, 출고단가, 출고부가                  │
│ - 공급가액 = 출고수량 × 출고단가                │
│ - 부가세 = 출고부가                             │
└────────────────────────────────────────────────┘
```

**구현 가이드**:
```javascript
// 매출처 장부 조회 API (예정)
GET /api/customer-ledger/:customerCode

// Response 구조:
{
  success: true,
  data: {
    매출처코드: "00000001",
    매출처명: "고객사명",
    총매출액: 8000000,        // 누적 매출액
    총입금액: 5000000,        // 누적 입금액
    미수금잔액: 3000000,      // 잔액
    거래내역: [
      {
        미수금발생일자: "20251029",
        미수금발생금액: 1500000,
        미수금입금일자: "20251105",  // NULL if unpaid
        미수금입금금액: 1500000,
        결제방법: "계좌이체",
        적요: "거래명세서 20251029-1",
        // 세부내역 링크
        거래일자: "20251029",
        거래번호: 1
      }
    ]
  }
}

// 세부내역 조회 (기존 API 활용)
GET /api/transactions/:date/:no
```

---

### 장부관리 구현 시 핵심 원칙

1. **기준 테이블 (Master Table)**:
   - 매입처장부: `미지급금내역` 테이블 기준
   - 매출처장부: `미수금내역` 테이블 기준

2. **세부내역 참조 (Detail Reference)**:
   - 양쪽 모두 `자재입출내역` 테이블에서 세부 품목 정보 조회
   - `입출고구분` 필드로 구분:
     - 매입: `입출고구분 = 1` (입고)
     - 매출: `입출고구분 = 2` (출고)

3. **금액 계산 (Amount Calculation)**:
   - 장부 화면에서는 **미지급금/미수금 테이블의 금액**을 표시
   - 세부내역 조회 시 **자재입출내역의 품목별 금액**을 표시
   - 합계 검증: 미지급금/미수금 금액 = SUM(자재입출내역 품목별 금액)

4. **데이터 무결성 (Data Integrity)**:
   - 매입전표 작성 시 → 미지급금내역 자동 생성 (✅ 구현됨)
   - 거래명세서 작성 시 → 미수금내역 자동 생성 (❌ TODO)
   - 삭제 시 연관 데이터 처리 고려 필요

**Implementation Status:**
- ❌ 매입처장부관리 API 및 화면 (TODO)
- ❌ 매출처장부관리 API 및 화면 (TODO)
- ❌ 미수금내역 자동 생성 로직 (TODO)

## API Architecture

### Response Format
All endpoints return standardized JSON:
```javascript
{
  success: boolean,
  message: string,        // Optional
  data: object | array,   // Optional
  total: number          // For list endpoints
}
```

### Pagination (Customers only)
GET `/api/customers` supports pagination:
- Query params: `page`, `pageSize` (default 25)
- Uses ROW_NUMBER() for SQL Server pagination (see server.js lines 207-253)
- Returns: `currentPage`, `totalPages`, `total` in response

### Authentication & Authorization

**IMPORTANT**: Session management and user tracking are critical for:
1. **Audit Trail**: Recording "who" performed each operation (사용자코드, 사용자명)
2. **Access Control**: Restricting API access based on user roles (사용자권한)
3. **Future Permission System**: Menu-based role permissions (메뉴별 권한 관리)

#### Current Implementation (✅ Completed)

**Session Configuration**: [server.js:46-63](server.js#L46-L63)
- Session store: Memory-based (use Redis for production)
- Cookie lifetime: 24 hours
- Session data structure:
  ```javascript
  req.session.user = {
    사용자코드: '0687',
    사용자명: '장준호',
    사용자권한: '99',  // Role code
    사업장코드: '01',
    사업장명: '제이씨엠전기'
  }
  ```

**Login API**: [server.js:151-239](server.js#L151-L239)
- POST `/api/auth/login` - Verifies bcrypt password, creates session
- Updates 사용자 table: `시작일시`, `로그인여부='Y'`
- Returns user info (excluding password)

**Logout API**: [server.js:242-276](server.js#L242-L276)
- POST `/api/auth/logout` - Destroys session
- Updates 사용자 table: `종료일시`, `로그인여부='N'`

**Authentication Middleware**: [server.js:111-119](server.js#L111-L119)
```javascript
function requireAuth(req, res, next)
```
- Ensures user is logged in before API access
- **Currently NOT applied to most endpoints** (security risk)

**Authorization Middleware**: [server.js:125-146](server.js#L125-L146)
```javascript
function requireRole(allowedRoles)
```
- Checks `사용자권한` field for role-based access
- Example: `requireRole(['99', '50'])` allows only 관리자 and 영업관리자

#### User Tracking in Creation APIs (✅ Completed - 2025-10-31)

All creation APIs now return user information in response:

**Quotation Creation**: [server.js:1625-1650](server.js#L1625-L1650)
```javascript
// Response includes:
{ 견적일자, 견적번호, 사용자코드, 사용자명, 매출처코드, 매출처명 }
```

**Order Creation**: [server.js:2328-2353](server.js#L2328-L2353)
```javascript
// Response includes:
{ 발주일자, 발주번호, 사용자코드, 사용자명, 매입처코드, 매입처명 }
```

**Transaction Creation**: [server.js:3318-3344](server.js#L3318-L3344)
```javascript
// Response includes:
{ 거래일자, 거래번호, 사용자코드, 사용자명, 매출처코드, 매출처명 }
```

**Purchase Statement Creation**: [server.js:3691-3718](server.js#L3691-L3718)
```javascript
// Response includes:
{ 거래일자, 거래번호, 사용자코드, 사용자명, 매입처코드, 매입처명, 미지급금지급금액 }
```

#### Known Security Issues (⚠️ To Be Fixed)

1. **Missing Authentication**: Most endpoints lack `requireAuth` middleware
   - Anyone can access APIs without login
   - User code defaults to '8080' when session is missing

2. **No Authorization**: No role-based access control implemented
   - All logged-in users can perform any operation
   - No distinction between 관리자, 영업담당, 구매담당

3. **SQL Injection**: Some endpoints use string interpolation instead of parameterized queries

#### Future Development: Menu-Based Permissions

See [SESSION_AND_PERMISSION_GUIDE.md](SESSION_AND_PERMISSION_GUIDE.md) for detailed implementation plan.

**Planned Role Hierarchy**:
- `99` = 시스템 관리자 (full access)
- `50` = 영업 관리자 (sales management)
- `40` = 구매 관리자 (purchase management)
- `30` = 영업 담당 (sales operations)
- `20` = 구매 담당 (purchase operations)
- `10` = 일반 사용자 (read-only)

**Implementation Priority**:
1. **Phase 1** (Immediate): Apply `requireAuth` to all write operations
2. **Phase 2** (Next): Apply `requireRole` to sensitive operations
3. **Phase 3** (Future): Row-level security, audit logs, permission UI

### Main Endpoint Groups

**Authentication**: `/api/auth/*`
- POST `/api/auth/login` - Login
- POST `/api/auth/logout` - Logout

**Workplaces**: `/api/workplaces`
- GET `/api/workplaces` - List all
- GET `/api/workplaces/:code` - Get by code

**Customers (매출처)**: `/api/customers`
- GET `/api/customers` - List with pagination & search
- GET `/api/customers/:code` - Get detail
- POST `/api/customers` - Create
- PUT `/api/customers/:code` - Update
- DELETE `/api/customers/:code` - Hard delete

**Suppliers (매입처)**: `/api/suppliers`
- Same CRUD pattern as customers

**Quotations (견적)**: `/api/quotations`
- GET `/api/quotations` - List (filterable by 상태코드, date range)
- GET `/api/quotations/:date/:no` - Get master + detail
- POST `/api/quotations` - Create with details (transactional)

**Purchase Orders (발주)**: `/api/orders`
- GET `/api/orders` - List
- GET `/api/orders/:date/:no` - Get master + detail

**Materials (자재)**: `/api/materials`
- GET `/api/materials` - List
- GET `/api/materials/:code` - Get with ledger info
- POST `/api/materials` - Create
- PUT `/api/materials/:code` - Update
- DELETE `/api/materials/:code` - Soft delete (사용구분=1)

**Material Categories**: `/api/material-categories`
- GET `/api/material-categories` - List active categories

**Inventory**: `/api/inventory/:workplace`
- GET `/api/inventory/:workplace` - Aggregate stock by workplace

**Dashboard**: `/api/dashboard/stats`
- GET `/api/dashboard/stats?사업장코드=01` - Sales & inventory stats

**Transactions (거래명세서)**: `/api/transactions`
- GET `/api/transactions` - List transaction statements (from 자재입출내역 table)
- GET `/api/transactions/:date/:no` - Get by date & number (composite key: 거래일자 + 거래번호)
- GET `/api/transactions/price-history` - Pricing history lookup
- POST `/api/transactions` - Create transaction statement
- PUT `/api/transactions/:date/:no` - Update
- DELETE `/api/transactions/:date/:no` - Delete

**Material History**: `/api/materials/*`
- GET `/api/materials/:materialCode/purchase-price-history/:supplierCode` - Last 10 input price records from inventory transactions
- GET `/api/materials/:materialCode/order-history/:supplierCode` - Last 10 purchase order records for material/supplier pair

## SQL Query Patterns

### Safe Pattern (Parameterized Queries)
Always use parameterized queries to prevent SQL injection:
```javascript
await pool.request()
  .input('매출처코드', sql.VarChar(8), code)
  .input('사업장코드', sql.VarChar(2), workplaceCode)
  .query('SELECT * FROM 매출처 WHERE 매출처코드 = @매출처코드 AND 사업장코드 = @사업장코드')
```

### Unsafe Pattern (AVOID)
String interpolation creates SQL injection vulnerabilities:
```javascript
query += ` AND 사업장코드 = '${사업장코드}'`  // VULNERABLE - Do not use!
```

### Known Vulnerable Endpoints
Several endpoints still use string interpolation and need to be fixed:
- Supplier search endpoints
- Some quotation/order list filters
- When fixing, convert all dynamic values to `.input()` parameters

## Frontend Architecture

Single-page application (SPA) in `index.html` (~5,800 lines):
- **Framework**: Vanilla JavaScript + jQuery 3.7.1
- **UI Library**: DataTables for tabular data display
- **External APIs**: Daum PostCode API for Korean address lookup
- **Styling**: Single CSS file (`css/onstyles.css`)

### Frontend File Structure
```
js/
├── jquery-3.7.1.min.js      (jQuery library)
├── dataTableInit.js         (DataTable helper wrapper)
├── customer.js              (Customer management logic)
├── supplier.js              (Supplier management logic)
├── quotation.js             (Quotation management - 2,787 lines)
├── order.js                 (Purchase order management - 2,798 lines)
├── transaction.js           (Transaction statement logic)
├── transaction2.js          (Alternate version - not in use)
├── transaction3.js          (Alternate version - not in use)
└── postoffice.js            (Postal code API integration)
```

### Page Routing
- Page switching via `showPage(pageName)` function
- `pageMap` object defines routes with:
  - `element`: HTML element ID
  - `title`: Page title
  - `menu`: Parent menu section
  - `loadFunc`: Optional data loading function
- Login page transitions to dashboard on successful authentication
- Sidebar menu with collapsible sections

### Modular JavaScript Files
Complex features are extracted to separate files in `/js`:
- **dataTableInit.js**: Reusable wrapper for DataTable initialization with Korean localization
- **customer.js**: Customer management - DataTable setup, CRUD event handlers
- **supplier.js**: Supplier management - similar pattern to customer.js
- **quotation.js**: Quotation management - complex form handling, line item management, master-detail operations
- **order.js**: Purchase order management - draggable modals, material selection with price history lookup, explicit selection buttons
- **transaction.js**: Transaction statement management - DataTable implementation with date/status filtering, CSV export, modal detail view
- **postoffice.js**: Daum PostCode API integration for address lookup

These files are loaded via `<script>` tags and depend on jQuery and DataTables being available.

### Recent UI Patterns
- **Material Selection**: Explicit "선택" (Select) button pattern instead of row clicks for better UX
- **Price History Integration**: Material search results include purchase unit price, auto-populate input/output prices
- **DataTable Filtering**: Date range and status filtering with toolbar controls
- **Draggable Modals**: Some modals support drag functionality for better positioning
- **CSV Export**: Export to Google Sheets functionality for transaction statements

### JavaScript Function Naming Conventions

**IMPORTANT**: Follow these naming rules consistently across all modules to distinguish between create/edit operations:

#### Create/New Operations
Functions for creating new records or opening creation modals:
- **Pattern**: `open` + EntityName + `Modal` or `new` + EntityName
- **Examples**:
  - Quotations: `openQuotationModal()` - Opens modal for creating new quotation
  - Orders: `openOrderModal()` - Opens modal for creating new purchase order
  - Transactions: `openTransactionModal()` - Opens modal for creating new transaction
  - Customers: `openCustomerModal()` or `newCustomer()` - Opens modal for new customer registration

- **Related variables**: Use `new` prefix for data arrays
  - `newQuotationDetails[]` - Array of line items for new quotation
  - `newOrderDetails[]` - Array of line items for new order
  - `newTransactionItems[]` - Array of items for new transaction

#### Edit/Update Operations
Functions for editing existing records:
- **Pattern**: `edit` + EntityName
- **Examples**:
  - Quotations: `editQuotation(date, no)` - Opens modal to edit existing quotation
  - Orders: `editOrder(date, no)` - Opens modal to edit existing order
  - Transactions: `editTransaction(date, no)` - Opens modal to edit existing transaction
  - Customers: `editCustomer(code)` - Opens modal to edit existing customer

#### Delete Operations
Functions for deleting records:
- **Pattern**: `delete` + EntityName
- **Examples**:
  - Quotations: `deleteQuotation(date, no)`
  - Orders: `deleteOrder(date, no)`
  - Transactions: `deleteTransaction(date, no)`

#### View/Detail Operations
Functions for viewing record details (read-only):
- **Pattern**: `open` + EntityName + `DetailModal` or `view` + EntityName
- **Examples**:
  - `openQuotationDetailModal(date, no)` - View quotation details
  - `openTransactionDetailModal(transactionNo)` - View transaction details

**Why This Matters**: Clear naming prevents confusion between creating new records vs editing existing ones, especially important in Korean UI where buttons may say "작성" (create) vs "수정" (edit).

## Critical Frontend Development Rules

### 1. Unique IDs and Classes for Each Page/Module

**CRITICAL**: When working in a Single Page Application (SPA) where multiple pages coexist in the same HTML document, **always use unique IDs and class names** with page-specific prefixes to prevent conflicts.

#### ID Naming Convention
```javascript
// ❌ BAD - Generic IDs that conflict across pages
<div id="actions-20251030_1">         // Used in multiple pages!
<div id="editModal">                   // Conflicts everywhere!
<button id="saveBtn">                  // Which page's save button?

// ✅ GOOD - Page-specific prefixed IDs
<div id="quotation-actions-20251030_1">      // Quotation page
<div id="transaction-actions-20251030_1">    // Transaction page
<div id="order-actions-20251030_1">          // Order page

<div id="quotationEditModal">                // Quotation edit modal
<div id="transactionEditModal">              // Transaction edit modal

<button id="quotationSaveBtn">               // Quotation save
<button id="transactionSaveBtn">             // Transaction save
```

#### Class Naming Convention
Use BEM (Block Element Modifier) pattern with page prefix:
```javascript
// ✅ GOOD - Scoped class names
.quotation-checkbox       // Quotation page checkboxes
.transaction-checkbox     // Transaction page checkboxes
.order-checkbox          // Order page checkboxes

.quotation-detail-row    // Quotation detail rows
.transaction-detail-row  // Transaction detail rows
```

#### Modal ID Convention
All modals must have unique, page-specific IDs:
```javascript
// ✅ Modal IDs
#quotationEditModal
#quotationDeleteModal
#quotationDetailModal
#transactionEditModal
#transactionDeleteModal
#transactionDetailModal
#orderEditModal
#orderDeleteModal
```

#### Real-World Example from This Project
**Problem**: Quotation management and Transaction management both used `id="actions-20251030_1"`, causing jQuery to always target the first match (quotation's buttons) even when clicking transaction checkboxes.

**Solution**: Changed transaction IDs to `id="transaction-actions-20251030_1"`.

**Lesson**: In SPA environments, generic IDs like `actions-*`, `editModal`, `deleteBtn` will cause conflicts. Always prefix with page/module name.

### 2. DataTable Display Order for Material/Item Lists

**CRITICAL**: When displaying material/item lists in DataTables, especially in create/edit modals for documents (quotations, orders, transactions), **always preserve input order**.

#### Where This Applies
- **Sales Management (매출관리)**:
  - Quotation creation/edit (`견적서작성`, `견적 수정`)
  - Transaction statement creation/edit (`거래명세서 신규등록`, `거래명세서 수정`)

- **Purchase Management (매입관리)**:
  - Purchase order creation/edit (`발주서작성`, `발주 수정`)
  - Purchase statement creation/edit (`매입전표 신규등록`, `매입전표 수정`)

#### Implementation Rule
```javascript
// ✅ CORRECT - Preserve input order (no initial sorting)
$('#materialTable').DataTable({
  data: materials,
  order: [],  // Empty array = no initial sort, preserve input order
  columns: [...]
});

// ❌ WRONG - Sorting by row number changes input order
$('#materialTable').DataTable({
  data: materials,
  order: [[0, 'asc']],  // Sorts by first column (row number)
  columns: [...]
});

// ❌ WRONG - Sorting by any column changes input order
$('#materialTable').DataTable({
  data: materials,
  order: [[2, 'asc']],  // Sorts by material code
  columns: [...]
});
```

#### Why Input Order Matters
1. **User Intent**: Users add materials in a specific sequence that has business meaning (e.g., grouping related items, order of importance)
2. **Document Consistency**: When viewing/printing documents, items should appear in the order they were entered
3. **Data Integrity**: Input order often reflects logical flow or priority that shouldn't be arbitrarily changed by UI sorting

#### Where Sorting IS Allowed
Sorting is appropriate for:
- Master lists (customer list, supplier list, material catalog)
- Search results
- Report views
- But NOT for:
  - Document line items during creation/editing
  - Detail views showing "what was entered"

#### Example Locations in This Project
```javascript
// transaction.js - Transaction detail modal (line ~310)
window.transactionDetailTableInstance = $('#transactionDetailTable').DataTable({
  data: details,
  order: [],  // ✅ Preserve input order
  ...
});

// quotation.js - Quotation detail edit table
$('#quotationEditDetailTable').DataTable({
  data: quotationDetails,
  order: [],  // ✅ Preserve input order
  ...
});

// order.js - Order detail table
$('#orderDetailTable').DataTable({
  data: orderDetails,
  order: [],  // ✅ Preserve input order
  ...
});
```

#### Summary
**Rule**: For any DataTable displaying materials/items in document creation or editing contexts (quotations, orders, transactions), always use `order: []` to preserve input order.

## Code Organization Notes

### Backend
- **server.js** (~2,964 lines): Monolithic - all routes, controllers, and database logic in one file
- **server2.js**: Alternate version with MySQL compatibility (not in use)
- No modularization (no routes/, controllers/, models/ directories)
- Environment variables configured via `.env` file (dotenv package)
- No test files or testing framework
- No build process or transpilation

### Frontend
- **index.html** (~5,826 lines): Single-file SPA with all pages and logic
- **index2.html, index_copy.html, index_update.html**: Alternate/backup versions (not in use)
- Separate JavaScript files in `/js` for specific features
- No module bundler (no webpack/rollup)
- No transpilation or minification

### Dependencies
```json
{
  "express": "^5.1.0",           // Web framework
  "mssql": "^12.0.0",            // SQL Server driver
  "bcrypt": "^6.0.0",            // Password hashing
  "express-session": "^1.18.2",  // Session management
  "cors": "^2.8.5",              // CORS handling
  "dotenv": "^17.2.3",           // Environment config
  "mysql": "^2.18.1"             // Unused (legacy)
}
```

## Common Development Tasks

### Adding a new entity endpoint
1. **Backend** (in server.js):
   - Define routes following CRUD pattern (GET list, GET :id, POST, PUT, DELETE)
   - Use parameterized queries with `.input()` to prevent SQL injection
   - Follow standardized response format: `{ success, message?, data?, total? }`

2. **Frontend** (in index.html):
   - Add page HTML in main content area with unique ID
   - Add menu item in sidebar navigation
   - Register page in `pageMap` object
   - Create load function if needed
   - Consider extracting complex logic to separate JS file in `/js` directory

3. **Optional**: Create separate JavaScript file for complex logic (like quotation.js, order.js)

### Working with Master-Detail Tables
When working with entities like quotations or purchase orders:
1. Use transactions for atomic insert/update of master + details
2. Composite key pattern: `일자 + 번호` (date + number)
3. Use `로그` table to generate sequential numbers
4. Frontend typically uses modal for adding/editing detail line items

### Testing Database Connection
```bash
node scripts/test-db.js
```

### Testing API Endpoints
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"0001","password":"1234"}'

# Get customers with pagination
curl "http://localhost:3000/api/customers?page=1&pageSize=25"
```

## Security Considerations

### Current Security Measures
- Database credentials stored in `.env` file (not in code)
- Bcrypt password hashing implemented (with legacy plaintext support)
- CORS configured with allowed origins (via `ALLOWED_ORIGINS` env var)
- Session-based authentication with 24-hour expiry
- Authentication middleware available: `requireAuth()`, `requireRole()`

### Known Security Issues (Priority Order)
1. **CRITICAL**: SQL injection vulnerabilities in some endpoints (use string interpolation instead of parameterized queries)
2. **HIGH**: Authentication middleware not applied to most routes - endpoints are publicly accessible
3. **HIGH**: No input validation middleware (express-validator)
4. **MEDIUM**: No rate limiting on authentication endpoints
5. **MEDIUM**: Some legacy passwords still in plaintext (use migration script)
6. **LOW**: No request size limits configured

## Performance Considerations

- Connection pooling configured (max: 10, min: 0)
- No caching layer present
- Large result sets not paginated except customers endpoint
- Consider adding indexes on frequently queried columns (사업장코드, 매출처코드, etc.)

## Browser Compatibility

Frontend uses modern JavaScript:
- Arrow functions
- Template literals
- Async/await
- Fetch API

Requires modern browser (Chrome/Firefox/Edge current versions).

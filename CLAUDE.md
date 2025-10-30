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

# Edit .env with your database credentials
# Then install dependencies
npm install

# Test database connection
node scripts/test-db.js

# Start server
npm start                    # Starts server on port 3000
```

Server runs on `http://localhost:3000`

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
- 자재 (Materials) + 자재분류 (Material Categories) + 자재원장 (Material Ledger) + 자재입출내역 (Inventory Transactions)
- 로그 (Log table for auto-incrementing IDs)

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

### Authentication
Session-based authentication with bcrypt password hashing:
- POST `/api/auth/login` - Verifies password with bcrypt, sets `시작일시`, `로그인여부='Y'`
- POST `/api/auth/logout` - Sets `종료일시`, `로그인여부='N'`
- Middleware available: `requireAuth()`, `requireRole(roleCode)` (defined but not widely used)
- Supports both bcrypt hashed and legacy plaintext passwords during migration
- Session cookie expires after 24 hours

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

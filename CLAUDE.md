# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean-language sales management system with Node.js/Express REST API backend and vanilla HTML/CSS/JavaScript frontend. Connects to Microsoft SQL Server (YmhDB) with Korean table/column names.

## Database Connection

**Technology**: mssql package (node-mssql)
**Server**: MS SQL Server (localhost)
**Database**: YmhDB
**Connection**: Connection pooling configured in server.js lines 14-30

The database credentials are hardcoded in server.js:
- User: `sa`
- Password: `Dlehdgus0508@1` (WARNING: This should be moved to .env file)

## Starting the Server

```bash
npm start                    # Starts server on port 3000
node server.js              # Alternative method
```

Server runs on `http://localhost:3000`

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

### Auto-Incrementing Numbers
The `로그` table manages sequential numbering:
- Stores last used number per table/date combination
- Fields: `테이블명`, `베이스코드`, `최종로그`
- See quotation creation in server.js lines 846-949

### Date Format
Dates stored as VARCHAR(8) in YYYYMMDD format (e.g., "20251022")
Timestamps as VARCHAR(17) in YYYYMMDDHHMMSSmmm format

### Material Code Structure
Materials use composite key: `분류코드` (2 chars) + `세부코드` (16 chars)
Concatenated in queries as `(분류코드 + 세부코드)` or `CONCAT(분류코드, 세부코드)`

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
Simple session-based auth (no JWT yet, see TODO at line 106):
- POST `/api/auth/login` - Sets `시작일시`, `로그인여부='Y'`
- POST `/api/auth/logout` - Sets `종료일시`, `로그인여부='N'`
- No middleware protection on routes (security gap)

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

## SQL Injection Vulnerability

**CRITICAL**: Many queries use string interpolation instead of parameterized queries:
- Lines 217-218, 236-237: Customer search vulnerable
- Lines 532-537: Supplier search vulnerable
- Similar issues in quotations/orders list endpoints

**Good pattern** (parameterized):
```javascript
await pool.request()
  .input('매출처코드', sql.VarChar(8), code)
  .query('SELECT * FROM 매출처 WHERE 매출처코드 = @매출처코드')
```

**Bad pattern** (vulnerable):
```javascript
query += ` AND 사업장코드 = '${사업장코드}'`  // SQL injection risk
```

When fixing security issues, convert all string interpolation to `.input()` parameters.

## Frontend Architecture

Single-page application (SPA) in `index.html`:
- Vanilla JavaScript (no framework)
- Page switching via `showPage()` function
- API calls through `apiCall()` helper (lines 1109-1165)
- Korean UI labels throughout
- Login page transitions to dashboard on successful auth

## Code Organization Notes

- **server.js** (1428 lines): Monolithic - all routes, no separation of concerns
- **server2.js**: Appears to be alternate/test version with CONCAT syntax changes for MySQL compatibility
- No modularization (routes, controllers, models in one file)
- No environment variables (.env) - credentials hardcoded
- No test files found
- No build process or transpilation

## Common Development Tasks

### Adding a new entity endpoint
1. Define routes in server.js following the CRUD pattern (GET list, GET :id, POST, PUT, DELETE)
2. Use parameterized queries with `.input()` to prevent SQL injection
3. Update frontend index.html with new page content
4. Add menu item and page switching logic
5. Create load function and wire to `showPage()` in pageMap

### Debugging database queries
```javascript
console.error('Error details:', err);  // Already present in catch blocks
```

### Testing API endpoints
Use tools like Postman or curl:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"0001","password":"1234"}'
```

## Security Improvements Needed

1. Move database credentials to `.env` file
2. Implement JWT or session middleware for route protection
3. Fix all SQL injection vulnerabilities (use parameterized queries)
4. Add input validation middleware (express-validator)
5. Implement CORS restrictions (currently accepts all origins: `origin: '*'`)
6. Hash passwords (currently stored in plain text)
7. Add rate limiting on auth endpoints

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

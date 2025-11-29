/**
 * server.js 파일을 메뉴별로 재구성하는 스크립트
 *
 * 실행: node scripts/reorganize-server.js
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'server.251128.js');
const outputFile = path.join(__dirname, '..', 'server.js');

console.log('📋 server.js 재구성 시작...');
console.log(`입력 파일: ${inputFile}`);
console.log(`출력 파일: ${outputFile}`);

// 원본 파일 읽기
const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

console.log(`✅ 총 ${lines.length}줄 읽음`);

// 섹션별로 코드 블록 추출
const sections = {
  header: [],          // 상단 설정 (1-220)
  auth: [],           // 인증/사용자 (223-480)
  workplaces: [],     // 사업장 (485-535)
  customers: [],      // 매출처 (537-965)
  suppliers: [],      // 매입처 (969-1675)
  accounts: [],       // 계정과목 (1676-1895)
  quotations: [],     // 견적서 (1896-2625)
  orders: [],         // 발주서 (2626-3120)
  materials: [],      // 자재 관리 (3123-4270)
  transactions: [],   // 거래명세서 (4271-5520)
  taxInvoices: [],    // 세금계산서 (5522-6305)
  purchaseStatements: [], // 매입전표 (6308-7005)
  accountsPayable: [], // 미지급금 (7009-7173)
  accountsReceivable: [], // 미수금 (7175-7350)
  dashboard: [],      // 대시보드 (7354-7475)
  dailyReport: [],    // 일일보고서 (7478-7640)
  accountCategories: [], // 계정분류 (7641-7665)
  cashHistory: [],    // 현금출납 (7667-8025)
  footer: []          // 서버 시작 (나머지)
};

// 라인별로 섹션 분류
function classifyLine(lineNum) {
  if (lineNum < 220) return 'header';
  if (lineNum >= 223 && lineNum < 480) return 'auth';
  if (lineNum >= 485 && lineNum < 535) return 'workplaces';
  if (lineNum >= 537 && lineNum < 965) return 'customers';
  if (lineNum >= 969 && lineNum < 1675) return 'suppliers';
  if (lineNum >= 1676 && lineNum < 1895) return 'accounts';
  if (lineNum >= 1896 && lineNum < 2625) return 'quotations';
  if (lineNum >= 2626 && lineNum < 3120) return 'orders';
  if (lineNum >= 3123 && lineNum < 4270) return 'materials';
  if (lineNum >= 4271 && lineNum < 5520) return 'transactions';
  if (lineNum >= 5522 && lineNum < 6305) return 'taxInvoices';
  if (lineNum >= 6308 && lineNum < 7005) return 'purchaseStatements';
  if (lineNum >= 7009 && lineNum < 7173) return 'accountsPayable';
  if (lineNum >= 7175 && lineNum < 7350) return 'accountsReceivable';
  if (lineNum >= 7354 && lineNum < 7475) return 'dashboard';
  if (lineNum >= 7478 && lineNum < 7640) return 'dailyReport';
  if (lineNum >= 7641 && lineNum < 7665) return 'accountCategories';
  if (lineNum >= 7667 && lineNum < 8025) return 'cashHistory';
  return 'footer';
}

// 라인 분류
lines.forEach((line, index) => {
  const section = classifyLine(index);
  sections[section].push(line);
});

console.log('✅ 섹션별 분류 완료:');
Object.keys(sections).forEach(key => {
  console.log(`  - ${key}: ${sections[key].length}줄`);
});

// 재구성된 파일 생성
const output = [];

// =============================================================================
// 헤더 (설정 및 초기화)
// =============================================================================
output.push('// =============================================================================');
output.push('// Sales Management API Server');
output.push('// =============================================================================');
output.push('// 파일 구조:');
output.push('// 1. 설정 및 초기화');
output.push('// 2. 인증/사용자 관리');
output.push('// 3. 기준정보 관리 (사업장, 매출처, 매입처, 계정과목)');
output.push('// 4. 매출 관리 (견적서, 거래명세서, 세금계산서)');
output.push('// 5. 매입 관리 (발주서, 매입전표)');
output.push('// 6. 자재 관리');
output.push('// 7. 회계 관리 (현금출납장)');
output.push('// 8. 장부 관리 (미지급금, 미수금)');
output.push('// 9. 대시보드/리포트');
output.push('// =============================================================================');
output.push('');
output.push(...sections.header);
output.push('');

// =============================================================================
// 2. 인증/사용자 관리
// =============================================================================
output.push('// =============================================================================');
output.push('// 2. 인증/사용자 관리');
output.push('// =============================================================================');
output.push('// - POST   /api/auth/login         : 로그인');
output.push('// - POST   /api/auth/logout        : 로그아웃');
output.push('// - GET    /api/auth/me            : 현재 사용자 정보');
output.push('// - POST   /api/auth/heartbeat     : 세션 유지');
output.push('// - POST   /api/auth/force-logout  : 강제 로그아웃');
output.push('// =============================================================================');
output.push('');
output.push(...sections.auth);
output.push('');

// =============================================================================
// 3. 기준정보 관리
// =============================================================================
output.push('// =============================================================================');
output.push('// 3. 기준정보 관리');
output.push('// =============================================================================');
output.push('');

// 3.1 사업장
output.push('// -----------------------------------------------------------------------------');
output.push('// 3.1 사업장 관리');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/workplaces         : 사업장 목록 조회');
output.push('// - GET    /api/workplaces/:code   : 사업장 상세 조회');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.workplaces);
output.push('');

// 3.2 매출처
output.push('// -----------------------------------------------------------------------------');
output.push('// 3.2 매출처 관리 (고객)');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/customers          : 매출처 목록 (페이지네이션)');
output.push('// - GET    /api/customers/:code    : 매출처 상세 조회');
output.push('// - POST   /api/customers          : 매출처 신규 등록');
output.push('// - PUT    /api/customers/:code    : 매출처 수정');
output.push('// - DELETE /api/customers/:code    : 매출처 삭제');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.customers);
output.push('');

// 3.3 매입처
output.push('// -----------------------------------------------------------------------------');
output.push('// 3.3 매입처 관리 (공급업체)');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/suppliers          : 매입처 목록 조회');
output.push('// - GET    /api/suppliers/:code    : 매입처 상세 조회');
output.push('// - POST   /api/suppliers          : 매입처 신규 등록');
output.push('// - PUT    /api/suppliers/:code    : 매입처 수정');
output.push('// - DELETE /api/suppliers/:code    : 매입처 소프트 삭제');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.suppliers);
output.push('');

// 3.4 계정과목
output.push('// -----------------------------------------------------------------------------');
output.push('// 3.4 계정과목 관리');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/accounts           : 계정과목 목록 조회');
output.push('// - GET    /api/accounts/:code     : 계정과목 상세 조회');
output.push('// - POST   /api/accounts           : 계정과목 신규 등록');
output.push('// - PUT    /api/accounts/:code     : 계정과목 수정');
output.push('// - DELETE /api/accounts/:code     : 계정과목 소프트 삭제');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.accounts);
output.push('');

// =============================================================================
// 4. 매출 관리
// =============================================================================
output.push('// =============================================================================');
output.push('// 4. 매출 관리');
output.push('// =============================================================================');
output.push('');

// 4.1 견적서
output.push('// -----------------------------------------------------------------------------');
output.push('// 4.1 견적서 관리');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/quotations                     : 견적서 목록 조회');
output.push('// - GET    /api/quotations/:date/:no           : 견적서 상세 조회');
output.push('// - POST   /api/quotations_add                 : 견적서 신규 작성');
output.push('// - PUT    /api/quotations/:date/:no           : 견적서 수정');
output.push('// - PUT    /api/quotations/:date/:no/approve   : 견적서 승인');
output.push('// - DELETE /api/quotations/:date/:no           : 견적서 삭제');
output.push('// - GET    /api/quotations/:date/:no/print     : 견적서 인쇄');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.quotations);
output.push('');

// 4.2 거래명세서
output.push('// -----------------------------------------------------------------------------');
output.push('// 4.2 거래명세서 관리 (매출)');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/transactions                   : 거래명세서 목록 조회');
output.push('// - GET    /api/transactions/:date/:no         : 거래명세서 상세 조회');
output.push('// - POST   /api/transactions                   : 거래명세서 신규 작성');
output.push('// - PUT    /api/transactions/:date/:no         : 거래명세서 수정');
output.push('// - DELETE /api/transactions/:date/:no         : 거래명세서 삭제');
output.push('// - GET    /api/transactions/:date/:no/print   : 거래명세서 인쇄');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.transactions);
output.push('');

// 4.3 세금계산서
output.push('// -----------------------------------------------------------------------------');
output.push('// 4.3 세금계산서 관리');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/tax-invoices       : 세금계산서 목록 조회');
output.push('// - POST   /api/tax-invoices       : 세금계산서 신규 발행');
output.push('// - GET    /api/tax-invoices/...   : 세금계산서 상세 조회');
output.push('// - PUT    /api/tax-invoices/...   : 세금계산서 수정');
output.push('// - DELETE /api/tax-invoices/...   : 세금계산서 삭제');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.taxInvoices);
output.push('');

// =============================================================================
// 5. 매입 관리
// =============================================================================
output.push('// =============================================================================');
output.push('// 5. 매입 관리');
output.push('// =============================================================================');
output.push('');

// 5.1 발주서
output.push('// -----------------------------------------------------------------------------');
output.push('// 5.1 발주서 관리');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/orders                 : 발주서 목록 조회');
output.push('// - GET    /api/orders/:date/:no       : 발주서 상세 조회');
output.push('// - POST   /api/orders                 : 발주서 신규 작성');
output.push('// - PUT    /api/orders/:date/:no       : 발주서 수정');
output.push('// - DELETE /api/orders/:date/:no       : 발주서 삭제');
output.push('// - GET    /api/orders/:date/:no/print : 발주서 인쇄');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.orders);
output.push('');

// 5.2 매입전표
output.push('// -----------------------------------------------------------------------------');
output.push('// 5.2 매입전표 관리');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/purchase-statements            : 매입전표 목록 조회');
output.push('// - GET    /api/purchase-statements/:date/:no  : 매입전표 상세 조회');
output.push('// - POST   /api/purchase-statements            : 매입전표 신규 작성');
output.push('// - PUT    /api/purchase-statements/:date/:no  : 매입전표 수정');
output.push('// - DELETE /api/purchase-statements/:date/:no  : 매입전표 삭제');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.purchaseStatements);
output.push('');

// =============================================================================
// 6. 자재 관리
// =============================================================================
output.push('// =============================================================================');
output.push('// 6. 자재 관리');
output.push('// =============================================================================');
output.push('// - GET    /api/materials              : 자재 목록 조회');
output.push('// - GET    /api/materials/:code        : 자재 상세 조회');
output.push('// - POST   /api/materials              : 자재 신규 등록');
output.push('// - PUT    /api/materials/:code        : 자재 수정');
output.push('// - DELETE /api/materials/:code        : 자재 소프트 삭제');
output.push('// - GET    /api/material-categories    : 자재분류 목록');
output.push('// - GET    /api/inventory/:workplace   : 사업장별 재고 현황');
output.push('// =============================================================================');
output.push('');
output.push(...sections.materials);
output.push('');

// =============================================================================
// 7. 회계 관리
// =============================================================================
output.push('// =============================================================================');
output.push('// 7. 회계 관리');
output.push('// =============================================================================');
output.push('');

// 7.1 계정분류
output.push('// -----------------------------------------------------------------------------');
output.push('// 7.1 계정분류');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.accountCategories);
output.push('');

// 7.2 현금출납장
output.push('// -----------------------------------------------------------------------------');
output.push('// 7.2 현금출납장 관리');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/cash-history               : 현금출납 내역 조회');
output.push('// - GET    /api/cash-history/:date/:time   : 현금출납 상세 조회');
output.push('// - POST   /api/cash-history               : 현금출납 등록');
output.push('// - PUT    /api/cash-history/:date/:time   : 현금출납 수정');
output.push('// - DELETE /api/cash-history/:date/:time   : 현금출납 삭제');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.cashHistory);
output.push('');

// =============================================================================
// 8. 장부 관리
// =============================================================================
output.push('// =============================================================================');
output.push('// 8. 장부 관리');
output.push('// =============================================================================');
output.push('');

// 8.1 미지급금
output.push('// -----------------------------------------------------------------------------');
output.push('// 8.1 미지급금 관리 (매입처 장부)');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/accounts-payable                      : 미지급금 내역 조회');
output.push('// - POST   /api/accounts-payable                      : 미지급금 지급 처리');
output.push('// - GET    /api/accounts-payable/balance/:supplierCode : 매입처별 잔액');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.accountsPayable);
output.push('');

// 8.2 미수금
output.push('// -----------------------------------------------------------------------------');
output.push('// 8.2 미수금 관리 (매출처 장부)');
output.push('// -----------------------------------------------------------------------------');
output.push('// - GET    /api/accounts-receivable                      : 미수금 내역 조회');
output.push('// - POST   /api/accounts-receivable                      : 미수금 입금 처리');
output.push('// - GET    /api/accounts-receivable/balance/:customerCode : 매출처별 잔액');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.accountsReceivable);
output.push('');

// =============================================================================
// 9. 대시보드/리포트
// =============================================================================
output.push('// =============================================================================');
output.push('// 9. 대시보드/리포트');
output.push('// =============================================================================');
output.push('');

// 9.1 대시보드
output.push('// -----------------------------------------------------------------------------');
output.push('// 9.1 대시보드');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.dashboard);
output.push('');

// 9.2 일일보고서
output.push('// -----------------------------------------------------------------------------');
output.push('// 9.2 일일보고서');
output.push('// -----------------------------------------------------------------------------');
output.push('');
output.push(...sections.dailyReport);
output.push('');

// =============================================================================
// Footer (서버 시작)
// =============================================================================
output.push('// =============================================================================');
output.push('// 서버 시작');
output.push('// =============================================================================');
output.push('');
output.push(...sections.footer);

// 파일 저장
const finalContent = output.join('\n');
fs.writeFileSync(outputFile, finalContent, 'utf8');

console.log('');
console.log('✅ 재구성 완료!');
console.log(`📝 출력 파일: ${outputFile}`);
console.log(`📏 총 줄 수: ${output.length}줄`);
console.log('');
console.log('⚠️  다음 단계:');
console.log('   1. 서버 시작 테스트: npm start');
console.log('   2. 기능 테스트 수행');
console.log('   3. 문제 발생 시 백업 복원: cp server.251128.js server.js');

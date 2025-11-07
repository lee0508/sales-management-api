# 소스 코드 모듈화 제안서

## 현재 문제점

### 1. 파일 크기
- **index.html**: 약 9,200+ 줄 (모든 페이지 HTML + JavaScript)
- **quotation.js**: 2,787 줄
- **order.js**: 2,798 줄
- **server.js**: 약 4,000+ 줄 (모든 API 엔드포인트)

### 2. 유지보수 어려움
- 한 파일에서 특정 메뉴 수정 시 전체 파일 로딩 필요
- 코드 검색 및 네비게이션 어려움
- 여러 개발자 협업 시 충돌 가능성 높음
- 특정 기능만 테스트하기 어려움

---

## 제안 1: HTML 뷰 분리 (우선순위: 높음)

### 현재 구조
```
index.html (9,200+ 줄)
├── 대시보드 HTML
├── 견적관리 HTML
├── 발주관리 HTML
├── 거래명세서관리 HTML
├── 매입전표관리 HTML
├── 매출처관리 HTML
├── 매입처관리 HTML
└── 모든 JavaScript 로직
```

### 제안 구조
```
index.html (메인 레이아웃만 - 약 200줄)
├── includes/
│   ├── dashboard.html        (대시보드 뷰)
│   ├── quotation.html         (견적관리 뷰)
│   ├── order.html             (발주관리 뷰)
│   ├── transaction.html       (거래명세서관리 뷰)
│   ├── purchase-statement.html (매입전표관리 뷰)
│   ├── customer.html          (매출처관리 뷰)
│   └── supplier.html          (매입처관리 뷰)
```

### 구현 방법 (3가지 옵션)

#### 옵션 A: JavaScript Fetch API (권장)
**장점**:
- 추가 라이브러리 불필요
- 비동기 로딩으로 초기 로딩 속도 개선
- 필요한 뷰만 로드하여 메모리 절약

**구현 예시**:
```javascript
// 기존 showPage() 함수 수정
async function showPage(pageName) {
  const container = document.getElementById('page-container');

  // 뷰가 이미 로드되어 있으면 표시만
  const existingPage = document.getElementById(`${pageName}Page`);
  if (existingPage) {
    // 기존 로직 (페이지 전환)
    hideAllPages();
    existingPage.classList.add('active');
  } else {
    // 처음 접근 시 HTML 로드
    try {
      const response = await fetch(`/sales-management-api/views/${pageName}.html`);
      const html = await response.text();
      container.insertAdjacentHTML('beforeend', html);

      // 페이지별 초기화 함수 호출
      if (window[`init${capitalize(pageName)}`]) {
        window[`init${capitalize(pageName)}`]();
      }

      hideAllPages();
      document.getElementById(`${pageName}Page`).classList.add('active');
    } catch (error) {
      console.error(`페이지 로드 실패: ${pageName}`, error);
    }
  }
}
```

#### 옵션 B: jQuery load() 메서드
**장점**:
- jQuery 이미 사용 중이므로 추가 설정 불필요
- 간단한 구문

**구현 예시**:
```javascript
async function showPage(pageName) {
  const existingPage = document.getElementById(`${pageName}Page`);
  if (!existingPage) {
    await new Promise((resolve) => {
      $('#page-container').append(
        $('<div>').load(`/sales-management-api/views/${pageName}.html`, resolve)
      );
    });

    if (window[`init${capitalize(pageName)}`]) {
      window[`init${capitalize(pageName)}`]();
    }
  }

  hideAllPages();
  $(`#${pageName}Page`).addClass('active');
}
```

#### 옵션 C: 서버사이드 템플릿 엔진 (향후 고려)
- EJS, Handlebars, Pug 등 사용
- 서버에서 HTML 조합 후 전송
- 더 큰 리팩토링 필요

---

## 제안 2: JavaScript 모듈 분리 (우선순위: 중간)

### 현재 구조
```
js/
├── jquery-3.7.1.min.js
├── dataTableInit.js
├── customer.js       (2,000+ 줄)
├── supplier.js       (2,000+ 줄)
├── quotation.js      (2,787 줄)
├── order.js          (2,798 줄)
├── transaction.js    (1,500+ 줄)
└── postoffice.js
```

### 제안 구조 (기능별 세분화)
```
js/
├── lib/
│   ├── jquery-3.7.1.min.js
│   └── dataTableInit.js
├── utils/
│   ├── api.js              (API 호출 헬퍼)
│   ├── formatters.js       (날짜, 금액 포맷)
│   ├── validators.js       (입력 검증)
│   └── modal.js            (모달 공통 로직)
├── modules/
│   ├── dashboard/
│   │   ├── dashboard.js
│   │   └── dashboard-tables.js
│   ├── quotation/
│   │   ├── quotation-list.js      (목록 관리)
│   │   ├── quotation-form.js      (작성/수정 폼)
│   │   ├── quotation-modal.js     (모달 관리)
│   │   └── quotation-api.js       (API 호출)
│   ├── order/
│   │   ├── order-list.js
│   │   ├── order-form.js
│   │   ├── order-modal.js
│   │   └── order-api.js
│   ├── transaction/
│   │   ├── transaction-list.js
│   │   ├── transaction-form.js
│   │   ├── transaction-modal.js
│   │   └── transaction-api.js
│   ├── purchase-statement/
│   │   ├── purchase-list.js
│   │   ├── purchase-form.js
│   │   └── purchase-api.js
│   ├── customer/
│   │   ├── customer-list.js
│   │   ├── customer-form.js
│   │   └── customer-api.js
│   └── supplier/
│       ├── supplier-list.js
│       ├── supplier-form.js
│       └── supplier-api.js
└── postoffice.js
```

### 구현 방법: ES6 Modules

**index.html에서 로딩**:
```html
<script type="module">
  // 공통 유틸리티
  import * as API from './js/utils/api.js';
  import * as Formatters from './js/utils/formatters.js';

  // 전역으로 노출 (레거시 호환)
  window.API = API;
  window.Formatters = Formatters;

  // 페이지별 모듈은 동적 로딩
  async function loadPageModule(pageName) {
    switch(pageName) {
      case 'quotation':
        await import('./js/modules/quotation/quotation-list.js');
        await import('./js/modules/quotation/quotation-form.js');
        break;
      case 'order':
        await import('./js/modules/order/order-list.js');
        await import('./js/modules/order/order-form.js');
        break;
      // ... 기타 페이지
    }
  }
</script>
```

**모듈 예시 (quotation-list.js)**:
```javascript
import { apiCall } from '../../utils/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';

let quotationTable = null;

export async function initQuotationList() {
  console.log('✅ 견적관리 목록 초기화');

  // 날짜 초기화
  initializeDateInputs();

  // DataTable 초기화
  await loadQuotations();

  // 이벤트 핸들러 등록
  registerEventHandlers();
}

async function loadQuotations() {
  if (quotationTable) {
    quotationTable.destroy();
    quotationTable = null;
  }

  quotationTable = $('#quotationTable').DataTable({
    // ... DataTable 설정
  });
}

function registerEventHandlers() {
  $('#quotationSearchBtn').on('click', () => {
    quotationTable.ajax.reload();
  });

  $('#quotationNewBtn').on('click', () => {
    window.openQuotationModal();
  });
}

// 전역 노출 (기존 HTML 인라인 이벤트 호환)
window.initQuotationList = initQuotationList;
```

---

## 제안 3: 백엔드 API 모듈화 (우선순위: 낮음)

### 현재 구조
```
server.js (4,000+ 줄)
├── Database connection
├── Session configuration
├── Middleware
├── Authentication routes
├── Customer routes
├── Supplier routes
├── Quotation routes
├── Order routes
├── Transaction routes
├── Material routes
└── ... 기타 모든 엔드포인트
```

### 제안 구조 (Express Router 활용)
```
server.js (메인 앱 설정만 - 약 200줄)
├── config/
│   ├── database.js        (DB 설정)
│   └── session.js         (세션 설정)
├── middleware/
│   ├── auth.js            (requireAuth, requireRole)
│   └── errorHandler.js    (에러 처리)
├── routes/
│   ├── auth.routes.js
│   ├── customer.routes.js
│   ├── supplier.routes.js
│   ├── quotation.routes.js
│   ├── order.routes.js
│   ├── transaction.routes.js
│   ├── purchase-statement.routes.js
│   ├── material.routes.js
│   └── dashboard.routes.js
├── controllers/
│   ├── auth.controller.js
│   ├── customer.controller.js
│   ├── supplier.controller.js
│   ├── quotation.controller.js
│   ├── order.controller.js
│   ├── transaction.controller.js
│   ├── purchase-statement.controller.js
│   ├── material.controller.js
│   └── dashboard.controller.js
└── models/
    ├── customer.model.js
    ├── supplier.model.js
    ├── quotation.model.js
    └── ... (SQL 쿼리 로직)
```

**구현 예시 (server.js)**:
```javascript
const express = require('express');
const session = require('express-session');
const cors = require('cors');

// 설정 모듈
const { initializeDatabase } = require('./config/database');
const sessionConfig = require('./config/session');

// 라우트 모듈
const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const supplierRoutes = require('./routes/supplier.routes');
const quotationRoutes = require('./routes/quotation.routes');
// ... 기타 라우트

const app = express();

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(session(sessionConfig));

// 데이터베이스 초기화
initializeDatabase();

// 라우트 등록
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/quotations', quotationRoutes);
// ... 기타 라우트

// 에러 핸들러
app.use(require('./middleware/errorHandler'));

app.listen(3000, () => {
  console.log('서버 시작: http://localhost:3000');
});
```

**구현 예시 (routes/quotation.routes.js)**:
```javascript
const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotation.controller');
const { requireAuth } = require('../middleware/auth');

// 견적 목록 조회
router.get('/', requireAuth, quotationController.getQuotations);

// 견적 상세 조회
router.get('/:date/:no', requireAuth, quotationController.getQuotationDetail);

// 견적 작성
router.post('/', requireAuth, quotationController.createQuotation);

// 견적 수정
router.put('/:date/:no', requireAuth, quotationController.updateQuotation);

// 견적 삭제
router.delete('/:date/:no', requireAuth, quotationController.deleteQuotation);

module.exports = router;
```

---

## 단계별 마이그레이션 계획

### Phase 1: HTML 뷰 분리 (추천: 가장 먼저 시작)
**예상 작업 시간**: 2-3일
**위험도**: 낮음
**효과**: 즉각적인 파일 크기 감소 및 가독성 향상

1. `views/` 디렉토리 생성
2. index.html에서 각 페이지 HTML 추출
3. showPage() 함수를 동적 로딩으로 수정
4. 페이지별 초기화 함수 정리
5. 철저한 테스트

### Phase 2: JavaScript 모듈 세분화
**예상 작업 시간**: 3-5일
**위험도**: 중간
**효과**: 코드 재사용성 향상, 유지보수 용이

1. `utils/` 공통 유틸리티 추출
2. 큰 파일부터 분리 시작 (quotation.js, order.js)
3. ES6 모듈로 변환
4. 동적 import 적용
5. 기능별 테스트

### Phase 3: 백엔드 API 모듈화
**예상 작업 시간**: 5-7일
**위험도**: 중간-높음
**효과**: 서버 코드 관리 용이, 팀 협업 개선

1. 라우트 분리 (가장 안전)
2. 컨트롤러 분리
3. 모델 레이어 추가 (선택사항)
4. API 테스트
5. 성능 검증

---

## 즉시 적용 가능한 임시 해결책

모듈화 작업 전까지 다음 방법으로 작업 효율 개선 가능:

### 1. VSCode 코드 폴딩 활용
```javascript
//#region 견적관리
// 견적관리 관련 코드...
//#endregion

//#region 발주관리
// 발주관리 관련 코드...
//#endregion
```

### 2. 함수 인덱스 주석 추가
```javascript
/**
 * 견적관리 모듈
 *
 * Functions:
 * - loadQuotations()           : 견적 목록 로드
 * - openQuotationModal()       : 견적 작성 모달 열기
 * - openQuotationEditModal()   : 견적 수정 모달 열기
 * - deleteQuotation()          : 견적 삭제
 * - approveQuotation()         : 견적 승인
 */
```

### 3. 파일 내 네비게이션 주석
```javascript
// =============================================================================
// 견적관리 시작
// =============================================================================

// ... 코드 ...

// =============================================================================
// 견적관리 끝
// =============================================================================
```

---

## 권장 사항

**최우선 추천**: **Phase 1 (HTML 뷰 분리)** 부터 시작하는 것을 강력히 권장합니다.

**이유**:
1. 가장 적은 리스크
2. 즉각적인 효과 (파일 크기 90% 감소)
3. 기존 로직 변경 최소화
4. 롤백 용이
5. 다른 단계의 기반 작업

**다음 세션 작업 순서**:
1. 매입관리 메뉴 수정 완료
2. HTML 뷰 분리 작업 시작 (dashboard.html, quotation.html 등)
3. 동적 로딩 테스트
4. 점진적으로 다른 모듈화 진행

---

## 참고 자료

- [Express.js Router 공식 문서](https://expressjs.com/en/guide/routing.html)
- [ES6 Modules 가이드](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Dynamic Import](https://javascript.info/modules-dynamic-imports)
- [Code Splitting Best Practices](https://web.dev/code-splitting-suspense/)

---

**작성일**: 2025-11-03
**작성자**: Claude Code Assistant
**검토 필요**: HTML 뷰 분리 방식 결정 (Fetch API vs jQuery load)

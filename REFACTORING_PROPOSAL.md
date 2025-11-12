# 판매관리 시스템 리팩토링 제안서

**작성일**: 2025-11-11 (업데이트)
**상태**: 제안 - 실제 운영 테스트 후 검토 예정
**검토 시기**: 제이씨엠전기 1개월 병행 테스트 완료 후

---

## 📊 현재 상황 분석 (2025-11-11 업데이트)

### 코드 라인 수
- **index.html**: 13,049줄 (이전: 9,200+줄)
- **server.js**: 5,421줄 (이전: 4,000+줄)
- **js/quotation.js**: 2,868줄 (이전: 2,787줄)
- **js/order.js**: 3,005줄 (이전: 2,798줄)
- **js/transaction.js**: 1,935줄 (이전: 1,500+줄)
- **js/purchase.js**: 741줄
- **js/supplier.js**: 634줄
- **js/customer.js**: 158줄

**총계**: 약 **28,000+ 줄**의 코드가 소수의 파일에 집중

### 문제점

1. **index.html 비대화** (13,049줄)
   - 모든 페이지 HTML이 하나의 파일에 집중
   - 기능 추가 및 수정 시 파일 탐색 어려움
   - 로딩 시간 증가 (불필요한 HTML까지 모두 로드)
   - Git diff 확인 어려움

2. **JavaScript 파일 비대화**
   - quotation.js (2,868줄), order.js (3,005줄)
   - 단일 파일에 모든 로직 집중 (리스트, 폼, API, 유틸리티)
   - 코드 재사용성 낮음
   - 동일한 패턴 반복 (DataTable 초기화, 모달 관리 등)

3. **server.js 비대화** (5,421줄)
   - 모든 라우트, 컨트롤러, 비즈니스 로직이 한 파일에
   - 유지보수 및 디버깅 어려움
   - 협업 시 Git 충돌 가능성 높음
   - 특정 기능 테스트 어려움

4. **코드 중복**
   - DataTable 초기화 로직 반복
   - 모달 열기/닫기 패턴 반복
   - API 호출 에러 처리 중복
   - 날짜 포맷팅 로직 중복 (YYYYMMDD ↔ YYYY-MM-DD)
   - 금액 계산 로직 중복 (공급가액, 부가세, 합계)

---

## 🎯 개선 방안 제안

### 전략: **점진적 리팩토링 (Progressive Refactoring)**

한 번에 모든 것을 바꾸는 것이 아니라, 단계별로 개선해 나가는 방식

---

## 1단계: 프론트엔드 모듈화 (우선순위: 높음)

### 1-1. HTML 분리 - Component 기반 구조

**현재 구조**:
```
index.html (13,049줄 - 모든 페이지 포함)
```

**개선 후 구조**:
```
pages/
├── dashboard.html              (대시보드 화면)
├── customer-management.html    (매출처 관리)
├── supplier-management.html    (매입처 관리)
├── quotation.html              (견적 관리)
├── order.html                  (발주 관리)
├── transaction.html            (거래명세서)
├── purchase.html               (매입전표)
└── material-management.html    (자재 관리)

components/
├── modals/
│   ├── customer-modal.html
│   ├── quotation-modal.html
│   └── material-search-modal.html
└── common/
    ├── sidebar.html
    ├── header.html
    └── footer.html
```

**구현 방법**:
- JavaScript의 `fetch()` API로 HTML 동적 로딩
- 간단한 템플릿 엔진 사용 (예: Handlebars, Mustache)
- 또는 Web Components 사용

**예시 코드**:
```javascript
// js/core/router.js
class Router {
  async loadPage(pageName) {
    const response = await fetch(`/pages/${pageName}.html`);
    const html = await response.text();
    document.getElementById('main-content').innerHTML = html;
  }
}

// 사용 예
router.loadPage('quotation'); // quotation.html 로드
```

**장점**:
- 각 페이지를 독립적으로 관리 가능
- 초기 로딩 속도 개선 (필요한 페이지만 로드)
- 페이지별 수정 시 영향 범위 최소화
- Git 충돌 감소

---

### 1-2. JavaScript 모듈 분리

**현재 구조**:
```
js/
├── quotation.js (2,868줄 - 모든 로직 포함)
├── order.js (3,005줄 - 모든 로직 포함)
└── transaction.js (1,935줄 - 모든 로직 포함)
```

**개선 후 구조**:
```
js/
├── core/                       (핵심 기능)
│   ├── api.js                  (공통 API 호출 함수)
│   ├── router.js               (페이지 라우팅)
│   ├── session.js              (세션 관리)
│   ├── datatable-helper.js     (DataTable 공통 설정)
│   ├── modal-helper.js         (모달 공통 함수)
│   └── utils.js                (공통 유틸리티)
├── modules/
│   ├── customer/
│   │   ├── customer-list.js    (고객 목록 관리)
│   │   ├── customer-form.js    (고객 등록/수정 폼)
│   │   └── customer-api.js     (고객 API 호출)
│   ├── quotation/
│   │   ├── quotation-list.js   (견적 목록)
│   │   ├── quotation-form.js   (견적 작성/수정)
│   │   ├── quotation-detail.js (견적 상세)
│   │   └── quotation-api.js    (견적 API)
│   ├── order/
│   │   ├── order-list.js
│   │   ├── order-form.js
│   │   ├── order-detail.js
│   │   └── order-api.js
│   └── material/
│       ├── material-search.js  (자재 검색 모달)
│       └── material-api.js     (자재 API)
└── app.js                      (메인 진입점)
```

**예시 코드**:

```javascript
// js/core/api.js
export class API {
  static async get(endpoint, params = {}) {
    const url = `/api${endpoint}?${new URLSearchParams(params)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }

  static async post(endpoint, data) {
    const response = await fetch(`/api${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }

  static async put(endpoint, data) {
    const response = await fetch(`/api${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }

  static async delete(endpoint) {
    const response = await fetch(`/api${endpoint}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }
}

// js/modules/quotation/quotation-api.js
import { API } from '../../core/api.js';

export class QuotationAPI {
  static async getList(filters = {}) {
    return API.get('/quotations', filters);
  }

  static async getDetail(date, no) {
    return API.get(`/quotations/${date}/${no}`);
  }

  static async create(data) {
    return API.post('/quotations', data);
  }

  static async update(date, no, data) {
    return API.put(`/quotations/${date}/${no}`, data);
  }

  static async delete(date, no) {
    return API.delete(`/quotations/${date}/${no}`);
  }
}

// js/core/datatable-helper.js
export class DataTableHelper {
  static init(selector, columns, options = {}) {
    return $(selector).DataTable({
      ...this.getDefaultConfig(),
      columns,
      ...options
    });
  }

  static getDefaultConfig() {
    return {
      language: {
        url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/ko.json'
      },
      pageLength: 25,
      responsive: true,
      autoWidth: false,
      processing: true
    };
  }

  static destroy(selector) {
    const table = $(selector).DataTable();
    if (table) {
      table.destroy();
    }
  }
}

// js/core/modal-helper.js
export class ModalHelper {
  static open(modalId) {
    $(`#${modalId}`).modal('show');
  }

  static close(modalId) {
    $(`#${modalId}`).modal('hide');
  }

  static resetForm(formId) {
    $(`#${formId}`)[0].reset();
  }

  static setTitle(modalId, title) {
    $(`#${modalId} .modal-title`).text(title);
  }
}

// js/core/utils.js
export class Utils {
  // 날짜 포맷팅 (YYYYMMDD)
  static formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  // 날짜 파싱 (YYYYMMDD → YYYY-MM-DD)
  static parseDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return '';
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }

  // 숫자 포맷팅 (천단위 콤마)
  static formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('ko-KR');
  }

  // 금액 계산
  static calculateAmount(quantity, price) {
    return Math.round(quantity * price);
  }

  // 부가세 계산 (10%)
  static calculateVAT(amount) {
    return Math.round(amount * 0.1);
  }
}
```

**사용 예시**:
```javascript
// js/modules/quotation/quotation-list.js
import { QuotationAPI } from './quotation-api.js';
import { DataTableHelper } from '../../core/datatable-helper.js';
import { Utils } from '../../core/utils.js';

export class QuotationList {
  constructor() {
    this.table = null;
  }

  async init() {
    await this.loadList();
    this.bindEvents();
  }

  async loadList() {
    try {
      const response = await QuotationAPI.getList({
        사업장코드: sessionStorage.getItem('사업장코드')
      });

      this.table = DataTableHelper.init('#quotationTable', [
        { data: '견적일자', render: (data) => Utils.parseDate(data) },
        { data: '견적번호' },
        { data: '매출처명' },
        { data: '합계금액', render: (data) => Utils.formatNumber(data) }
      ], {
        data: response.data
      });
    } catch (error) {
      alert('견적 목록을 불러오는데 실패했습니다: ' + error.message);
    }
  }

  bindEvents() {
    $('#newQuotationBtn').on('click', () => {
      // 새 견적 작성 모달 열기
    });
  }
}
```

**장점**:
- 코드 재사용성 향상
- 각 모듈의 역할이 명확
- 테스트 용이
- 유지보수 편리

---

## 2단계: 백엔드 모듈화 (우선순위: 중간)

### 2-1. MVC 패턴 적용

**현재 구조**:
```
server.js (5,421줄 - 모든 로직 포함)
```

**개선 후 구조**:
```
server/
├── app.js                      (Express 앱 설정 및 시작)
├── config/
│   ├── database.js             (DB 연결 설정)
│   └── session.js              (세션 설정)
├── routes/
│   ├── index.js                (라우트 통합)
│   ├── auth.routes.js          (인증 라우트)
│   ├── customer.routes.js      (매출처 라우트)
│   ├── supplier.routes.js      (매입처 라우트)
│   ├── quotation.routes.js     (견적 라우트)
│   ├── order.routes.js         (발주 라우트)
│   ├── transaction.routes.js   (거래명세서 라우트)
│   └── material.routes.js      (자재 라우트)
├── controllers/
│   ├── auth.controller.js
│   ├── customer.controller.js
│   ├── quotation.controller.js
│   ├── order.controller.js
│   └── material.controller.js
├── models/
│   ├── customer.model.js
│   ├── quotation.model.js
│   ├── order.model.js
│   └── material.model.js
├── middleware/
│   ├── auth.middleware.js      (인증 미들웨어)
│   ├── validation.middleware.js (입력 검증)
│   └── error.middleware.js     (에러 핸들링)
└── utils/
    ├── db.js                   (DB 유틸리티)
    └── helpers.js              (헬퍼 함수)
```

**예시 코드**:

```javascript
// routes/quotation.routes.js
const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotation.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// 견적 목록 조회
router.get('/', requireAuth, quotationController.list);

// 견적 상세 조회
router.get('/:date/:no', requireAuth, quotationController.getDetail);

// 견적 생성
router.post('/', requireAuth, quotationController.create);

// 견적 수정
router.put('/:date/:no', requireAuth, quotationController.update);

// 견적 삭제
router.delete('/:date/:no', requireAuth, quotationController.delete);

module.exports = router;

// controllers/quotation.controller.js
const QuotationModel = require('../models/quotation.model');
const LogModel = require('../models/log.model');

class QuotationController {
  async list(req, res) {
    try {
      const { 사업장코드 } = req.session.user;
      const filters = req.query;

      const quotations = await QuotationModel.findAll(사업장코드, filters);

      res.json({
        success: true,
        data: quotations,
        total: quotations.length
      });
    } catch (error) {
      console.error('견적 목록 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '견적 목록을 불러오는데 실패했습니다.'
      });
    }
  }

  async getDetail(req, res) {
    try {
      const { date, no } = req.params;
      const { 사업장코드 } = req.session.user;

      const quotation = await QuotationModel.findByDateAndNo(
        사업장코드,
        date,
        no
      );

      if (!quotation) {
        return res.status(404).json({
          success: false,
          message: '견적을 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: quotation
      });
    } catch (error) {
      console.error('견적 상세 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '견적 정보를 불러오는데 실패했습니다.'
      });
    }
  }

  async create(req, res) {
    const transaction = await pool.transaction();

    try {
      const { 사업장코드, 사용자코드 } = req.session.user;
      const { master, details } = req.body;

      // 견적번호 생성
      const 견적번호 = await LogModel.getNextNumber(
        '견적',
        사업장코드 + master.견적일자,
        transaction
      );

      // 견적 마스터 생성
      await QuotationModel.createMaster(
        { ...master, 사업장코드, 견적번호, 사용자코드 },
        transaction
      );

      // 견적 상세 생성
      await QuotationModel.createDetails(
        master.견적일자,
        견적번호,
        details,
        transaction
      );

      await transaction.commit();

      res.json({
        success: true,
        message: '견적이 저장되었습니다.',
        data: { 견적일자: master.견적일자, 견적번호 }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('견적 생성 실패:', error);
      res.status(500).json({
        success: false,
        message: '견적 저장에 실패했습니다.'
      });
    }
  }
}

module.exports = new QuotationController();

// models/quotation.model.js
const { pool } = require('../utils/db');
const sql = require('mssql');

class QuotationModel {
  async findAll(사업장코드, filters = {}) {
    const request = pool.request();
    request.input('사업장코드', sql.VarChar(2), 사업장코드);

    let query = `
      SELECT
        q.견적일자, q.견적번호, q.매출처코드,
        c.매출처명, q.합계금액, q.상태코드
      FROM 견적 q
        LEFT JOIN 매출처 c ON q.매출처코드 = c.매출처코드
      WHERE q.사업장코드 = @사업장코드
        AND q.사용구분 = 0
    `;

    // 필터 적용
    if (filters.상태코드) {
      request.input('상태코드', sql.VarChar(2), filters.상태코드);
      query += ` AND q.상태코드 = @상태코드`;
    }

    query += ` ORDER BY q.견적일자 DESC, q.견적번호 DESC`;

    const result = await request.query(query);
    return result.recordset;
  }

  async findByDateAndNo(사업장코드, 견적일자, 견적번호) {
    const request = pool.request();
    request.input('사업장코드', sql.VarChar(2), 사업장코드);
    request.input('견적일자', sql.VarChar(8), 견적일자);
    request.input('견적번호', sql.Int, 견적번호);

    // 마스터 조회
    const masterResult = await request.query(`
      SELECT * FROM 견적
      WHERE 사업장코드 = @사업장코드
        AND 견적일자 = @견적일자
        AND 견적번호 = @견적번호
        AND 사용구분 = 0
    `);

    if (masterResult.recordset.length === 0) {
      return null;
    }

    // 상세 조회
    const detailResult = await request.query(`
      SELECT * FROM 견적내역
      WHERE 사업장코드 = @사업장코드
        AND 견적일자 = @견적일자
        AND 견적번호 = @견적번호
      ORDER BY 일련번호
    `);

    return {
      master: masterResult.recordset[0],
      details: detailResult.recordset
    };
  }

  async createMaster(data, transaction) {
    const request = transaction.request();

    request.input('사업장코드', sql.VarChar(2), data.사업장코드);
    request.input('견적일자', sql.VarChar(8), data.견적일자);
    request.input('견적번호', sql.Int, data.견적번호);
    request.input('매출처코드', sql.VarChar(8), data.매출처코드);
    request.input('합계금액', sql.Money, data.합계금액);
    request.input('사용자코드', sql.VarChar(4), data.사용자코드);

    await request.query(`
      INSERT INTO 견적 (
        사업장코드, 견적일자, 견적번호, 매출처코드,
        합계금액, 상태코드, 사용구분, 사용자코드
      ) VALUES (
        @사업장코드, @견적일자, @견적번호, @매출처코드,
        @합계금액, '01', 0, @사용자코드
      )
    `);
  }

  async createDetails(견적일자, 견적번호, details, transaction) {
    for (let i = 0; i < details.length; i++) {
      const detail = details[i];
      const request = transaction.request();

      request.input('견적일자', sql.VarChar(8), 견적일자);
      request.input('견적번호', sql.Int, 견적번호);
      request.input('일련번호', sql.Int, i + 1);
      request.input('자재코드', sql.VarChar(20), detail.자재코드);
      request.input('수량', sql.Money, detail.수량);
      request.input('단가', sql.Money, detail.단가);

      await request.query(`
        INSERT INTO 견적내역 (
          견적일자, 견적번호, 일련번호,
          자재코드, 수량, 단가
        ) VALUES (
          @견적일자, @견적번호, @일련번호,
          @자재코드, @수량, @단가
        )
      `);
    }
  }
}

module.exports = new QuotationModel();

// models/log.model.js
const { pool } = require('../utils/db');
const sql = require('mssql');

class LogModel {
  async getNextNumber(테이블명, 베이스코드, transaction) {
    const request = transaction.request();
    request.input('테이블명', sql.VarChar(50), 테이블명);
    request.input('베이스코드', sql.VarChar(50), 베이스코드);

    const result = await request.query(`
      SELECT 최종로그 FROM 로그
      WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
    `);

    let 새번호 = 1;

    if (result.recordset.length > 0) {
      새번호 = result.recordset[0].최종로그 + 1;

      request.input('새번호', sql.Real, 새번호);
      await request.query(`
        UPDATE 로그 SET 최종로그 = @새번호
        WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
      `);
    } else {
      request.input('새번호', sql.Real, 새번호);
      await request.query(`
        INSERT INTO 로그 (테이블명, 베이스코드, 최종로그)
        VALUES (@테이블명, @베이스코드, @새번호)
      `);
    }

    return 새번호;
  }
}

module.exports = new LogModel();

// app.js (메인 진입점)
const express = require('express');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(session(require('./config/session')));

// 정적 파일
app.use(express.static('.'));

// 라우트
const routes = require('./routes');
app.use('/api', routes);

// 에러 핸들링
app.use(require('./middleware/error.middleware'));

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**장점**:
- 각 레이어의 책임이 명확
- 코드 재사용성 향상
- 테스트 작성 용이
- 협업 시 충돌 최소화

---

## 3단계: 공통 코드 제거 (DRY 원칙 적용)

### 중복 패턴 식별

**현재 중복되는 코드**:

1. **DataTable 초기화** - quotation.js, order.js, transaction.js 등에서 반복
2. **모달 열기/닫기** - 모든 모듈에서 동일한 패턴
3. **API 호출 에러 처리** - 매번 try-catch로 동일한 처리
4. **날짜 포맷팅** - YYYYMMDD ↔ YYYY-MM-DD 변환 로직 중복
5. **금액 계산** - 공급가액, 부가세, 합계 계산 로직 반복

### 해결 방안

위의 "1-2. JavaScript 모듈 분리" 섹션에서 제시한 Helper 클래스들 사용

---

## 4단계: 빌드 도구 도입 (선택사항)

### 옵션 A: Vite (추천 - 가장 간단)

**설치**:
```bash
npm install -D vite
```

**설정** (vite.config.js):
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
});
```

**장점**:
- 설정이 매우 간단
- 빠른 HMR (Hot Module Replacement)
- ES6 모듈 네이티브 지원
- 개발 서버 내장

### 옵션 B: Webpack (전통적)

**설치**:
```bash
npm install -D webpack webpack-cli webpack-dev-server
npm install -D html-webpack-plugin css-loader style-loader
```

**설정** (webpack.config.js):
```javascript
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './js/app.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html'
    })
  ],
  devServer: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
};
```

**장점**:
- 성숙한 생태계
- 다양한 플러그인
- 프로덕션 최적화 강력

### 빌드 도구의 공통 장점

- ES6 모듈 번들링
- 코드 압축/난독화
- 소스맵 생성 (디버깅 용이)
- Tree shaking (사용하지 않는 코드 제거)
- 개발 서버 HMR

---

## 📋 실행 계획

### Phase 1 (1-2주): 프론트엔드 기초 작업
**목표**: HTML과 기본 라우팅 분리

- [ ] HTML을 페이지별로 분리 (pages/ 디렉토리)
- [ ] 공통 컴포넌트 추출 (sidebar, header, footer)
- [ ] 간단한 라우터 시스템 구축 (fetch 기반)
- [ ] 기존 기능 동작 확인

**예상 산출물**:
- `pages/` 디렉토리 (8개 페이지)
- `components/` 디렉토리 (공통 컴포넌트)
- `js/core/router.js`

---

### Phase 2 (2-3주): JavaScript 모듈화
**목표**: 공통 로직 분리 및 재사용성 향상

- [ ] 공통 유틸리티 분리 (api.js, utils.js, datatable-helper.js)
- [ ] 기능별 모듈 분리 (customer, quotation, order 등)
- [ ] ES6 모듈 적용 (import/export)
- [ ] 중복 코드 제거

**예상 산출물**:
- `js/core/` 디렉토리 (6개 핵심 모듈)
- `js/modules/` 디렉토리 (기능별 모듈)
- 코드 라인 수 30% 감소 예상

---

### Phase 3 (2-3주): 백엔드 리팩토링
**목표**: server.js 분리 및 MVC 패턴 적용

- [ ] Routes 분리 (8개 라우트 파일)
- [ ] Controllers 추출 (비즈니스 로직 분리)
- [ ] Models 분리 (DB 로직 캡슐화)
- [ ] Middleware 구성 (인증, 검증, 에러 처리)

**예상 산출물**:
- `server/routes/` 디렉토리
- `server/controllers/` 디렉토리
- `server/models/` 디렉토리
- `server/middleware/` 디렉토리
- server.js → app.js로 축소 (200줄 이하)

---

### Phase 4 (1주): 테스트 및 최적화
**목표**: 안정성 확보 및 성능 개선

- [ ] 각 기능별 통합 테스트
- [ ] 성능 측정 및 병목 지점 개선
- [ ] 코드 리뷰 및 정리
- [ ] 문서화 (API 문서, 개발자 가이드)

**예상 산출물**:
- 테스트 체크리스트
- 성능 개선 보고서
- 리팩토링 완료 문서

---

## 🤔 제안 선택지

### A안: 점진적 리팩토링 (추천) ⭐

**특징**:
- 현재 시스템을 유지하면서 조금씩 개선
- 기존 코드와 새 코드가 공존
- 각 단계마다 기능 테스트 후 다음 단계 진행

**장점**:
- ✅ 리스크 낮음 (언제든 롤백 가능)
- ✅ 점진적 학습 가능
- ✅ 운영 중단 없음
- ✅ 팀원들의 적응 시간 확보

**단점**:
- ❌ 시간이 오래 걸림 (6-8주)
- ❌ 임시 코드 증가 (과도기)
- ❌ 일관성 유지 노력 필요

**추천 대상**: 안정성을 중시하는 운영 중인 시스템

---

### B안: 새 프레임워크 도입 (장기)

**특징**:
- React/Vue.js 같은 현대적 프레임워크 사용
- 시스템을 완전히 새로 작성
- 최신 기술 스택 적용

**장점**:
- ✅ 최신 개발 패턴 적용
- ✅ 풍부한 생태계 활용 (UI 컴포넌트 라이브러리 등)
- ✅ 장기적으로 유지보수 용이
- ✅ 성능 최적화 가능

**단점**:
- ❌ 리스크 높음 (전체 재작성)
- ❌ 학습 곡선 가파름
- ❌ 개발 기간 길음 (3-6개월)
- ❌ 운영 중단 가능성

**추천 대상**: 장기 프로젝트, 새로운 기술 도입 의지가 있는 경우

---

### C안: 하이브리드 접근 (균형)

**특징**:
- 핵심 기능만 먼저 모듈화 (quotation, order)
- 나머지는 현재 상태 유지
- 점차 범위 확대

**장점**:
- ✅ 빠른 성과 확인 가능
- ✅ 리스크 중간
- ✅ 우선순위 기반 개선

**단점**:
- ❌ 일관성 유지 어려움
- ❌ 기술 부채 일부 유지

**추천 대상**: 빠른 개선이 필요한 특정 모듈이 있는 경우

---

## 💡 추천 방향

**현재 상황 고려사항**:
1. ✅ 실제 운영 환경 테스트 예정 (제이씨엠전기 1개월)
2. ✅ 남은 메뉴 개발 완료 필요
3. ✅ 안정성 중시

**추천**: **A안 (점진적 리팩토링)** + **C안 (우선순위 접근)** 조합

**구체적 실행 방안**:

1. **현재 (1-2개월)**: 남은 메뉴 개발 완료 + 운영 테스트
   - 기존 방식대로 개발 진행
   - 운영 중 발견된 문제점 문서화

2. **1차 리팩토링 (2-3개월)**: 핵심 모듈 개선
   - 가장 복잡한 2개 모듈 선택 (quotation, order)
   - 해당 모듈만 모듈화 적용
   - 성과 측정 및 피드백

3. **2차 리팩토링 (3-4개월)**: 전체 확대
   - 나머지 모듈로 확대
   - 백엔드 리팩토링 시작
   - 빌드 도구 도입 검토

---

## 📝 다음 단계

리팩토링 시작 결정 시:

1. **킥오프 미팅**
   - 리팩토링 목표 명확화
   - 우선순위 결정
   - 일정 수립

2. **파일럿 프로젝트**
   - 1개 모듈 선택하여 POC (Proof of Concept)
   - 새로운 구조 검증
   - 문제점 파악

3. **본격 진행**
   - 단계별 실행
   - 주간 리뷰
   - 지속적 개선

---

## 📚 참고 자료

### 추천 학습 자료

**JavaScript 모듈**:
- MDN Web Docs - JavaScript Modules: https://developer.mozilla.org/ko/docs/Web/JavaScript/Guide/Modules
- ES6 In Depth 시리즈

**설계 패턴**:
- MVC Pattern
- Repository Pattern
- Factory Pattern

**빌드 도구**:
- Vite 공식 문서: https://vitejs.dev/
- Webpack 공식 문서: https://webpack.js.org/

**코드 품질**:
- Clean Code (Robert C. Martin)
- Refactoring (Martin Fowler)

---

## 📞 문의 및 지원

리팩토링 진행 시 Claude Code가 각 단계별로 지원 가능:

- 코드 리뷰 및 개선 제안
- 리팩토링 코드 작성
- 테스트 코드 작성
- 문서화 지원

---

**최종 업데이트**: 2025-11-11
**다음 검토일**: 제이씨엠전기 1개월 병행 테스트 완료 후

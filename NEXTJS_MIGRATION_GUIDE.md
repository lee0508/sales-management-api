# Next.js 마이그레이션 가이드

## 현재 프로젝트 구조 분석

### 현재 스택
- **Backend**: Node.js + Express (server.js ~2,964 lines)
- **Frontend**: Vanilla HTML/CSS/JavaScript SPA
  - index.html (~5,826 lines) - 모든 페이지가 하나의 HTML에 포함
  - jQuery 3.7.1 + DataTables
  - 모듈화된 JS 파일들: customer.js, supplier.js, quotation.js, order.js, transaction.js, purchase.js
- **Database**: MS SQL Server (mssql package)
- **인증**: express-session (메모리 기반)

### 현재 주요 기능
1. 로그인/로그아웃 (세션 기반)
2. 매출관리: 매출처, 견적서, 거래명세서
3. 매입관리: 매입처, 발주서, 매입전표
4. 자재관리: 자재 목록, 재고 현황, 입출고 내역
5. 대시보드: 통계 및 현황

---

## Next.js 마이그레이션 전략

### 1단계: 마이그레이션 방식 선택

#### 옵션 A: 점진적 마이그레이션 (권장)
- 현재 Express 서버 유지하면서 Next.js 앱을 별도로 구축
- Next.js API Routes를 Express API의 프록시로 사용
- 페이지를 하나씩 Next.js로 이전
- **장점**: 리스크 최소화, 단계적 테스트 가능
- **단점**: 일시적으로 두 시스템 유지 필요

#### 옵션 B: 전면 재구축
- 처음부터 Next.js App Router로 새 프로젝트 생성
- 모든 코드를 한 번에 마이그레이션
- **장점**: 클린한 구조, 최신 기술 스택 적용
- **단점**: 높은 리스크, 긴 개발 기간

**추천**: 옵션 A (점진적 마이그레이션)

---

## 2단계: Next.js 프로젝트 구조 설계

### 디렉토리 구조 (App Router 기준)

```
sales-management-nextjs/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx          # 로그인 페이지
│   │   └── layout.tsx             # 인증 레이아웃
│   ├── (dashboard)/
│   │   ├── layout.tsx             # 대시보드 레이아웃 (사이드바 포함)
│   │   ├── page.tsx               # 대시보드 홈
│   │   ├── customers/
│   │   │   ├── page.tsx           # 매출처 목록
│   │   │   ├── [code]/
│   │   │   │   └── page.tsx       # 매출처 상세
│   │   │   └── new/
│   │   │       └── page.tsx       # 매출처 등록
│   │   ├── suppliers/
│   │   │   ├── page.tsx           # 매입처 목록
│   │   │   ├── [code]/
│   │   │   │   └── page.tsx       # 매입처 상세
│   │   │   └── new/
│   │   │       └── page.tsx       # 매입처 등록
│   │   ├── quotations/
│   │   │   ├── page.tsx           # 견적서 목록
│   │   │   ├── [date]/[no]/
│   │   │   │   └── page.tsx       # 견적서 상세
│   │   │   └── new/
│   │   │       └── page.tsx       # 견적서 작성
│   │   ├── orders/
│   │   │   ├── page.tsx           # 발주서 목록
│   │   │   ├── [date]/[no]/
│   │   │   │   └── page.tsx       # 발주서 상세
│   │   │   └── new/
│   │   │       └── page.tsx       # 발주서 작성
│   │   ├── transactions/
│   │   │   ├── page.tsx           # 거래명세서 목록
│   │   │   ├── [date]/[no]/
│   │   │   │   └── page.tsx       # 거래명세서 상세
│   │   │   └── new/
│   │   │       └── page.tsx       # 거래명세서 작성
│   │   ├── purchase-statements/
│   │   │   ├── page.tsx           # 매입전표 목록
│   │   │   ├── [date]/[no]/
│   │   │   │   └── page.tsx       # 매입전표 상세
│   │   │   └── new/
│   │   │       └── page.tsx       # 매입전표 작성
│   │   ├── materials/
│   │   │   ├── page.tsx           # 자재 목록
│   │   │   ├── [code]/
│   │   │   │   └── page.tsx       # 자재 상세
│   │   │   └── new/
│   │   │       └── page.tsx       # 자재 등록
│   │   └── inventory/
│   │       └── page.tsx           # 재고 현황
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── route.ts       # POST /api/auth/login
│   │   │   └── logout/
│   │   │       └── route.ts       # POST /api/auth/logout
│   │   ├── customers/
│   │   │   ├── route.ts           # GET, POST /api/customers
│   │   │   └── [code]/
│   │   │       └── route.ts       # GET, PUT, DELETE /api/customers/:code
│   │   ├── suppliers/
│   │   │   ├── route.ts
│   │   │   └── [code]/
│   │   │       └── route.ts
│   │   ├── quotations/
│   │   │   ├── route.ts
│   │   │   └── [date]/[no]/
│   │   │       └── route.ts
│   │   ├── orders/
│   │   │   ├── route.ts
│   │   │   └── [date]/[no]/
│   │   │       └── route.ts
│   │   ├── transactions/
│   │   │   ├── route.ts
│   │   │   ├── price-history/
│   │   │   │   └── route.ts
│   │   │   └── [date]/[no]/
│   │   │       └── route.ts
│   │   ├── purchase-statements/
│   │   │   ├── route.ts
│   │   │   └── [date]/[no]/
│   │   │       └── route.ts
│   │   ├── materials/
│   │   │   ├── route.ts
│   │   │   ├── [code]/
│   │   │   │   └── route.ts
│   │   │   └── [materialCode]/
│   │   │       ├── purchase-price-history/
│   │   │       │   └── [supplierCode]/
│   │   │       │       └── route.ts
│   │   │       └── order-history/
│   │   │           └── [supplierCode]/
│   │   │               └── route.ts
│   │   ├── inventory/
│   │   │   └── [workplace]/
│   │   │       └── route.ts
│   │   └── dashboard/
│   │       └── stats/
│   │           └── route.ts
│   ├── layout.tsx                 # 루트 레이아웃
│   └── globals.css                # 전역 스타일
├── components/
│   ├── ui/                        # shadcn/ui 컴포넌트
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── select.tsx
│   │   └── ... (기타 UI 컴포넌트)
│   ├── layout/
│   │   ├── Sidebar.tsx            # 사이드바 네비게이션
│   │   ├── Header.tsx             # 헤더
│   │   └── Footer.tsx             # 푸터
│   ├── customers/
│   │   ├── CustomerList.tsx       # 매출처 목록 컴포넌트
│   │   ├── CustomerForm.tsx       # 매출처 폼
│   │   └── CustomerTable.tsx      # 매출처 테이블
│   ├── suppliers/
│   │   ├── SupplierList.tsx
│   │   ├── SupplierForm.tsx
│   │   └── SupplierTable.tsx
│   ├── quotations/
│   │   ├── QuotationList.tsx
│   │   ├── QuotationForm.tsx
│   │   ├── QuotationDetailTable.tsx
│   │   └── QuotationStatusBadge.tsx
│   ├── orders/
│   │   ├── OrderList.tsx
│   │   ├── OrderForm.tsx
│   │   └── OrderDetailTable.tsx
│   ├── transactions/
│   │   ├── TransactionList.tsx
│   │   ├── TransactionForm.tsx
│   │   └── TransactionDetailTable.tsx
│   ├── materials/
│   │   ├── MaterialList.tsx
│   │   ├── MaterialForm.tsx
│   │   ├── MaterialSearchModal.tsx
│   │   └── MaterialTable.tsx
│   └── shared/
│       ├── DataTable.tsx          # 재사용 가능한 테이블 컴포넌트
│       ├── SearchInput.tsx
│       ├── DatePicker.tsx
│       ├── AddressSearchModal.tsx # 다음 우편번호 API
│       └── LoadingSpinner.tsx
├── lib/
│   ├── db.ts                      # 데이터베이스 연결 (mssql)
│   ├── auth.ts                    # 인증 헬퍼
│   ├── session.ts                 # 세션 관리
│   ├── utils.ts                   # 유틸리티 함수
│   └── constants.ts               # 상수 정의
├── hooks/
│   ├── useCustomers.ts            # 매출처 관련 훅
│   ├── useSuppliers.ts            # 매입처 관련 훅
│   ├── useQuotations.ts           # 견적서 관련 훅
│   ├── useOrders.ts               # 발주서 관련 훅
│   ├── useTransactions.ts         # 거래명세서 관련 훅
│   ├── useMaterials.ts            # 자재 관련 훅
│   └── useAuth.ts                 # 인증 관련 훅
├── types/
│   ├── customer.ts                # 매출처 타입 정의
│   ├── supplier.ts                # 매입처 타입 정의
│   ├── quotation.ts               # 견적서 타입 정의
│   ├── order.ts                   # 발주서 타입 정의
│   ├── transaction.ts             # 거래명세서 타입 정의
│   ├── material.ts                # 자재 타입 정의
│   ├── user.ts                    # 사용자 타입 정의
│   └── api.ts                     # API 응답 타입 정의
├── middleware.ts                  # Next.js 미들웨어 (인증)
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── .env.local
```

---

## 3단계: 기술 스택 변경사항

### 프론트엔드

| 현재 | Next.js |
|------|---------|
| jQuery | React (Next.js 내장) |
| DataTables | TanStack Table (React Table v8) 또는 shadcn/ui Table |
| Vanilla JavaScript | TypeScript |
| CSS 파일 | Tailwind CSS + CSS Modules |
| 다음 우편번호 API | 동일 (react-daum-postcode) |
| 모달 (직접 구현) | shadcn/ui Dialog 컴포넌트 |

### 백엔드

| 현재 | Next.js |
|------|---------|
| Express Routes | Next.js API Routes (App Router) |
| express-session | iron-session 또는 next-auth |
| bcrypt | 동일 (bcrypt 또는 bcryptjs) |
| mssql | 동일 (mssql 패키지 재사용) |
| CORS | Next.js 자체 처리 (next.config.js) |

### 상태 관리
- **로컬 상태**: React useState, useReducer
- **서버 상태**: TanStack Query (React Query)
- **전역 상태** (필요 시): Zustand 또는 Jotai

---

## 4단계: 마이그레이션 로드맵

### Phase 0: 사전 준비 (1주)
- [ ] Next.js 프로젝트 생성 (`npx create-next-app@latest`)
- [ ] TypeScript 타입 정의 작성
- [ ] shadcn/ui 설치 및 기본 컴포넌트 구성
- [ ] 데이터베이스 연결 설정 (lib/db.ts)
- [ ] 기본 레이아웃 및 사이드바 구현

### Phase 1: 인증 시스템 (1주)
- [ ] iron-session 또는 next-auth 설정
- [ ] 로그인 페이지 구현 (`app/(auth)/login/page.tsx`)
- [ ] 로그아웃 API 구현
- [ ] 미들웨어 인증 체크 (`middleware.ts`)
- [ ] 세션 관리 로직 이전

### Phase 2: 기본 CRUD - 매출처/매입처 (2주)
- [ ] 매출처 목록 페이지 (`app/(dashboard)/customers/page.tsx`)
- [ ] 매출처 등록/수정 폼 (`components/customers/CustomerForm.tsx`)
- [ ] 매출처 API Routes (`app/api/customers/route.ts`)
- [ ] 매입처 동일 구조로 구현
- [ ] 페이지네이션 구현 (TanStack Table)
- [ ] 검색 기능 구현

### Phase 3: 자재 관리 (1주)
- [ ] 자재 목록 페이지
- [ ] 자재 등록/수정 폼
- [ ] 자재 분류 관리
- [ ] 재고 현황 페이지
- [ ] 자재 검색 모달 컴포넌트

### Phase 4: 견적서 관리 (2주)
- [ ] 견적서 목록 페이지
- [ ] 견적서 작성 페이지 (마스터-디테일)
- [ ] 견적서 상세/수정 페이지
- [ ] 견적 상태 관리 (임시저장, 확정, 완료)
- [ ] 자재 선택 모달 통합
- [ ] 로그 테이블 번호 생성 로직

### Phase 5: 발주서 관리 (2주)
- [ ] 발주서 목록 페이지
- [ ] 발주서 작성 페이지
- [ ] 발주서 상세/수정 페이지
- [ ] 자재 가격 이력 조회 기능
- [ ] 매입처 연동

### Phase 6: 거래명세서 관리 (2주)
- [ ] 거래명세서 목록 페이지
- [ ] 거래명세서 작성 페이지
- [ ] 자재입출내역 테이블 연동 (입출고구분 = 2)
- [ ] CSV 내보내기 기능
- [ ] 가격 이력 조회 기능

### Phase 7: 매입전표 관리 (1주)
- [ ] 매입전표 목록 페이지
- [ ] 매입전표 작성 페이지
- [ ] 자재입출내역 테이블 연동 (입출고구분 = 1)
- [ ] 미지급금내역 자동 생성 로직

### Phase 8: 대시보드 및 통계 (1주)
- [ ] 대시보드 페이지
- [ ] 통계 API (`/api/dashboard/stats`)
- [ ] 차트 라이브러리 통합 (recharts 또는 Chart.js)

### Phase 9: 테스트 및 최적화 (2주)
- [ ] E2E 테스트 작성 (Playwright 또는 Cypress)
- [ ] API 단위 테스트
- [ ] 성능 최적화 (React.memo, useMemo, 코드 분할)
- [ ] 접근성 개선
- [ ] SEO 설정

### Phase 10: 배포 및 마이그레이션 (1주)
- [ ] 프로덕션 빌드 테스트
- [ ] Vercel 또는 자체 서버 배포
- [ ] 기존 시스템과 병렬 운영
- [ ] 데이터 검증 및 사용자 피드백
- [ ] 완전 전환

**총 예상 기간**: 약 3~4개월

---

## 5단계: 코드 마이그레이션 예시

### 예시 1: 매출처 목록 (Customer List)

#### 현재 (index.html + customer.js)
```javascript
// customer.js
function loadCustomers() {
  $.ajax({
    url: '/api/customers',
    method: 'GET',
    success: function(response) {
      $('#customerTable').DataTable({
        data: response.data,
        columns: [
          { data: '매출처코드' },
          { data: '매출처명' },
          { data: '대표자' },
          { data: '전화번호' }
        ]
      });
    }
  });
}
```

#### Next.js (app/(dashboard)/customers/page.tsx)
```typescript
// app/(dashboard)/customers/page.tsx
import { CustomerList } from '@/components/customers/CustomerList';

export default async function CustomersPage() {
  // 서버 컴포넌트에서 데이터 페칭
  const response = await fetch(`${process.env.API_URL}/api/customers`, {
    cache: 'no-store'
  });
  const data = await response.json();

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">매출처 관리</h1>
      <CustomerList initialData={data.data} total={data.total} />
    </div>
  );
}

// components/customers/CustomerList.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';

export function CustomerList({ initialData, total }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page],
    queryFn: () => fetch(`/api/customers?page=${page}`).then(r => r.json()),
    initialData: { data: initialData, total }
  });

  const columns = [
    { header: '매출처코드', accessorKey: '매출처코드' },
    { header: '매출처명', accessorKey: '매출처명' },
    { header: '대표자', accessorKey: '대표자' },
    { header: '전화번호', accessorKey: '전화번호' },
    {
      header: '작업',
      cell: ({ row }) => (
        <Button onClick={() => handleEdit(row.original.매출처코드)}>
          수정
        </Button>
      )
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={data.data}
      pagination={{
        page,
        total,
        onPageChange: setPage
      }}
    />
  );
}
```

### 예시 2: 견적서 작성 (Quotation Creation)

#### 현재 (quotation.js)
```javascript
// quotation.js
let newQuotationDetails = [];

function openQuotationModal() {
  newQuotationDetails = [];
  $('#quotationModal').modal('show');
}

function addMaterialToQuotation(material) {
  newQuotationDetails.push({
    자재코드: material.자재코드,
    수량: 1,
    단가: material.단가
  });
  refreshQuotationDetailTable();
}

function saveQuotation() {
  const data = {
    견적일자: $('#견적일자').val(),
    매출처코드: $('#매출처코드').val(),
    details: newQuotationDetails
  };

  $.ajax({
    url: '/api/quotations',
    method: 'POST',
    data: JSON.stringify(data),
    success: function() {
      alert('견적서가 저장되었습니다.');
      loadQuotations();
    }
  });
}
```

#### Next.js (app/(dashboard)/quotations/new/page.tsx)
```typescript
// app/(dashboard)/quotations/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { QuotationForm } from '@/components/quotations/QuotationForm';
import { QuotationDetailTable } from '@/components/quotations/QuotationDetailTable';
import { MaterialSearchModal } from '@/components/materials/MaterialSearchModal';
import { Button } from '@/components/ui/button';
import type { QuotationDetail } from '@/types/quotation';

export default function NewQuotationPage() {
  const router = useRouter();
  const [details, setDetails] = useState<QuotationDetail[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const createQuotation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create quotation');
      return response.json();
    },
    onSuccess: () => {
      router.push('/quotations');
    }
  });

  const handleAddMaterial = (material) => {
    setDetails([...details, {
      자재코드: material.자재코드,
      자재명: material.자재명,
      수량: 1,
      단가: material.단가,
      공급가액: material.단가
    }]);
    setIsModalOpen(false);
  };

  const handleSubmit = (formData) => {
    createQuotation.mutate({
      ...formData,
      details
    });
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">견적서 작성</h1>

      <QuotationForm onSubmit={handleSubmit} />

      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">견적 품목</h2>
          <Button onClick={() => setIsModalOpen(true)}>
            자재 추가
          </Button>
        </div>

        <QuotationDetailTable
          details={details}
          onUpdate={setDetails}
        />
      </div>

      <MaterialSearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleAddMaterial}
      />
    </div>
  );
}
```

### 예시 3: API Route 마이그레이션

#### 현재 (server.js)
```javascript
// server.js
app.get('/api/customers', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query('SELECT * FROM 매출처 WHERE 사용구분 = 0');

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

#### Next.js (app/api/customers/route.ts)
```typescript
// app/api/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // 인증 체크
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '25');

    const pool = await getDB();
    const result = await pool.request()
      .input('offset', (page - 1) * pageSize)
      .input('pageSize', pageSize)
      .query(`
        SELECT * FROM 매출처
        WHERE 사용구분 = 0
        ORDER BY 매출처코드
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `);

    const countResult = await pool.request()
      .query('SELECT COUNT(*) as total FROM 매출처 WHERE 사용구분 = 0');

    return NextResponse.json({
      success: true,
      data: result.recordset,
      total: countResult.recordset[0].total,
      currentPage: page,
      totalPages: Math.ceil(countResult.recordset[0].total / pageSize)
    });
  } catch (error) {
    console.error('Customers API error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const pool = await getDB();

    // 매출처 생성 로직...

    return NextResponse.json({
      success: true,
      message: '매출처가 등록되었습니다.'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
```

---

## 6단계: 주요 고려사항

### 1. 인증 및 세션
**현재**: express-session (메모리 기반)
**Next.js 옵션**:
- **iron-session**: 암호화된 쿠키 기반, 가볍고 빠름 (권장)
- **next-auth**: OAuth, 소셜 로그인 필요 시
- **JWT**: Stateless, 확장성 우수

**추천**: iron-session (현재 시스템과 유사한 세션 방식)

### 2. 데이터 페칭 전략
- **서버 컴포넌트**: 초기 데이터 로드 (SEO 향상)
- **클라이언트 컴포넌트**: 인터랙티브 기능
- **TanStack Query**: 캐싱, 낙관적 업데이트, 백그라운드 리페치

### 3. DataTables 대체
**옵션**:
- **TanStack Table (React Table v8)**: 유연성 높음, 커스터마이징 용이
- **shadcn/ui Table**: 기본 테이블 + 커스텀 로직
- **AG Grid**: 엔터프라이즈급 기능 (유료)

**추천**: TanStack Table + shadcn/ui 조합

### 4. 다음 우편번호 API
- **react-daum-postcode** 패키지 사용
- 모달 컴포넌트로 래핑하여 재사용

### 5. 한글 처리
- TypeScript 타입에 한글 필드명 사용 가능
- `tsconfig.json`에서 `"allowSyntheticDefaultImports": true` 설정

### 6. 배포 옵션
- **Vercel**: 가장 쉬운 배포, 서버리스
- **AWS EC2/Azure**: 기존 서버 활용
- **Docker**: 컨테이너화 배포

---

## 7단계: 패키지 및 의존성

### package.json (Next.js)
```json
{
  "name": "sales-management-nextjs",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tanstack/react-query": "^5.51.0",
    "@tanstack/react-table": "^8.17.0",
    "mssql": "^12.0.0",
    "bcrypt": "^6.0.0",
    "iron-session": "^8.0.0",
    "zod": "^3.23.0",
    "react-hook-form": "^7.52.0",
    "@hookform/resolvers": "^3.9.0",
    "date-fns": "^3.6.0",
    "react-daum-postcode": "^3.1.0",
    "recharts": "^2.12.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.395.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/mssql": "^9.1.0",
    "@types/bcrypt": "^5.0.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

---

## 8단계: 마이그레이션 체크리스트

### 사전 준비
- [ ] 현재 시스템의 모든 기능 문서화
- [ ] 데이터베이스 스키마 백업
- [ ] API 엔드포인트 목록 작성 (CLAUDE.md 참고)
- [ ] 사용자 플로우 다이어그램 작성

### 개발 환경
- [ ] Node.js 18+ 설치
- [ ] Next.js 프로젝트 생성
- [ ] TypeScript 설정
- [ ] ESLint, Prettier 설정
- [ ] Git 리포지토리 생성

### UI/UX
- [ ] shadcn/ui 설치 및 테마 설정
- [ ] 한글 폰트 적용 (Noto Sans KR 또는 Pretendard)
- [ ] 반응형 레이아웃 구현
- [ ] 다크 모드 지원 (선택사항)

### 데이터 레이어
- [ ] 데이터베이스 연결 헬퍼 (`lib/db.ts`)
- [ ] TypeScript 타입 정의 (모든 테이블)
- [ ] API 응답 포맷 표준화
- [ ] 에러 핸들링 유틸리티

### 보안
- [ ] 인증 미들웨어 구현
- [ ] 권한 체크 로직 (requireRole)
- [ ] SQL Injection 방지 (Parameterized Queries)
- [ ] XSS 방지 (React 자동 처리)
- [ ] CSRF 토큰 (iron-session 자동 처리)
- [ ] 환경 변수 관리 (.env.local)

### 테스트
- [ ] 유닛 테스트 (Jest + React Testing Library)
- [ ] API 통합 테스트
- [ ] E2E 테스트 (Playwright)
- [ ] 성능 테스트 (Lighthouse)

### 배포
- [ ] 프로덕션 빌드 테스트
- [ ] 환경 변수 설정 (프로덕션)
- [ ] 도메인 및 SSL 설정
- [ ] 모니터링 설정 (Sentry 등)

---

## 9단계: 리스크 및 대응 방안

### 리스크 1: 개발 기간 장기화
**대응**:
- MVP 우선 개발 (핵심 기능만 먼저)
- 병렬 개발 (팀원 역할 분담)
- 기존 시스템 유지하며 점진적 전환

### 리스크 2: 데이터 마이그레이션 실패
**대응**:
- 데이터베이스 스키마는 변경 없음 (그대로 사용)
- API 호환성 유지
- 충분한 테스트 기간 확보

### 리스크 3: 성능 저하
**대응**:
- 서버 컴포넌트 활용 (초기 로드 속도 개선)
- React Query 캐싱 활용
- 이미지 최적화 (Next.js Image 컴포넌트)
- Code splitting 적용

### 리스크 4: 사용자 적응 문제
**대응**:
- UI/UX 최대한 유사하게 유지
- 사용자 교육 자료 준비
- 피드백 수집 채널 마련

---

## 10단계: 참고 자료

### 공식 문서
- [Next.js 공식 문서](https://nextjs.org/docs)
- [React 공식 문서](https://react.dev/)
- [TanStack Query](https://tanstack.com/query/latest)
- [TanStack Table](https://tanstack.com/table/latest)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

### 마이그레이션 가이드
- [Next.js App Router 마이그레이션 가이드](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [jQuery to React 마이그레이션](https://react.dev/learn/add-react-to-an-existing-project)

### 한글 리소스
- [Next.js 한글 튜토리얼](https://nextjs.org/learn)
- [Vercel 한국어 블로그](https://vercel.com/blog)

---

## 결론

현재 프로젝트를 Next.js로 마이그레이션하는 것은 **충분히 실현 가능**하며, 다음과 같은 이점을 얻을 수 있습니다:

### 장점
✅ **현대적인 개발 경험**: TypeScript, React, Tailwind CSS
✅ **성능 향상**: 서버 컴포넌트, 자동 코드 분할, 이미지 최적화
✅ **유지보수성**: 컴포넌트 기반 아키텍처, 타입 안전성
✅ **SEO 개선**: 서버 사이드 렌더링
✅ **확장성**: 모듈화된 구조, 쉬운 기능 추가

### 단점
❌ **초기 개발 시간**: 3~4개월 예상
❌ **학습 곡선**: React, TypeScript, Next.js 학습 필요
❌ **리소스 투입**: 개발 인력 필요

### 최종 권장사항
- **점진적 마이그레이션** 방식 채택
- **MVP 우선** 개발 (로그인 + 매출처/매입처 + 견적서)
- **기존 시스템 병렬 운영** 후 단계적 전환
- **충분한 테스트 기간** 확보

이 가이드를 기반으로 프로젝트를 진행하시면, 안정적이고 현대적인 시스템으로 전환할 수 있습니다.

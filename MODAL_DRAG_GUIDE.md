# 모달 드래그 기능 구현 가이드

## 개요

거래명세서 작성/수정 모달창의 제목 부분을 마우스로 드래그하여 이동할 수 있는 기능입니다.

## 구현된 기능

### 1. 거래명세서 작성 모달
- **모달 ID**: `transactionCreateModal`
- **모달 컨텐츠 ID**: `transactionCreateModalContent`
- **드래그 핸들**: `transactionCreateModalHeader` (제목 영역)
- **동작**: 제목 영역을 마우스로 드래그하면 모달이 이동

### 2. 거래명세서 수정 모달
- **모달 ID**: `transactionEditModal`
- **모달 컨텐츠 ID**: `transactionEditModalContent`
- **드래그 핸들**: `transactionEditModalHeader` (제목 영역)
- **동작**: 제목 영역을 마우스로 드래그하면 모달이 이동

## 구현 세부사항

### 전역 함수: `makeModalDraggable()`

**위치**: [index.html:6828-6922](index.html#L6828-L6922)

**함수 시그니처**:
```javascript
window.makeModalDraggable = function(modalId, headerId)
```

**파라미터**:
- `modalId` (string): 드래그할 모달 컨테이너의 ID (외부 모달 div, 예: `transactionCreateModal`)
- `headerId` (string): 드래그 핸들로 사용할 헤더 영역의 ID (예: `transactionCreateModalHeader`)

**IMPORTANT**: `modalId`는 **외부 모달 컨테이너의 ID**를 전달해야 합니다 (`.modal` 클래스가 있는 div). 내부 컨텐츠 div ID가 아닙니다!

**주요 기능**:
1. 헤더 영역(`cursor: move`)을 드래그 핸들로 설정
2. 마우스 이벤트로 드래그 동작 구현
3. 버튼/입력필드 클릭 시 드래그 방지
4. 모달 닫힐 때 위치 자동 초기화

### HTML 구조 요구사항

#### 거래명세서 작성 모달 ([index.html:4802-4852](index.html#L4802-L4852))

```html
<!-- 모달 컨테이너 (이 ID를 makeModalDraggable에 전달!) -->
<div id="transactionCreateModal" class="modal">
  <!-- 드래그 가능한 모달 컨텐츠 -->
  <div id="transactionCreateModalContent" class="modal-content">

    <!-- 드래그 핸들 (헤더) -->
    <div id="transactionCreateModalHeader" style="cursor: move; user-select: none;">
      <h2>거래명세서 작성</h2>
      <button onclick="closeTransactionCreateModal()">×</button>
    </div>

    <!-- 폼 내용 -->
    <form>...</form>
  </div>
</div>
```

**필수 스타일**:
- `modal`: `.modal` 클래스 필요 (외부 컨테이너)
- `modalContent`: `.modal-content` 클래스 필요
- `header`: `cursor: move`, `user-select: none` (드래그 UX)

**중요**: `modalContent`에 `position: relative`를 인라인 스타일로 지정하지 마세요! JavaScript가 자동으로 `position: absolute`로 설정합니다.

#### 거래명세서 수정 모달 ([index.html:3903-3951](index.html#L3903-L3951))

동일한 패턴:
- 외부 모달 ID: `transactionEditModal` ← makeModalDraggable에 전달
- 컨텐츠 ID: `transactionEditModalContent`
- 헤더 ID: `transactionEditModalHeader`

---

### JavaScript 초기화

**위치**: [js/transaction.js:393-397](js/transaction.js#L393-L397) (작성 모달), [js/transaction.js:982-986](js/transaction.js#L982-L986) (수정 모달)

```javascript
// 거래명세서 작성 모달 열기 함수 내부
function openNewTransactionModal() {
  // ... 모달 초기화 코드 ...

  // 모달 표시
  document.getElementById('transactionCreateModal').style.display = 'block';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.transactionCreateModalDraggable) {
    makeModalDraggable('transactionCreateModal', 'transactionCreateModalHeader');
    window.transactionCreateModalDraggable = true;
  }
}

// 거래명세서 수정 모달 열기 함수 내부
async function editTransaction(거래일자, 거래번호) {
  // ... 데이터 로드 및 모달 초기화 코드 ...

  // 모달 열기
  const modal = document.getElementById('transactionEditModal');
  modal.style.display = 'flex';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.transactionEditModalDraggable) {
    makeModalDraggable('transactionEditModal', 'transactionEditModalHeader');
    window.transactionEditModalDraggable = true;
  }
}
```

**중요**:
- **모달을 열 때마다** 드래그 기능 초기화 호출 (견적서 패턴과 동일)
- 전역 플래그(`window.transactionCreateModalDraggable`)로 중복 초기화 방지
- `typeof` 체크로 함수 존재 여부 확인 (에러 방지)
- **외부 모달 컨테이너 ID** 전달 (`.modal` 클래스가 있는 div)

---

## 드래그 동작 설명

### 1. 드래그 시작 (mousedown)
```javascript
function dragStart(e) {
  // 버튼이나 입력 필드 클릭 시 드래그 방지
  if (
    e.target.tagName === 'BUTTON' ||
    e.target.tagName === 'INPUT' ||
    e.target.tagName === 'TEXTAREA' ||
    e.target.tagName === 'SELECT'
  ) {
    return; // 드래그 안 됨
  }

  // 드래그 시작 위치 기록
  initialX = e.clientX - xOffset;
  initialY = e.clientY - yOffset;

  if (e.target === dragHandle || dragHandle.contains(e.target)) {
    isDragging = true;
  }
}
```

**드래그 방지 요소**:
- `BUTTON` (닫기 버튼 등)
- `INPUT` (입력 필드)
- `TEXTAREA` (텍스트 영역)
- `SELECT` (드롭다운)

**이유**: 사용자가 폼 요소를 조작할 때 모달이 움직이지 않도록 방지

---

### 2. 드래그 중 (mousemove)
```javascript
function drag(e) {
  if (isDragging) {
    e.preventDefault(); // 텍스트 선택 방지

    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    xOffset = currentX;
    yOffset = currentY;

    // CSS transform으로 이동
    setTranslate(currentX, currentY, modalContent);
  }
}

function setTranslate(xPos, yPos, el) {
  el.style.transform = `translate(${xPos}px, ${yPos}px)`;
}
```

**transform 사용 이유**:
- GPU 가속으로 부드러운 애니메이션
- top/left 변경보다 성능 우수
- Reflow 없이 Repaint만 발생

---

### 3. 드래그 종료 (mouseup)
```javascript
function dragEnd(e) {
  initialX = currentX;
  initialY = currentY;
  isDragging = false;
}
```

**상태 저장**:
- 현재 위치를 저장하여 다음 드래그 시 이어서 이동 가능

---

### 4. 위치 초기화 (모달 닫을 때)
```javascript
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'style') {
      if (modal.style.display === 'none') {
        xOffset = 0;
        yOffset = 0;
        modalContent.style.transform = 'translate(0px, 0px)';
      }
    }
  });
});

observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
```

**MutationObserver 사용**:
- 모달의 `display: none` 감지
- 모달이 닫힐 때 자동으로 위치 초기화 (중앙으로 복귀)

---

## 다른 모달에 적용하기

### 1. HTML 구조 준비
```html
<div id="myModal" class="modal">
  <div id="myModalContent" class="modal-content" style="position: relative;">
    <div id="myModalHeader" style="cursor: move; user-select: none;">
      <h2>모달 제목</h2>
      <button onclick="closeModal()">×</button>
    </div>
    <!-- 내용 -->
  </div>
</div>
```

### 2. JavaScript 초기화
```javascript
document.addEventListener('DOMContentLoaded', () => {
  if (typeof makeModalDraggable === 'function') {
    makeModalDraggable('myModalContent', 'myModalHeader');
  }
});
```

### 3. 필수 조건
- ✅ 모달 컨텐츠에 `position: relative` 스타일
- ✅ 헤더에 `cursor: move`, `user-select: none` 스타일
- ✅ 고유한 ID 사용 (중복 방지)

---

## 사용 예시

### 견적서 모달에 적용 (예시)
```javascript
// quotation.js
document.addEventListener('DOMContentLoaded', () => {
  if (typeof makeModalDraggable === 'function') {
    makeModalDraggable('quotationCreateModalContent', 'quotationCreateModalHeader');
    makeModalDraggable('quotationEditModalContent', 'quotationEditModalHeader');
  }
});
```

### 발주서 모달 (이미 구현됨)
[js/order.js](js/order.js) 파일에 자체 `makeModalDraggable` 함수가 구현되어 있습니다.

---

## 브라우저 호환성

### 지원 브라우저
- ✅ Chrome/Edge (최신)
- ✅ Firefox (최신)
- ✅ Safari (최신)

### 필요한 Web API
- `mousedown`, `mousemove`, `mouseup` 이벤트
- `MutationObserver` API
- CSS `transform` 속성

**모든 모던 브라우저에서 완벽 지원**

---

## 테스트 방법

### 1. 거래명세서 작성 모달 테스트
1. 거래명세서 관리 페이지 이동
2. **"거래명세서 작성"** 버튼 클릭
3. 모달이 열리면 **제목 영역**을 마우스로 클릭
4. 마우스를 움직이면 모달이 함께 이동
5. 모달 닫기 후 다시 열면 중앙 위치로 복귀 확인

### 2. 거래명세서 수정 모달 테스트
1. 거래명세서 목록에서 **"수정"** 버튼 클릭
2. 수정 모달이 열리면 **제목 영역** 드래그
3. 위치 이동 확인

### 3. 폼 요소 테스트
1. 모달 내부의 **입력 필드** 클릭
   - ✅ 드래그 안 되고 입력 가능해야 함
2. **버튼** 클릭
   - ✅ 드래그 안 되고 버튼 동작해야 함
3. **제목 영역**(h2) 클릭
   - ✅ 드래그 되어야 함

### 4. 위치 초기화 테스트
1. 모달을 화면 오른쪽 하단으로 드래그
2. 모달 닫기
3. 모달 다시 열기
   - ✅ 중앙 위치로 복귀해야 함

---

## 문제 해결

### 문제: 모달이 드래그 안 됨

**원인 1**: `makeModalDraggable` 함수가 정의되지 않음
```javascript
// 콘솔에서 확인
typeof window.makeModalDraggable
// "function"이 출력되어야 함
```

**해결**: [index.html:6828](index.html#L6828)에 함수가 정의되어 있는지 확인

---

**원인 2**: ID가 잘못됨
```javascript
// 콘솔에서 확인
document.getElementById('transactionCreateModalContent')
// null이 아니어야 함
```

**해결**: HTML의 ID가 올바른지 확인

---

**원인 3**: `DOMContentLoaded` 이전에 호출
```javascript
// 잘못된 예
makeModalDraggable('myModalContent', 'myModalHeader'); // DOM 로드 전

// 올바른 예
document.addEventListener('DOMContentLoaded', () => {
  makeModalDraggable('myModalContent', 'myModalHeader');
});
```

---

### 문제: 드래그 시 버튼도 같이 눌림

**원인**: `dragStart` 함수의 요소 체크 로직이 누락됨

**해결**: 버튼/입력필드 클릭 시 `return` 확인
```javascript
if (e.target.tagName === 'BUTTON') {
  return; // 이 부분 확인
}
```

---

### 문제: 모달 닫아도 위치 안 초기화됨

**원인**: MutationObserver가 작동하지 않음

**해결 1**: 모달이 `display: none`으로 닫히는지 확인
```javascript
// 콘솔에서 확인
const modal = document.getElementById('transactionCreateModal');
console.log(modal.style.display); // "none"이어야 함
```

**해결 2**: `closest('.modal')` 호출이 실패하는 경우
```javascript
const modal = modalContent.closest('.modal');
console.log(modal); // null이 아니어야 함
```

---

## 성능 최적화

### 1. Transform 사용
```javascript
// ✅ 좋음: GPU 가속, Repaint만 발생
el.style.transform = `translate(${xPos}px, ${yPos}px)`;

// ❌ 나쁨: Reflow + Repaint 발생, 느림
el.style.top = `${yPos}px`;
el.style.left = `${xPos}px`;
```

### 2. 이벤트 위임
```javascript
// document에 한 번만 이벤트 등록
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', dragEnd);
```

### 3. preventDefault로 텍스트 선택 방지
```javascript
function drag(e) {
  if (isDragging) {
    e.preventDefault(); // 텍스트 선택 안 됨
    // ...
  }
}
```

---

## 향후 개선 사항

### 1. 화면 경계 제한
모달이 화면 밖으로 나가지 않도록 제한:
```javascript
function drag(e) {
  if (isDragging) {
    e.preventDefault();

    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    // 화면 경계 체크
    const rect = modalContent.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    currentX = Math.max(0, Math.min(currentX, maxX));
    currentY = Math.max(0, Math.min(currentY, maxY));

    xOffset = currentX;
    yOffset = currentY;

    setTranslate(currentX, currentY, modalContent);
  }
}
```

### 2. 터치 이벤트 지원 (모바일)
```javascript
dragHandle.addEventListener('touchstart', dragStart);
document.addEventListener('touchmove', drag);
document.addEventListener('touchend', dragEnd);
```

### 3. 더블클릭으로 위치 초기화
```javascript
dragHandle.addEventListener('dblclick', () => {
  xOffset = 0;
  yOffset = 0;
  modalContent.style.transform = 'translate(0px, 0px)';
});
```

---

## 요약

✅ **구현 완료**:
1. `makeModalDraggable()` 전역 함수 정의 ([index.html:6828-6922](index.html#L6828-L6922))
2. 거래명세서 작성 모달 드래그 활성화
3. 거래명세서 수정 모달 드래그 활성화
4. 버튼/입력필드 클릭 시 드래그 방지
5. 모달 닫을 때 위치 자동 초기화

✅ **사용자 경험**:
- 제목 영역을 드래그하면 모달 이동
- 폼 요소는 정상 동작 (드래그 안 됨)
- 모달 닫으면 중앙 위치로 복귀
- 부드러운 애니메이션 (GPU 가속)

✅ **확장 가능**:
- 다른 모달에 쉽게 적용 가능
- 일관된 사용자 경험

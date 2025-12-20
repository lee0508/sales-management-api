/**
 * 모달 드래그 기능
 * 모달 헤더를 드래그하여 모달 위치를 이동할 수 있게 만듭니다.
 *
 * @param {string} modalId - 모달의 ID (예: 'supplierModal')
 * @param {string} headerId - 드래그 핸들로 사용할 헤더의 ID (예: 'supplierModalHeader')
 */
function makeModalDraggable(modalId, headerId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const modalContent = modal.querySelector('.modal-content');
  if (!modalContent) return;

  let isDragging = false;
  let hasMoved = false; // ✅ 실제로 드래그가 시작되었는지 추적
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let startX; // ✅ 마우스 다운 시작 위치
  let startY;
  let xOffset = 0;
  let yOffset = 0;
  const dragThreshold = 5; // ✅ 드래그로 인식하기 위한 최소 이동 거리 (픽셀)

  // 헤더 영역을 드래그 핸들로 설정
  let dragHandle;
  if (headerId.startsWith('.')) {
    dragHandle = modalContent.querySelector(headerId);
  } else {
    dragHandle = document.getElementById(headerId);
  }

  if (!dragHandle) {
    // 헤더가 없으면 모달 컨텐츠 전체를 드래그 가능하게
    dragHandle = modalContent;
  }

  // ✅ 모달이 중앙 정렬 방식(absolute + translate(-50%, -50%))을 사용하는지 확인
  const computedStyle = window.getComputedStyle(modalContent);
  const isAbsoluteCentered =
    computedStyle.position === 'absolute' &&
    (computedStyle.left === '50%' || modalContent.style.left === '50%');

  // ✅ 초기 위치 설정 (이미 position이 설정되어 있으면 유지)
  if (!modalContent.style.position || modalContent.style.position === '') {
    modalContent.style.position = 'relative';
    modalContent.style.margin = '50px auto';
  }

  dragHandle.style.cursor = 'move';

  dragHandle.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    // 버튼이나 입력 필드 클릭 시 드래그 방지
    if (
      e.target.tagName === 'BUTTON' ||
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'SELECT'
    ) {
      return;
    }

    if (e.target === dragHandle || dragHandle.contains(e.target)) {
      startX = e.clientX;
      startY = e.clientY;
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      isDragging = true;
      hasMoved = false; // ✅ 아직 드래그 시작 안됨
    }
  }

  function drag(e) {
    if (isDragging) {
      // ✅ 마우스가 일정 거리 이상 이동했을 때만 실제 드래그 시작
      const deltaX = Math.abs(e.clientX - startX);
      const deltaY = Math.abs(e.clientY - startY);

      if (!hasMoved && (deltaX > dragThreshold || deltaY > dragThreshold)) {
        hasMoved = true; // ✅ 이제 드래그로 인정
      }

      if (hasMoved) {
        e.preventDefault();

        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, modalContent);
      }
    }
  }

  function dragEnd(e) {
    if (hasMoved) {
      initialX = currentX;
      initialY = currentY;
    }
    isDragging = false;
    hasMoved = false;
  }

  function setTranslate(xPos, yPos, el) {
    // ✅ 중앙 정렬 방식에 따라 transform 적용
    if (isAbsoluteCentered) {
      // position: absolute; left: 50%; top: 50% 방식
      el.style.transform = `translate(calc(-50% + ${xPos}px), calc(-50% + ${yPos}px))`;
    } else {
      // margin: auto 방식 (상대 위치만 이동)
      el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }
  }

  // 모달이 닫힐 때 위치 초기화
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style') {
        if (modal.style.display === 'none') {
          xOffset = 0;
          yOffset = 0;
          // ✅ 중앙 정렬 방식에 따라 초기화
          if (isAbsoluteCentered) {
            modalContent.style.transform = 'translate(-50%, -50%)';
          } else {
            modalContent.style.transform = 'translate(0px, 0px)';
          }
        }
      }
    });
  });

  observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
}

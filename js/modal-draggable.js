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
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

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

  // 초기 위치 설정 (중앙)
  modalContent.style.position = 'relative';
  modalContent.style.margin = '50px auto';

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

    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === dragHandle || dragHandle.contains(e.target)) {
      isDragging = true;
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();

      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      setTranslate(currentX, currentY, modalContent);
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(${xPos}px, ${yPos}px)`;
  }

  // 모달이 닫힐 때 위치 초기화
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
}

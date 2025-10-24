// 다음 우편번호 검색 함수
// prefix: 'supplier' 또는 '' (기본값: '' - 매출처용)
function execDaumPostcode(prefix = '') {
  console.log('우편번호 검색 시작 - prefix:', prefix);

  new daum.Postcode({
    oncomplete: function (data) {
      var addr = ''; // 주소 변수
      var extraAddr = ''; // 참고항목 변수

      // 사용자가 선택한 주소 타입에 따라 해당 주소 값을 가져온다.
      if (data.userSelectedType === 'R') {
        // 도로명 주소
        addr = data.roadAddress;
      } else {
        // 지번 주소
        addr = data.jibunAddress;
      }

      // 사용자가 선택한 주소가 도로명 타입일 때 참고항목을 조합한다.
      if (data.userSelectedType === 'R') {
        // 법정동명이 있을 경우 추가한다.
        if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
          extraAddr += data.bname;
        }
        // 건물명이 있고, 공동주택일 경우 추가한다.
        if (data.buildingName !== '' && data.apartment === 'Y') {
          extraAddr += extraAddr !== '' ? ', ' + data.buildingName : data.buildingName;
        }
        // 표시할 참고항목이 있을 경우, 괄호까지 추가한 최종 문자열을 만든다.
        if (extraAddr !== '') {
          extraAddr = ' (' + extraAddr + ')';
        }
      }

      // 동적으로 필드 ID 생성
      const extraAddressId = prefix ? `${prefix}ExtraAddress` : 'extraAddress';
      const zipCodeId = prefix ? `${prefix}ZipCode` : 'zipCode';
      const addressId = prefix ? `${prefix}Address` : 'address';
      const addressDetailId = prefix ? `${prefix}AddressDetail` : 'addressDetail';

      console.log('필드 ID:', { extraAddressId, zipCodeId, addressId, addressDetailId });

      // 조합된 참고항목을 해당 필드에 넣는다.
      const extraAddressEl = document.getElementById(extraAddressId);
      if (extraAddressEl) {
        extraAddressEl.value = extraAddr;
      }

      // 우편번호와 주소 정보를 해당 필드에 넣는다.
      const zipCodeEl = document.getElementById(zipCodeId);
      const addressEl = document.getElementById(addressId);
      const addressDetailEl = document.getElementById(addressDetailId);

      if (zipCodeEl) zipCodeEl.value = data.zonecode;
      if (addressEl) addressEl.value = addr;

      console.log('✅ 주소 입력 완료:', { zipCode: data.zonecode, address: addr });

      // 커서를 상세주소 필드로 이동한다.
      if (addressDetailEl) addressDetailEl.focus();
    },
  }).open();
}

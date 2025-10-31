import re
import os

# 수정할 파일 목록
files = [
    'js/transaction.js',
    'js/purchase.js',
    'js/quotation.js',
    'js/order.js'
]

def add_credentials_to_fetch(content):
    """fetch 호출에 credentials: 'include' 추가"""

    # Pattern 1: Simple fetch without options
    # fetch('url') -> fetch('url', { credentials: 'include' })
    pattern1 = r"(fetch\([^,)]+)\);"

    def replace1(match):
        full_match = match.group(0)
        # 이미 credentials가 있으면 건너뜀
        if 'credentials' in full_match:
            return full_match
        return match.group(1) + ", { credentials: 'include' });"

    content = re.sub(pattern1, replace1, content)

    # Pattern 2: fetch with method but no credentials
    # Multiline pattern to handle fetch with options object
    lines = content.split('\n')
    result_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # fetch 호출 시작 감지
        if 'await fetch(' in line and 'credentials' not in line:
            result_lines.append(line)
            i += 1

            # 다음 몇 줄에 credentials가 있는지 확인
            has_credentials = False
            check_end = min(i + 10, len(lines))
            for j in range(i, check_end):
                if 'credentials:' in lines[j]:
                    has_credentials = True
                    break
                if ');' in lines[j] and '{' not in lines[j]:
                    break

            if has_credentials:
                # 이미 있으면 그대로 진행
                continue

            # headers 다음에 credentials 추가
            while i < len(lines):
                current_line = lines[i]
                result_lines.append(current_line)

                # headers 객체 끝 찾기
                if "'Content-Type':" in current_line or '"Content-Type":' in current_line:
                    # 다음 줄 확인
                    if i + 1 < len(lines) and '},'.strip() in lines[i + 1]:
                        result_lines.append(lines[i + 1])
                        # credentials 추가
                        indent = ' ' * (len(lines[i + 1]) - len(lines[i + 1].lstrip()))
                        result_lines.append(f"{indent}credentials: 'include', // 세션 쿠키 포함")
                        i += 2
                        continue

                # method 다음에 추가할 수도 있음
                if 'method:' in current_line and i + 1 < len(lines):
                    next_line = lines[i + 1]
                    if 'headers:' in next_line:
                        # 괜찮음, headers 다음에 추가될 것
                        i += 1
                        continue

                # fetch 호출 끝
                if '});' in current_line:
                    break

                i += 1
            i += 1
        else:
            result_lines.append(line)
            i += 1

    return '\n'.join(result_lines)

# 각 파일 처리
for file_path in files:
    full_path = os.path.join(os.path.dirname(__file__), file_path)

    if not os.path.exists(full_path):
        print(f"❌ 파일 없음: {file_path}")
        continue

    print(f"🔄 처리 중: {file_path}")

    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # credentials가 하나도 없는 경우에만 수정
    if content.count("credentials: 'include'") < 5:  # 5개 미만이면 수정 필요
        modified_content = add_credentials_to_fetch(content)

        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(modified_content)

        count = modified_content.count("credentials: 'include'") - content.count("credentials: 'include'")
        print(f"✅ 완료: {count}개 추가")
    else:
        print(f"⏭️  이미 적용됨")

print("\n✅ 모든 파일 처리 완료!")

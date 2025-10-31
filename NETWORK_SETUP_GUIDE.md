# 판매관리 시스템 - 네트워크 설치 가이드

## 개요
제이씨엠전기와 같이 내부 네트워크 환경에서 여러 대의 컴퓨터가 하나의 서버를 공유하여 판매관리 시스템을 사용하는 방법을 안내합니다.

---

## 시스템 구성

```
┌─────────────────────────────────────────────────────────┐
│  서버 컴퓨터 (192.168.0.100 예시)                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  SQL Server (포트 1433)                           │  │
│  │  - 데이터베이스: YmhDB                             │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  XAMPP                                            │  │
│  │  - Apache (포트 8000)                             │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Node.js (포트 3000)                              │  │
│  │  - REST API 서버                                  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        ↓
              ┌─────────────────┐
              │  내부 네트워크   │
              └─────────────────┘
         ↓           ↓           ↓
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ PC #1    │ │ PC #2    │ │ PC #3    │
  │ 웹브라우저│ │ 웹브라우저│ │ 웹브라우저│
  └──────────┘ └──────────┘ └──────────┘
```

---

## 1단계: 서버 컴퓨터 IP 주소 확인

### Windows에서 IP 확인
1. **시작 메뉴** → **명령 프롬프트(cmd)** 실행
2. 다음 명령어 입력:
   ```cmd
   ipconfig
   ```
3. 결과 확인:
   ```
   이더넷 어댑터 로컬 영역 연결:
      IPv4 주소 . . . . . . . . . : 192.168.0.100
      서브넷 마스크 . . . . . . . : 255.255.255.0
      기본 게이트웨이 . . . . . . : 192.168.0.1
   ```
4. **IPv4 주소를 메모**하세요 (예: `192.168.0.100`)

> **중요**: 이 IP 주소는 예시입니다. 실제 환경에 맞게 확인하세요.

---

## 2단계: SQL Server 네트워크 접근 허용

### A. SQL Server 네트워크 설정
1. **SQL Server Configuration Manager** 실행
2. **SQL Server 네트워크 구성** → **MSSQLSERVER용 프로토콜** 선택
3. **TCP/IP** 프로토콜 **사용** 설정
4. TCP/IP 속성에서:
   - **IP 주소** 탭 → **IPALL** 섹션
   - **TCP 포트**: `1433` 확인
5. **SQL Server 서비스 재시작**

### B. SQL Server 인증 모드 확인
1. **SQL Server Management Studio (SSMS)** 실행
2. 서버 우클릭 → **속성** → **보안**
3. **SQL Server 및 Windows 인증 모드** 선택
4. SQL Server 서비스 재시작

### C. 방화벽 설정
**Windows 방화벽에서 포트 열기:**
```cmd
# 관리자 권한으로 명령 프롬프트 실행 후:

# SQL Server 포트 (1433)
netsh advfirewall firewall add rule name="SQL Server" dir=in action=allow protocol=TCP localport=1433

# Apache 포트 (8000)
netsh advfirewall firewall add rule name="Apache HTTP" dir=in action=allow protocol=TCP localport=8000

# Node.js API 포트 (3000)
netsh advfirewall firewall add rule name="Node.js API" dir=in action=allow protocol=TCP localport=3000
```

---

## 3단계: XAMPP Apache 설정

### A. Apache 네트워크 접근 허용
1. **XAMPP Control Panel** 실행
2. **Apache** 옆의 **Config** 버튼 클릭 → **httpd.conf** 선택
3. 다음 설정 찾아서 수정:

**변경 전:**
```apache
Listen 127.0.0.1:8000
```

**변경 후:**
```apache
Listen 0.0.0.0:8000
```

4. 파일 저장 후 **Apache 재시작**

### B. 가상 호스트 설정 확인
**httpd-vhosts.conf** 파일에서:
```apache
<VirtualHost *:8000>
    DocumentRoot "c:/xampp/htdocs"
    ServerName localhost

    <Directory "c:/xampp/htdocs">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

---

## 4단계: Node.js 서버 설정

### A. .env 파일 수정
`c:\xampp\htdocs\sales-management-api\.env` 파일을 열어서 수정:

**변경 전:**
```env
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:8000
```

**변경 후 (서버 IP를 실제 IP로 변경):**
```env
# 예: 서버 IP가 192.168.0.100인 경우
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:8000,http://192.168.0.100:8000
```

### B. 데이터베이스 연결 확인
`.env` 파일에서 DB 설정이 올바른지 확인:
```env
DB_USER=sa
DB_PASSWORD=your_password
DB_SERVER=localhost
DB_DATABASE=YmhDB
DB_PORT=1433
```

### C. 서버 시작
```cmd
# 프로젝트 디렉토리로 이동
cd c:\xampp\htdocs\sales-management-api

# Node.js 서버 시작
npm start
```

**정상 실행 시 출력:**
```
✅ Database connected: YmhDB
✅ Server running at http://0.0.0.0:3000
✅ Network access available at http://<SERVER_IP>:3000
✅ Static files served from project root (index.html 포함)
```

---

## 5단계: 클라이언트 컴퓨터에서 접속

### A. 웹 브라우저 접속
클라이언트 PC에서 웹 브라우저를 열고 다음 주소로 접속:

```
http://192.168.0.100:8000/sales-management-api/
```

> **주의**: `192.168.0.100`을 실제 서버 IP로 변경하세요!

### B. 로그인
- **사용자 ID**: 사용자 코드 입력 (예: `0001`)
- **비밀번호**: 해당 사용자 비밀번호

---

## 6단계: 연결 테스트

### 서버에서 테스트
```cmd
# 데이터베이스 연결 테스트
node scripts/test-db.js

# API 엔드포인트 테스트 (새 명령 프롬프트)
curl http://localhost:3000/api/workplaces
```

### 클라이언트에서 테스트
1. 웹 브라우저에서 개발자 도구 열기 (F12)
2. **Console** 탭 확인
3. 에러 메시지가 없으면 정상 연결

---

## 문제 해결 (Troubleshooting)

### 문제 1: "사이트에 연결할 수 없음"
**원인**: 방화벽 또는 네트워크 설정 문제

**해결 방법**:
1. 서버 컴퓨터에서 방화벽 규칙 확인
   ```cmd
   netsh advfirewall firewall show rule name=all | findstr "8000"
   ```
2. 포트가 열려 있는지 확인:
   ```cmd
   netstat -an | findstr "8000"
   netstat -an | findstr "3000"
   ```
3. Windows 방화벽에서 수동으로 포트 허용:
   - **제어판** → **Windows Defender 방화벽** → **고급 설정**
   - **인바운드 규칙** → **새 규칙** → **포트** 선택
   - **TCP 8000, 3000** 포트 추가

### 문제 2: "CORS 오류"
**오류 메시지**: `Access to fetch at ... from origin ... has been blocked by CORS policy`

**해결 방법**:
1. `.env` 파일에서 `ALLOWED_ORIGINS`에 클라이언트 접속 주소 추가
2. Node.js 서버 재시작
   ```cmd
   # Ctrl+C로 서버 종료 후
   npm start
   ```

### 문제 3: "데이터베이스 연결 실패"
**오류 메시지**: `Failed to connect to SQL Server`

**해결 방법**:
1. SQL Server가 실행 중인지 확인:
   ```cmd
   services.msc
   ```
   → **SQL Server (MSSQLSERVER)** 서비스 상태 확인
2. TCP/IP 프로토콜이 활성화되어 있는지 확인
3. 방화벽에서 포트 1433이 열려 있는지 확인

### 문제 4: Apache 시작 실패
**오류**: `Port 8000 in use by ...`

**해결 방법**:
1. 포트 사용 중인 프로세스 확인:
   ```cmd
   netstat -ano | findstr "8000"
   ```
2. 프로세스 종료 또는 다른 포트 사용

---

## 보안 권장 사항

### 1. 강력한 비밀번호 사용
- SQL Server `sa` 계정 비밀번호 변경
- 사용자 계정 비밀번호 정기적 변경

### 2. 방화벽 규칙 최소화
- 필요한 포트만 개방
- 특정 IP 범위만 허용 (선택사항)

### 3. HTTPS 사용 (프로덕션 환경)
- SSL 인증서 설치
- Node.js 및 Apache HTTPS 설정

### 4. 정기 백업
- SQL Server 데이터베이스 자동 백업 설정
- 주기: 매일 또는 주 단위

---

## 성능 최적화

### 1. SQL Server 연결 풀링
현재 설정 (server.js):
```javascript
pool: {
  max: 10,      // 최대 연결 수
  min: 0,       // 최소 연결 수
  idleTimeoutMillis: 30000
}
```

동시 사용자가 많으면 `max` 값을 증가 (예: 20)

### 2. Apache 성능 설정
`httpd.conf`에서:
```apache
# 동시 접속 수 증가
MaxRequestWorkers 150

# Keep-Alive 활성화
KeepAlive On
MaxKeepAliveRequests 100
KeepAliveTimeout 5
```

---

## 추가 참고 사항

### 고정 IP 설정 권장
- DHCP 사용 시 서버 IP가 변경될 수 있음
- 네트워크 어댑터 속성에서 **고정 IP** 설정 권장

### 네트워크 프린터처럼 사용
- 모든 클라이언트 PC에서 브라우저 즐겨찾기에 서버 주소 추가
- 예: `http://192.168.0.100:8000/sales-management-api/`

### 원격 접속 (외부망)
- 공인 IP 또는 도메인 필요
- 포트 포워딩 설정 필요
- VPN 또는 보안 솔루션 권장

---

## 체크리스트

설치 전 확인사항:
- [ ] 서버 컴퓨터 IP 주소 확인
- [ ] SQL Server 설치 및 YmhDB 데이터베이스 생성
- [ ] XAMPP 설치 (Apache, PHP)
- [ ] Node.js 설치 (v18 이상 권장)
- [ ] 프로젝트 파일 복사 (`c:\xampp\htdocs\sales-management-api\`)

설정 확인사항:
- [ ] SQL Server TCP/IP 활성화
- [ ] 방화벽 포트 개방 (1433, 8000, 3000)
- [ ] Apache `Listen 0.0.0.0:8000` 설정
- [ ] `.env` 파일 수정 (ALLOWED_ORIGINS)
- [ ] Node.js 서버 정상 실행

클라이언트 테스트:
- [ ] 클라이언트 PC에서 `http://서버IP:8000/sales-management-api/` 접속
- [ ] 로그인 성공
- [ ] 대시보드 데이터 정상 표시
- [ ] 견적서/발주서 등록 및 조회 테스트

---

## 연락처 및 지원

문제 발생 시:
1. 서버 컴퓨터에서 `npm start` 콘솔 로그 확인
2. 클라이언트 브라우저 개발자 도구 (F12) 에러 확인
3. 본 가이드의 **문제 해결** 섹션 참조

---

**문서 작성일**: 2025-10-30
**시스템 버전**: v1.0
**적용 대상**: 제이씨엠전기 및 내부 네트워크 환경

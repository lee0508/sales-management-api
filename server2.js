// server.js - 메인 서버 파일
const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
const PORT = 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SQL Server 연결 설정
const dbConfig = {
    user: 'sa',
    password: 'Dlehdgus0508@1',
    server: 'localhost', // 또는 실제 서버 IP
    database: 'YmhDB',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// 데이터베이스 연결 풀
let pool;

// 데이터베이스 연결 함수
async function connectDB() {
    try {
        pool = await sql.connect(dbConfig);
        console.log('✅ SQL Server 연결 성공');
        return pool;
    } catch (err) {
        console.error('❌ SQL Server 연결 실패:', err);
        throw err;
    }
}

// ==================== 인증 API ====================

// 로그인
app.post('/api/auth/login', async (req, res) => {
    try {
        const { userId, password } = req.body;
        
        if (!userId || !password) {
            return res.status(400).json({
                success: false,
                message: '아이디와 비밀번호를 입력해주세요.'
            // ==================== 자재 API ====================
}
        
        // 사용자 테이블에서 인증
        const result = await pool.request()
            .input('사용자코드', sql.VarChar(4), userId)
            .input('로그인비밀번호', sql.VarChar(4), password)
            .query(`
                SELECT 
                    u.사용자코드, u.사용자명, u.사용자권한, u.사업장코드,
                    s.사업장명, s.사업자번호, s.대표자명
                FROM 사용자 u
                LEFT JOIN 사업장 s ON u.사업장코드 = s.사업장코드
                WHERE u.사용자코드 = @사용자코드 
                AND u.로그인비밀번호 = @로그인비밀번호
                AND u.사용구분 = 0
            `);
        
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            
            // 로그인 시간 업데이트
            const 시작일시 = new Date().toISOString()
                .replace(/[-:T]/g, '')
                .replace(/\..+/, '');
            
            await pool.request()
                .input('사용자코드', sql.VarChar(4), userId)
                .input('시작일시', sql.VarChar(17), 시작일시)
                .query(`
                    UPDATE 사용자 
                    SET 시작일시 = @시작일시, 로그인여부 = 'Y'
                    WHERE 사용자코드 = @사용자코드
                `);
            
            res.json({
                success: true,
                message: '로그인 성공',
                data: {
                    사용자코드: user.사용자코드,
                    사용자명: user.사용자명,
                    사용자권한: user.사용자권한,
                    사업장코드: user.사업장코드,
                    사업장명: user.사업장명,
                    token: 'jwt-token-' + userId // 실제로는 JWT 토큰 생성
                }
            });
        } else {
            res.status(401).json({
                success: false,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }
    } catch (err) {
        console.error('로그인 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 자재 목록 조회
app.get('/api/materials', async (req, res) => {
    try {
        const { search, 분류코드 } = req.query;
        
        let query = `
            SELECT 
                CONCAT(m.분류코드, m.세부코드) as 자재코드,
                m.분류코드, m.세부코드, m.자재명, m.규격, m.단위,
                m.바코드, m.과세구분, m.적요,
                c.분류명
            FROM 자재 m
            LEFT JOIN 자재분류 c ON m.분류코드 = c.분류코드
            WHERE m.사용구분 = 0
        `;
        
        if (분류코드) {
            query += ` AND m.분류코드 = '${분류코드}'`;
        }
        
        if (search) {
            query += ` AND (m.자재명 LIKE '%${search}%' OR m.규격 LIKE '%${search}%')`;
        }
        
        query += ` ORDER BY m.분류코드, m.세부코드`;
        
        const result = await pool.request().query(query);
        
        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        });
    } catch (err) {
        console.error('자재 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 자재 상세 조회 (재고 정보 포함)
app.get('/api/materials/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const 분류코드 = code.substring(0, 2);
        const 세부코드 = code.substring(2);
        
        // 자재 정보
        const material = await pool.request()
            .input('분류코드', sql.VarChar(2), 분류코드)
            .input('세부코드', sql.VarChar(16), 세부코드)
            .query(`
                SELECT 
                    CONCAT(m.분류코드, m.세부코드) as 자재코드,
                    m.*, c.분류명
                FROM 자재 m
                LEFT JOIN 자재분류 c ON m.분류코드 = c.분류코드
                WHERE m.분류코드 = @분류코드 AND m.세부코드 = @세부코드
            `);
        
        // 자재원장 (재고 정보)
        const ledger = await pool.request()
            .input('분류코드', sql.VarChar(2), 분류코드)
            .input('세부코드', sql.VarChar(16), 세부코드)
            .query(`
                SELECT * FROM 자재원장
                WHERE 분류코드 = @분류코드 AND 세부코드 = @세부코드
            `);
        
        if (material.recordset.length > 0) {
            res.json({
                success: true,
                data: {
                    material: material.recordset[0],
                    ledger: ledger.recordset
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: '자재를 찾을 수 없습니다.'
            });
        }
    } catch (err) {
        console.error('자재 상세 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 자재 등록
app.post('/api/materials', async (req, res) => {
    try {
        const {
            분류코드, 세부코드, 자재명, 바코드, 규격, 단위,
            폐기율, 과세구분, 적요
        } = req.body;
        
        const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        await pool.request()
            .input('분류코드', sql.VarChar(2), 분류코드)
            .input('세부코드', sql.VarChar(16), 세부코드)
            .input('자재명', sql.VarChar(30), 자재명)
            .input('바코드', sql.VarChar(13), 바코드 || '')
            .input('규격', sql.VarChar(30), 규격 || '')
            .input('단위', sql.VarChar(20), 단위 || '')
            .input('폐기율', sql.Money, 폐기율 || 0)
            .input('과세구분', sql.TinyInt, 과세구분 || 1)
            .input('적요', sql.VarChar(60), 적요 || '')
            .input('수정일자', sql.VarChar(8), 수정일자)
            .query(`
                INSERT INTO 자재 (
                    분류코드, 세부코드, 자재명, 바코드, 규격, 단위,
                    폐기율, 과세구분, 적요, 사용구분, 수정일자, 사용자코드
                ) VALUES (
                    @분류코드, @세부코드, @자재명, @바코드, @규격, @단위,
                    @폐기율, @과세구분, @적요, 0, @수정일자, ''
                )
            `);
        
        res.json({
            success: true,
            message: '자재가 등록되었습니다.'
        });
    } catch (err) {
        console.error('자재 등록 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
    }
});

// 자재 수정
app.put('/api/materials/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const 분류코드 = code.substring(0, 2);
        const 세부코드 = code.substring(2);
        
        const {
            자재명, 바코드, 규격, 단위,
            폐기율, 과세구분, 적요
        } = req.body;
        
        const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        await pool.request()
            .input('분류코드', sql.VarChar(2), 분류코드)
            .input('세부코드', sql.VarChar(16), 세부코드)
            .input('자재명', sql.VarChar(30), 자재명)
            .input('바코드', sql.VarChar(13), 바코드 || '')
            .input('규격', sql.VarChar(30), 규격 || '')
            .input('단위', sql.VarChar(20), 단위 || '')
            .input('폐기율', sql.Money, 폐기율 || 0)
            .input('과세구분', sql.TinyInt, 과세구분 || 1)
            .input('적요', sql.VarChar(60), 적요 || '')
            .input('수정일자', sql.VarChar(8), 수정일자)
            .query(`
                UPDATE 자재 SET
                    자재명 = @자재명,
                    바코드 = @바코드,
                    규격 = @규격,
                    단위 = @단위,
                    폐기율 = @폐기율,
                    과세구분 = @과세구분,
                    적요 = @적요,
                    수정일자 = @수정일자
                WHERE 분류코드 = @분류코드 AND 세부코드 = @세부코드
            `);
        
        res.json({
            success: true,
            message: '자재가 수정되었습니다.'
        });
    } catch (err) {
        console.error('자재 수정 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
    }
});

// 자재 삭제
app.delete('/api/materials/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const 분류코드 = code.substring(0, 2);
        const 세부코드 = code.substring(2);
        
        await pool.request()
            .input('분류코드', sql.VarChar(2), 분류코드)
            .input('세부코드', sql.VarChar(16), 세부코드)
            .query(`
                UPDATE 자재 SET 사용구분 = 1
                WHERE 분류코드 = @분류코드 AND 세부코드 = @세부코드
            `);
        
        res.json({
            success: true,
            message: '자재가 삭제되었습니다.'
        });
    } catch (err) {
        console.error('자재 삭제 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류: ' + err.message });
    }
});

// 자재 분류 목록 조회
app.get('/api/material-categories', async (req, res) => {
    try {
        const result = await pool.request()
            .query(`
                SELECT 분류코드, 분류명, 적요
                FROM 자재분류
                WHERE 사용구분 = 0
                ORDER BY 분류코드
            `);
        
        res.json({
            success: true,
            data: result.recordset
        });
    } catch (err) {
        console.error('자재분류 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 재고 현황 조회
app.get('/api/inventory/:workplace', async (req, res) => {
    try {
        const { workplace } = req.params;
        
        const result = await pool.request()
            .input('사업장코드', sql.VarChar(2), workplace)
            .query(`
                SELECT 
                    CONCAT(i.분류코드, i.세부코드) as 자재코드,
                    m.자재명, m.규격, m.단위,
                    SUM(CASE WHEN i.입출고구분 = 1 THEN i.입고수량 ELSE 0 END) as 총입고,
                    SUM(CASE WHEN i.입출고구분 = 2 THEN i.출고수량 ELSE 0 END) as 총출고,
                    SUM(CASE WHEN i.입출고구분 = 1 THEN i.입고수량 ELSE -i.출고수량 END) as 현재고,
                    l.적정재고, l.최저재고,
                    l.최종입고일자, l.최종출고일자
                FROM 자재입출내역 i
                LEFT JOIN 자재 m ON i.분류코드 = m.분류코드 AND i.세부코드 = m.세부코드
                LEFT JOIN 자재원장 l ON i.사업장코드 = l.사업장코드 
                    AND i.분류코드 = l.분류코드 AND i.세부코드 = l.세부코드
                WHERE i.사업장코드 = @사업장코드 AND i.사용구분 = 0
                GROUP BY i.분류코드, i.세부코드, m.자재명, m.규격, m.단위,
                    l.적정재고, l.최저재고, l.최종입고일자, l.최종출고일자
                ORDER BY i.분류코드, i.세부코드
            `);
        
        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        });
    } catch (err) {
        console.error('재고 현황 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ==================== 대시보드 통계 API ====================

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const { 사업장코드 } = req.query;
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const thisMonth = today.substring(0, 6);
        
        // 오늘 매출 (출고 기준)
        const todaySales = await pool.request()
            .input('사업장코드', sql.VarChar(2), 사업장코드 || '01')
            .input('입출고일자', sql.VarChar(8), today)
            .query(`
                SELECT SUM((출고수량 * 출고단가) + 출고부가) as 매출
                FROM 자재입출내역
                WHERE 사업장코드 = @사업장코드 
                AND 입출고일자 = @입출고일자
                AND 입출고구분 = 2
            `);
        
        // 이번달 매출
        const monthlySales = await pool.request()
            .input('사업장코드', sql.VarChar(2), 사업장코드 || '01')
            .input('년월', sql.VarChar(6), thisMonth)
            .query(`
                SELECT SUM((출고수량 * 출고단가) + 출고부가) as 매출
                FROM 자재입출내역
                WHERE 사업장코드 = @사업장코드 
                AND LEFT(입출고일자, 6) = @년월
                AND 입출고구분 = 2
            `);
        
        // 재고 건수
        const inventory = await pool.request()
            .input('사업장코드', sql.VarChar(2), 사업장코드 || '01')
            .query(`
                SELECT COUNT(DISTINCT CONCAT(분류코드, 세부코드)) as 건수
                FROM 자재입출내역
                WHERE 사업장코드 = @사업장코드
            `);
        
        res.json({
            success: true,
            data: {
                todaySales: todaySales.recordset[0]?.매출 || 0,
                monthlySales: monthlySales.recordset[0]?.매출 || 0,
                unpaidAmount: 0, // 미수금은 별도 테이블 필요
                inventoryCount: inventory.recordset[0]?.건수 || 0
            }
        });
    } catch (err) {
        console.error('대시보드 통계 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});
        

// 로그아웃
app.post('/api/auth/logout', async (req, res) => {
    try {
        const { userId } = req.body;
        
        const 종료일시 = new Date().toISOString()
            .replace(/[-:T]/g, '')
            .replace(/\..+/, '');
        
        await pool.request()
            .input('사용자코드', sql.VarChar(4), userId)
            .input('종료일시', sql.VarChar(17), 종료일시)
            .query(`
                UPDATE 사용자 
                SET 종료일시 = @종료일시, 로그인여부 = 'N'
                WHERE 사용자코드 = @사용자코드
            `);
        
        res.json({
            success: true,
            message: '로그아웃 되었습니다.'
        });
    } catch (err) {
        console.error('로그아웃 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ==================== 사업장 API ====================

// 사업장 목록 조회
app.get('/api/workplaces', async (req, res) => {
    try {
        const result = await pool.request()
            .query(`
                SELECT 
                    사업장코드, 사업장명, 사업자번호, 법인번호,
                    대표자명, 전화번호, 팩스번호, 주소, 번지,
                    업태, 업종, 이메일주소, 사용구분
                FROM 사업장
                ORDER BY 사업장코드
            `);
        
        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        });
    } catch (err) {
        console.error('사업장 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 사업장 상세 조회
app.get('/api/workplaces/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        const result = await pool.request()
            .input('사업장코드', sql.VarChar(2), code)
            .query('SELECT * FROM 사업장 WHERE 사업장코드 = @사업장코드');
        
        if (result.recordset.length > 0) {
            res.json({
                success: true,
                data: result.recordset[0]
            });
        } else {
            res.status(404).json({
                success: false,
                message: '사업장을 찾을 수 없습니다.'
            });
        }
    } catch (err) {
        console.error('사업장 상세 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ==================== 매출처 API ====================

// 매출처 목록 조회
app.get('/api/customers', async (req, res) => {
    try {
        const { search, 사업장코드 } = req.query;
        
        let query = `
            SELECT 
                사업장코드, 매출처코드, 매출처명, 사업자번호,
                대표자명, 전화번호, 사용구분, 수정일자, 담당자명, 비고란
            FROM 매출처
            WHERE 1=1
        `;
        
        if (사업장코드) {
            query += ` AND 사업장코드 = '${사업장코드}'`;
        }
        
        if (search) {
            query += ` AND (매출처명 LIKE '%${search}%' OR 사업자번호 LIKE '%${search}%')`;
        }
        
        query += ` ORDER BY 매출처코드`;
        
        const result = await pool.request().query(query);
        
        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        });
    } catch (err) {
        console.error('매출처 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 매출처 상세 조회
app.get('/api/customers/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        const result = await pool.request()
            .input('매출처코드', sql.VarChar(8), code)
            .query('SELECT * FROM 매출처 WHERE 매출처코드 = @매출처코드');
        
        if (result.recordset.length > 0) {
            res.json({
                success: true,
                data: result.recordset[0]
            });
        } else {
            res.status(404).json({
                success: false,
                message: '매출처를 찾을 수 없습니다.'
            });
        }
    } catch (err) {
        console.error('매출처 상세 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 매출처 등록
app.post('/api/customers', async (req, res) => {
    try {
        const {
            사업장코드, 매출처코드, 매출처명, 사업자번호, 법인번호,
            대표자명, 대표자주민번호, 개업일자, 우편번호, 주소, 번지,
            업태, 업종, 전화번호, 팩스번호, 은행코드, 계좌번호,
            계산서발행여부, 계산서발행율, 담당자명, 사용구분, 비고란, 단가구분
        } = req.body;
        
        const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        await pool.request()
            .input('사업장코드', sql.VarChar(2), 사업장코드 || '')
            .input('매출처코드', sql.VarChar(8), 매출처코드)
            .input('매출처명', sql.VarChar(30), 매출처명)
            .input('사업자번호', sql.VarChar(14), 사업자번호 || '')
            .input('법인번호', sql.VarChar(14), 법인번호 || '')
            .input('대표자명', sql.VarChar(30), 대표자명 || '')
            .input('대표자주민번호', sql.VarChar(14), 대표자주민번호 || '')
            .input('개업일자', sql.VarChar(8), 개업일자 || '')
            .input('우편번호', sql.VarChar(7), 우편번호 || '')
            .input('주소', sql.VarChar(60), 주소 || '')
            .input('번지', sql.VarChar(60), 번지 || '')
            .input('업태', sql.VarChar(30), 업태 || '')
            .input('업종', sql.VarChar(30), 업종 || '')
            .input('전화번호', sql.VarChar(20), 전화번호 || '')
            .input('팩스번호', sql.VarChar(14), 팩스번호 || '')
            .input('은행코드', sql.VarChar(2), 은행코드 || '')
            .input('계좌번호', sql.VarChar(20), 계좌번호 || '')
            .input('계산서발행여부', sql.TinyInt, 계산서발행여부 || 1)
            .input('계산서발행율', sql.Money, 계산서발행율 || 100)
            .input('담당자명', sql.VarChar(30), 담당자명 || '')
            .input('사용구분', sql.TinyInt, 사용구분 || 0)
            .input('수정일자', sql.VarChar(8), 수정일자)
            .input('사용자코드', sql.VarChar(4), '')
            .input('비고란', sql.VarChar(100), 비고란 || '')
            .input('단가구분', sql.TinyInt, 단가구분 || 1)
            .query(`
                INSERT INTO 매출처 (
                    사업장코드, 매출처코드, 매출처명, 사업자번호, 법인번호,
                    대표자명, 대표자주민번호, 개업일자, 우편번호, 주소, 번지,
                    업태, 업종, 전화번호, 팩스번호, 은행코드, 계좌번호,
                    계산서발행여부, 계산서발행율, 담당자명, 사용구분,
                    수정일자, 사용자코드, 비고란, 단가구분
                ) VALUES (
                    @사업장코드, @매출처코드, @매출처명, @사업자번호, @법인번호,
                    @대표자명, @대표자주민번호, @개업일자, @우편번호, @주소, @번지,
                    @업태, @업종, @전화번호, @팩스번호, @은행코드, @계좌번호,
                    @계산서발행여부, @계산서발행율, @담당자명, @사용구분,
                    @수정일자, @사용자코드, @비고란, @단가구분
                )
            `);
        
        res.json({
            success: true,
            message: '매출처가 등록되었습니다.'
        });
    } catch (err) {
        console.error('매출처 등록 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 매출처 수정
app.put('/api/customers/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const {
            매출처명, 사업자번호, 법인번호, 대표자명, 대표자주민번호,
            개업일자, 우편번호, 주소, 번지, 업태, 업종, 전화번호,
            팩스번호, 은행코드, 계좌번호, 계산서발행여부, 계산서발행율,
            담당자명, 사용구분, 비고란, 단가구분
        } = req.body;
        
        const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        await pool.request()
            .input('매출처코드', sql.VarChar(8), code)
            .input('매출처명', sql.VarChar(30), 매출처명)
            .input('사업자번호', sql.VarChar(14), 사업자번호 || '')
            .input('법인번호', sql.VarChar(14), 법인번호 || '')
            .input('대표자명', sql.VarChar(30), 대표자명 || '')
            .input('대표자주민번호', sql.VarChar(14), 대표자주민번호 || '')
            .input('개업일자', sql.VarChar(8), 개업일자 || '')
            .input('우편번호', sql.VarChar(7), 우편번호 || '')
            .input('주소', sql.VarChar(60), 주소 || '')
            .input('번지', sql.VarChar(60), 번지 || '')
            .input('업태', sql.VarChar(30), 업태 || '')
            .input('업종', sql.VarChar(30), 업종 || '')
            .input('전화번호', sql.VarChar(20), 전화번호 || '')
            .input('팩스번호', sql.VarChar(14), 팩스번호 || '')
            .input('은행코드', sql.VarChar(2), 은행코드 || '')
            .input('계좌번호', sql.VarChar(20), 계좌번호 || '')
            .input('계산서발행여부', sql.TinyInt, 계산서발행여부 || 1)
            .input('계산서발행율', sql.Money, 계산서발행율 || 100)
            .input('담당자명', sql.VarChar(30), 담당자명 || '')
            .input('사용구분', sql.TinyInt, 사용구분 || 0)
            .input('수정일자', sql.VarChar(8), 수정일자)
            .input('비고란', sql.VarChar(100), 비고란 || '')
            .input('단가구분', sql.TinyInt, 단가구분 || 1)
            .query(`
                UPDATE 매출처 SET
                    매출처명 = @매출처명,
                    사업자번호 = @사업자번호,
                    법인번호 = @법인번호,
                    대표자명 = @대표자명,
                    대표자주민번호 = @대표자주민번호,
                    개업일자 = @개업일자,
                    우편번호 = @우편번호,
                    주소 = @주소,
                    번지 = @번지,
                    업태 = @업태,
                    업종 = @업종,
                    전화번호 = @전화번호,
                    팩스번호 = @팩스번호,
                    은행코드 = @은행코드,
                    계좌번호 = @계좌번호,
                    계산서발행여부 = @계산서발행여부,
                    계산서발행율 = @계산서발행율,
                    담당자명 = @담당자명,
                    사용구분 = @사용구분,
                    수정일자 = @수정일자,
                    비고란 = @비고란,
                    단가구분 = @단가구분
                WHERE 매출처코드 = @매출처코드
            `);
        
        res.json({
            success: true,
            message: '매출처가 수정되었습니다.'
        });
    } catch (err) {
        console.error('매출처 수정 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 매출처 삭제
app.delete('/api/customers/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        await pool.request()
            .input('매출처코드', sql.VarChar(8), code)
            .query('DELETE FROM 매출처 WHERE 매출처코드 = @매출처코드');
        
        res.json({
            success: true,
            message: '매출처가 삭제되었습니다.'
        });
    } catch (err) {
        console.error('매출처 삭제 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ==================== 매입처 API ====================

// 매입처 목록 조회
app.get('/api/suppliers', async (req, res) => {
    try {
        const { search, 사업장코드 } = req.query;
        
        let query = `
            SELECT 
                사업장코드, 매입처코드, 매입처명, 사업자번호,
                대표자명, 전화번호, 사용구분, 수정일자, 담당자명, 비고란
            FROM 매입처
            WHERE 1=1
        `;
        
        if (사업장코드) {
            query += ` AND 사업장코드 = '${사업장코드}'`;
        }
        
        if (search) {
            query += ` AND (매입처명 LIKE '%${search}%' OR 사업자번호 LIKE '%${search}%')`;
        }
        
        query += ` ORDER BY 매입처코드`;
        
        const result = await pool.request().query(query);
        
        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        });
    } catch (err) {
        console.error('매입처 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 매입처 상세 조회
app.get('/api/suppliers/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        const result = await pool.request()
            .input('매입처코드', sql.VarChar(8), code)
            .query('SELECT * FROM 매입처 WHERE 매입처코드 = @매입처코드');
        
        if (result.recordset.length > 0) {
            res.json({
                success: true,
                data: result.recordset[0]
            });
        } else {
            res.status(404).json({
                success: false,
                message: '매입처를 찾을 수 없습니다.'
            });
        }
    } catch (err) {
        console.error('매입처 상세 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 매입처 등록
app.post('/api/suppliers', async (req, res) => {
    try {
        const {
            사업장코드, 매입처코드, 매입처명, 사업자번호, 법인번호,
            대표자명, 대표자주민번호, 개업일자, 우편번호, 주소, 번지,
            업태, 업종, 전화번호, 팩스번호, 은행코드, 계좌번호,
            계산서발행여부, 계산서발행율, 담당자명, 사용구분, 비고란, 단가구분
        } = req.body;
        
        const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        await pool.request()
            .input('사업장코드', sql.VarChar(2), 사업장코드 || '')
            .input('매입처코드', sql.VarChar(8), 매입처코드)
            .input('매입처명', sql.VarChar(30), 매입처명)
            .input('사업자번호', sql.VarChar(14), 사업자번호 || '')
            .input('법인번호', sql.VarChar(14), 법인번호 || '')
            .input('대표자명', sql.VarChar(30), 대표자명 || '')
            .input('대표자주민번호', sql.VarChar(14), 대표자주민번호 || '')
            .input('개업일자', sql.VarChar(8), 개업일자 || '')
            .input('우편번호', sql.VarChar(7), 우편번호 || '')
            .input('주소', sql.VarChar(60), 주소 || '')
            .input('번지', sql.VarChar(60), 번지 || '')
            .input('업태', sql.VarChar(30), 업태 || '')
            .input('업종', sql.VarChar(30), 업종 || '')
            .input('전화번호', sql.VarChar(20), 전화번호 || '')
            .input('팩스번호', sql.VarChar(14), 팩스번호 || '')
            .input('은행코드', sql.VarChar(2), 은행코드 || '')
            .input('계좌번호', sql.VarChar(20), 계좌번호 || '')
            .input('계산서발행여부', sql.TinyInt, 계산서발행여부 || 1)
            .input('계산서발행율', sql.Money, 계산서발행율 || 100)
            .input('담당자명', sql.VarChar(30), 담당자명 || '')
            .input('사용구분', sql.TinyInt, 사용구분 || 0)
            .input('수정일자', sql.VarChar(8), 수정일자)
            .input('사용자코드', sql.VarChar(4), '')
            .input('비고란', sql.VarChar(100), 비고란 || '')
            .input('단가구분', sql.TinyInt, 단가구분 || 1)
            .query(`
                INSERT INTO 매입처 (
                    사업장코드, 매입처코드, 매입처명, 사업자번호, 법인번호,
                    대표자명, 대표자주민번호, 개업일자, 우편번호, 주소, 번지,
                    업태, 업종, 전화번호, 팩스번호, 은행코드, 계좌번호,
                    계산서발행여부, 계산서발행율, 담당자명, 사용구분,
                    수정일자, 사용자코드, 비고란, 단가구분
                ) VALUES (
                    @사업장코드, @매입처코드, @매입처명, @사업자번호, @법인번호,
                    @대표자명, @대표자주민번호, @개업일자, @우편번호, @주소, @번지,
                    @업태, @업종, @전화번호, @팩스번호, @은행코드, @계좌번호,
                    @계산서발행여부, @계산서발행율, @담당자명, @사용구분,
                    @수정일자, @사용자코드, @비고란, @단가구분
                )
            `);
        
        res.json({
            success: true,
            message: '매입처가 등록되었습니다.'
        });
    } catch (err) {
        console.error('매입처 등록 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 매입처 수정
app.put('/api/suppliers/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const {
            매입처명, 사업자번호, 법인번호, 대표자명, 대표자주민번호,
            개업일자, 우편번호, 주소, 번지, 업태, 업종, 전화번호,
            팩스번호, 은행코드, 계좌번호, 계산서발행여부, 계산서발행율,
            담당자명, 사용구분, 비고란, 단가구분
        } = req.body;
        
        const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        await pool.request()
            .input('매입처코드', sql.VarChar(8), code)
            .input('매입처명', sql.VarChar(30), 매입처명)
            .input('사업자번호', sql.VarChar(14), 사업자번호 || '')
            .input('법인번호', sql.VarChar(14), 법인번호 || '')
            .input('대표자명', sql.VarChar(30), 대표자명 || '')
            .input('대표자주민번호', sql.VarChar(14), 대표자주민번호 || '')
            .input('개업일자', sql.VarChar(8), 개업일자 || '')
            .input('우편번호', sql.VarChar(7), 우편번호 || '')
            .input('주소', sql.VarChar(60), 주소 || '')
            .input('번지', sql.VarChar(60), 번지 || '')
            .input('업태', sql.VarChar(30), 업태 || '')
            .input('업종', sql.VarChar(30), 업종 || '')
            .input('전화번호', sql.VarChar(20), 전화번호 || '')
            .input('팩스번호', sql.VarChar(14), 팩스번호 || '')
            .input('은행코드', sql.VarChar(2), 은행코드 || '')
            .input('계좌번호', sql.VarChar(20), 계좌번호 || '')
            .input('계산서발행여부', sql.TinyInt, 계산서발행여부 || 1)
            .input('계산서발행율', sql.Money, 계산서발행율 || 100)
            .input('담당자명', sql.VarChar(30), 담당자명 || '')
            .input('사용구분', sql.TinyInt, 사용구분 || 0)
            .input('수정일자', sql.VarChar(8), 수정일자)
            .input('비고란', sql.VarChar(100), 비고란 || '')
            .input('단가구분', sql.TinyInt, 단가구분 || 1)
            .query(`
                UPDATE 매입처 SET
                    매입처명 = @매입처명,
                    사업자번호 = @사업자번호,
                    법인번호 = @법인번호,
                    대표자명 = @대표자명,
                    대표자주민번호 = @대표자주민번호,
                    개업일자 = @개업일자,
                    우편번호 = @우편번호,
                    주소 = @주소,
                    번지 = @번지,
                    업태 = @업태,
                    업종 = @업종,
                    전화번호 = @전화번호,
                    팩스번호 = @팩스번호,
                    은행코드 = @은행코드,
                    계좌번호 = @계좌번호,
                    계산서발행여부 = @계산서발행여부,
                    계산서발행율 = @계산서발행율,
                    담당자명 = @담당자명,
                    사용구분 = @사용구분,
                    수정일자 = @수정일자,
                    비고란 = @비고란,
                    단가구분 = @단가구분
                WHERE 매입처코드 = @매입처코드
            `);
        
        res.json({
            success: true,
            message: '매입처가 수정되었습니다.'
        });
    } catch (err) {
        console.error('매입처 수정 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 매입처 삭제
app.delete('/api/suppliers/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        await pool.request()
            .input('매입처코드', sql.VarChar(8), code)
            .query('DELETE FROM 매입처 WHERE 매입처코드 = @매입처코드');
        
        res.json({
            success: true,
            message: '매입처가 삭제되었습니다.'
        });
    } catch (err) {
        console.error('매입처 삭제 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ==================== 견적 API ====================

// 견적 목록 조회
app.get('/api/quotations', async (req, res) => {
    try {
        const { search, 사업장코드, 상태코드, startDate, endDate } = req.query;
        
        let query = `
            SELECT 
                q.사업장코드, q.견적일자, q.견적번호, q.매출처코드,
                c.매출처명, q.출고희망일자, q.제목, q.적요, q.상태코드,
                q.수정일자, u.사용자명
            FROM 견적 q
            LEFT JOIN 매출처 c ON q.매출처코드 = c.매출처코드
            LEFT JOIN 사용자 u ON q.사용자코드 = u.사용자코드
            WHERE q.사용구분 = 0
        `;
        
        if (사업장코드) {
            query += ` AND q.사업장코드 = '${사업장코드}'`;
        }
        
        if (상태코드) {
            query += ` AND q.상태코드 = ${상태코드}`;
        }
        
        if (startDate && endDate) {
            query += ` AND q.견적일자 BETWEEN '${startDate}' AND '${endDate}'`;
        }
        
        if (search) {
            query += ` AND (c.매출처명 LIKE '%${search}%' OR q.제목 LIKE '%${search}%')`;
        }
        
        query += ` ORDER BY q.견적일자 DESC, q.견적번호 DESC`;
        
        const result = await pool.request().query(query);
        
        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        });
    } catch (err) {
        console.error('견적 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 견적 상세 조회 (마스터 + 디테일)
app.get('/api/quotations/:date/:no', async (req, res) => {
    try {
        const { date, no } = req.params;
        
        // 마스터 조회
        const master = await pool.request()
            .input('견적일자', sql.VarChar(8), date)
            .input('견적번호', sql.Real, parseFloat(no))
            .query(`
                SELECT q.*, c.매출처명, c.사업자번호, c.대표자명
                FROM 견적 q
                LEFT JOIN 매출처 c ON q.매출처코드 = c.매출처코드
                WHERE q.견적일자 = @견적일자 AND q.견적번호 = @견적번호
            `);
        
        // 디테일 조회
        const detail = await pool.request()
            .input('견적일자', sql.VarChar(8), date)
            .input('견적번호', sql.Real, parseFloat(no))
            .query(`
                SELECT 
                    qd.*, 
                    CONCAT(m.분류코드, m.세부코드) as 자재코드,
                    m.자재명, m.규격, m.단위,
                    s.매입처명
                FROM 견적내역 qd
                LEFT JOIN 자재 m ON qd.자재코드 = CONCAT(m.분류코드, m.세부코드)
                LEFT JOIN 매입처 s ON qd.매입처코드 = s.매입처코드
                WHERE qd.견적일자 = @견적일자 AND qd.견적번호 = @견적번호
                AND qd.사용구분 = 0
                ORDER BY qd.견적시간
            `);
        
        if (master.recordset.length > 0) {
            res.json({
                success: true,
                data: {
                    master: master.recordset[0],
                    detail: detail.recordset
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: '견적을 찾을 수 없습니다.'
            });
        }
    } catch (err) {
        console.error('견적 상세 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 견적 등록
app.post('/api/quotations', async (req, res) => {
    try {
        const { master, details } = req.body;
        
        // 견적번호 생성 (로그 테이블 사용)
        const logResult = await pool.request()
            .input('테이블명', sql.VarChar(50), '견적')
            .input('베이스코드', sql.VarChar(50), master.견적일자)
            .query(`
                SELECT 최종로그 FROM 로그 
                WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
            `);
        
        let 견적번호 = 1;
        if (logResult.recordset.length > 0) {
            견적번호 = logResult.recordset[0].최종로그 + 1;
        }
        
        const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        // 마스터 등록
        await pool.request()
            .input('사업장코드', sql.VarChar(2), master.사업장코드)
            .input('견적일자', sql.VarChar(8), master.견적일자)
            .input('견적번호', sql.Real, 견적번호)
            .input('매출처코드', sql.VarChar(8), master.매출처코드)
            .input('출고희망일자', sql.VarChar(8), master.출고희망일자 || '')
            .input('결제방법', sql.TinyInt, master.결제방법 || 0)
            .input('결제예정일자', sql.VarChar(8), master.결제예정일자 || '')
            .input('유효일수', sql.Int, master.유효일수 || 0)
            .input('제목', sql.VarChar(30), master.제목 || '')
            .input('적요', sql.VarChar(50), master.적요 || '')
            .input('상태코드', sql.TinyInt, master.상태코드 || 1)
            .input('수정일자', sql.VarChar(8), 수정일자)
            .input('사용자코드', sql.VarChar(4), master.사용자코드 || '')
            .query(`
                INSERT INTO 견적 (
                    사업장코드, 견적일자, 견적번호, 매출처코드, 출고희망일자,
                    결제방법, 결제예정일자, 유효일수, 제목, 적요, 상태코드,
                    입고일자, 출고일자, 사용구분, 수정일자, 사용자코드
                ) VALUES (
                    @사업장코드, @견적일자, @견적번호, @매출처코드, @출고희망일자,
                    @결제방법, @결제예정일자, @유효일수, @제목, @적요, @상태코드,
                    '', '', 0, @수정일자, @사용자코드
                )
            `);
        
        // 디테일 등록
        for (const detail of details) {
            const 견적시간 = new Date().toISOString()
                .replace(/[-:T]/g, '')
                .replace(/\..+/, '')
                .substring(8);
            
            await pool.request()
                .input('사업장코드', sql.VarChar(2), master.사업장코드)
                .input('견적일자', sql.VarChar(8), master.견적일자)
                .input('견적번호', sql.Real, 견적번호)
                .input('견적시간', sql.VarChar(9), 견적시간)
                .input('자재코드', sql.VarChar(18), detail.자재코드)
                .input('매입처코드', sql.VarChar(8), detail.매입처코드 || '')
                .input('수량', sql.Money, detail.수량)
                .input('매출처코드', sql.VarChar(8), master.매출처코드)
                .input('계산서발행여부', sql.TinyInt, detail.계산서발행여부 || 1)
                .input('입고단가', sql.Money, detail.입고단가 || 0)
                .input('입고부가', sql.Money, detail.입고부가 || 0)
                .input('출고단가', sql.Money, detail.출고단가 || 0)
                .input('출고부가', sql.Money, detail.출고부가 || 0)
                .input('적요', sql.VarChar(50), detail.적요 || '')
                .input('수정일자', sql.VarChar(8), 수정일자)
                .input('사용자코드', sql.VarChar(4), master.사용자코드 || '')
                .query(`
                    INSERT INTO 견적내역 (
                        사업장코드, 견적일자, 견적번호, 견적시간, 자재코드,
                        매입처코드, 수량, 매출처코드, 계산서발행여부, 입고단가,
                        입고부가, 출고단가, 출고부가, 상태코드, 입고일자, 출고일자,
                        적요, 사용구분, 수정일자, 사용자코드
                    ) VALUES (
                        @사업장코드, @견적일자, @견적번호, @견적시간, @자재코드,
                        @매입처코드, @수량, @매출처코드, @계산서발행여부, @입고단가,
                        @입고부가, @출고단가, @출고부가, 1, '', '',
                        @적요, 0, @수정일자, @사용자코드
                    )
                `);
        }
        
        // 로그 업데이트
        if (logResult.recordset.length > 0) {
            await pool.request()
                .input('테이블명', sql.VarChar(50), '견적')
                .input('베이스코드', sql.VarChar(50), master.견적일자)
                .input('최종로그', sql.Money, 견적번호)
                .input('수정일자', sql.VarChar(8), 수정일자)
                .query(`
                    UPDATE 로그 SET 최종로그 = @최종로그, 수정일자 = @수정일자
                    WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
                `);
        } else {
            await pool.request()
                .input('테이블명', sql.VarChar(50), '견적')
                .input('베이스코드', sql.VarChar(50), master.견적일자)
                .input('최종로그', sql.Money, 견적번호)
                .input('수정일자', sql.VarChar(8), 수정일자)
                .query(`
                    INSERT INTO 로그 (테이블명, 베이스코드, 최종로그, 최종로그1, 수정일자, 사용자코드)
                    VALUES (@테이블명, @베이스코드, @최종로그, 0, @수정일자, '')
                `);
        }
        
        res.json({
            success: true,
            message: '견적이 등록되었습니다.',
            data: { 견적일자: master.견적일자, 견적번호 }
        });
    } catch (err) {
        console.error('견적 등록 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ==================== 발주 API ====================

// 발주 목록 조회
app.get('/api/orders', async (req, res) => {
    try {
        const { search, 사업장코드, 상태코드, startDate, endDate } = req.query;
        
        let query = `
            SELECT 
                o.사업장코드, o.발주일자, o.발주번호, o.매입처코드,
                s.매입처명, o.입고희망일자, o.제목, o.적요, o.상태코드,
                o.수정일자, u.사용자명
            FROM 발주 o
            LEFT JOIN 매입처 s ON o.매입처코드 = s.매입처코드
            LEFT JOIN 사용자 u ON o.사용자코드 = u.사용자코드
            WHERE o.사용구분 = 0
        `;
        
        if (사업장코드) {
            query += ` AND o.사업장코드 = '${사업장코드}'`;
        }
        
        if (상태코드) {
            query += ` AND o.상태코드 = ${상태코드}`;
        }
        
        if (startDate && endDate) {
            query += ` AND o.발주일자 BETWEEN '${startDate}' AND '${endDate}'`;
        }
        
        if (search) {
            query += ` AND (s.매입처명 LIKE '%${search}%' OR o.제목 LIKE '%${search}%')`;
        }
        
        query += ` ORDER BY o.발주일자 DESC, o.발주번호 DESC`;
        
        const result = await pool.request().query(query);
        
        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        });
    } catch (err) {
        console.error('발주 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 발주 상세 조회
app.get('/api/orders/:date/:no', async (req, res) => {
    try {
        const { date, no } = req.params;
        
        // 마스터 조회
        const master = await pool.request()
            .input('발주일자', sql.VarChar(8), date)
            .input('발주번호', sql.Real, parseFloat(no))
            .query(`
                SELECT o.*, s.매입처명, s.사업자번호, s.대표자명
                FROM 발주 o
                LEFT JOIN 매입처 s ON o.매입처코드 = s.매입처코드
                WHERE o.발주일자 = @발주일자 AND o.발주번호 = @발주번호
            `);
        
        // 디테일 조회
        const detail = await pool.request()
            .input('발주일자', sql.VarChar(8), date)
            .input('발주번호', sql.Real, parseFloat(no))
            .query(`
                SELECT 
                    od.*, 
                    CONCAT(m.분류코드, m.세부코드) as 자재코드,
                    m.자재명, m.규격, m.단위,
                    s.매입처명
                FROM 발주내역 od
                LEFT JOIN 자재 m ON od.자재코드 = CONCAT(m.분류코드, m.세부코드)
                LEFT JOIN 매입처 s ON od.매입처코드 = s.매입처코드
                WHERE od.발주일자 = @발주일자 AND od.발주번호 = @발주번호
                AND od.사용구분 = 0
                ORDER BY od.발주시간
            `);
        
        if (master.recordset.length > 0) {
            res.json({
                success: true,
                data: {
                    master: master.recordset[0],
                    detail: detail.recordset
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: '발주를 찾을 수 없습니다.'
            });
        }
    } catch (err) {
        console.error('발주 상세 조회 에러:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ==================== 서버 시작 ====================

// 루트 경로
app.get('/', (req, res) => {
    res.json({
        message: '판매관리 시스템 API 서버',
        version: '1.0.0',
        endpoints: {
            auth: {
                login: 'POST /api/auth/login',
                logout: 'POST /api/auth/logout'
            },
            workplaces: 'GET /api/workplaces',
            customers: 'GET /api/customers',
            suppliers: 'GET /api/suppliers',
            quotations: 'GET /api/quotations',
            orders: 'GET /api/orders',
            materials: 'GET /api/materials',
            inventory: 'GET /api/inventory/:workplace',
            dashboard: 'GET /api/dashboard/stats'
        }
    });
});

// 서버 시작
async function startServer() {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('서버 시작 실패:', err);
        process.exit(1);
    }
}

// 프로세스 종료시 연결 해제
process.on('SIGINT', async () => {
    try {
        await pool.close();
        console.log('데이터베이스 연결 종료');
        process.exit(0);
    } catch (err) {
        console.error('종료 에러:', err);
        process.exit(1);
    }
});

startServer();
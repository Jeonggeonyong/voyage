const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { pool, query } = require('./db.js');

const checkListServer = express()
checkListServer.use(cors())
checkListServer.use(express.json());

// K8s Deployment의 containerPort와 일치시켜야 합니다.
const PORT = 3000;

async function initializeDatabase() {
    console.log('DB 테이블 초기화를 시작합니다.');

  // 테이블 생성 SQL 쿼리 목록 (총 5개 테이블)
    const createTableQueries = [
    // 1. users_analysis 테이블 (의존성 없음)
    `
    CREATE TABLE IF NOT EXISTS "users_analysis" (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_name VARCHAR(50),
        email VARCHAR(255),
        password VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        phone_number VARCHAR(20),
        home_address VARCHAR(255),
        token VARCHAR(255)
    );
    `,
    // 2. estates 테이블 (의존성 없음)
    `
    CREATE TABLE IF NOT EXISTS "estates" (
        estate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        estate_name VARCHAR(255),
        estate_address VARCHAR(255),
        zip_no VARCHAR(10),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `,
    // 3. threats 테이블 (정적 테이블, 의존성 없음)
    `
    CREATE TABLE IF NOT EXISTS "threats" (
        threat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        threat_name VARCHAR(50),
        contents TEXT,
        category VARCHAR(10) NOT NULL CHECK (category IN ('title', 'a', 'b'))
    );
    `,
    // 4. analysis 테이블 (estates 참조)
    `
    CREATE TABLE IF NOT EXISTS "analysis" (
        analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- "estates" 테이블 참조 (FK)
        estate_id UUID REFERENCES "estates"(estate_id) ON DELETE CASCADE,
        risk_score INT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        title_section_analysis JSONB,
        part_a_analysis JSONB,
        part_b_analysis JSONB
    );
    `,
    // 5. checklists 테이블 (users_analysis, estates, threats 참조)
    `
    CREATE TABLE IF NOT EXISTS "checklists" (
        user_checklist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- "users_analysis" 테이블 참조 (FK)
        user_id UUID REFERENCES "users_analysis"(user_id) ON DELETE CASCADE,
        -- "estates" 테이블 참조 (FK)
        estate_id UUID REFERENCES "estates"(estate_id) ON DELETE CASCADE,
        -- "threats" 테이블 참조 (FK)
        threat_id UUID REFERENCES "threats"(threat_id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL CHECK (category IN (
            'analysis', 
            'before_contract', 
            'contract_day', 
            'after_contract', 
            'after_expiration'
        )),
        is_checked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `
    ];

    try {
    // 모든 쿼리를 순차적으로 실행 (순서 중요: FK 참조를 위해 부모 테이블 먼저 생성)
    for (const sql of createTableQueries) {
        await query(sql, []);
    }
    console.log('모든 데이터베이스 테이블이 성공적으로 준비되었습니다.');
    } catch (err) {
    console.error('데이터베이스 테이블 초기화 중 오류 발생:', err.message);
    process.exit(1);
    }
}

// 서버 listen 전에 initializeDatabase 호출 및 대기
initializeDatabase().then(() => {
    // 0.0.0.0으로 호스트를 지정해야 Docker 컨테이너 외부에서 접근이 가능합니다.
    checkListServer.listen(PORT, '0.0.0.0', () => {
        console.log(`CHECKLIST server listening on port ${PORT}`);
    });
}).catch(err => {
    console.error('서버 시작 중 오류 발생:', err);
    process.exit(1);
});

checkListServer.get('/', (req, res) => {
    // 이 서버가 어떤 서버인지 식별할 수 있는 메시지를 반환합니다.
    res.send('Hello from Express! (CHECKLIST server v1)');
});


// 위험 분석 후 DB에 INSERT 하고,
// DB의 USER_CHECKLIST_checklist 테이블 조회
// 예시 URL host/users/1111/123/checklist?isChecked=true&category=analysis
checkListServer.get('/users/:userId/:estateId/checklist', async (req, res) => {
    try {
        const userId = req.params.userId;
        const estateId = req.params.estateId;
        const isChecked = req.query.isChecked; // 'true' 또는 'false'
        const category = req.query.category; // 'analysis', 'before_contract' 등등

        if (!userId || !estateId) {
            return res.status(400).json({ message: '사용자 및 매물 ID가 필요합니다.' });
        }

        // SQL 쿼리 기본 부분
        let sqlQuery = `
            SELECT * FROM user_checklist_checklist
            WHERE user_id = $1 AND estate_id = $2
        `;
        const params = [userId, estateId];
        let paramIndex = 3; //파라미터 삽입위치

        // isChecked 값에 따른 필터링 조건 추가
        if (isChecked === 'true') {
            sqlQuery += ` AND is_checked = TRUE`;
        } else if (isChecked === 'false') {
            sqlQuery += ` AND is_checked = FALSE`;
        }

        // category 값에 따라서 파라미터 값 추가 필터링
        if (category) {
            sqlQuery += ` AND category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        // 특정 순서로 정렬하는 ORDER BY CASE 문 -> 우선순위 부여ㅑ
        sqlQuery += `
            ORDER BY
                CASE category
                    WHEN 'analysis' THEN 1
                    WHEN 'before_contract' THEN 2
                    WHEN 'contract_day' THEN 3
                    WHEN 'after_contract' THEN 4
                    WHEN 'after_expiration' THEN 5
                    ELSE 99
                END, created_at DESC;
        `;

        const result = await query(sqlQuery, params);

        res.status(200).json({
            message: "체크리스트 데이터를 성공적으로 조회했습니다.",
            checklists: result.rows
        });

    } catch (err) {
        console.error("데이터베이스 조회 중 오류 발생:", err);
        res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
});

// 체크리스트 제출API
checkListServer.put('/users/:userId/:estateId/checklists', async (req, res) => {
    const { userId, estateId } = req.params;
    const checklistsToUpdate = req.body.checklists; // 클라이언트에서 보낸 배열 데이터, 선택한 체크리스트 아이템의 id, is_checked 여부
    if (!userId || !estateId) {
        return res.status(400).json({ message: "사용자 및 매물 ID가 필요합니다." });
    }
    if (!checklistsToUpdate || !Array.isArray(checklistsToUpdate) || checklistsToUpdate.length === 0) {
        return res.status(400).json({ message: "업데이트할 체크리스트 데이터가 필요합니다." });
    }

    // 트랜잭션 시작
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 배열 순회 -> 각 항목 업데이트
        const updatePromises = checklistsToUpdate.map(async (item) => {
            const { checklistId, isChecked } = item;

            // 데이터 타입 검증
            if (typeof checklistId !== 'string' || typeof isChecked !== 'boolean') {
                throw new Error("유효하지 않은 체크리스트 데이터 형식입니다.");
            }

            const updateQuery = `
                UPDATE user_checklist_checklist
                SET is_checked = $1
                WHERE user_id = $2
                AND estate_id = $3
                AND user_checklist_id = $4
                RETURNING *;
            `;
            const values = [isChecked, userId, estateId, checklistId];
            return client.query(updateQuery, values);
        });

        // 모든 업데이트 쿼리 동시 실행 및 대기
        const results = await Promise.all(updatePromises);

        // 모든 쿼리가 성공하면 최종 반영(COMMIT)
        await client.query('COMMIT');

        // 성공 응답 전송
        res.status(200).json({
            message: "체크리스트 상태가 성공적으로 업데이트되었습니다.",
            updatedChecklists: results.map(result => result.rows[0])
        });

    } catch (error) {
        // 오류 발생 시 모든 변경사항 취소(ROLLBACK)
        await client.query('ROLLBACK');
        console.error("트랜잭션 중 오류 발생:", error);
        res.status(500).json({ message: "서버 오류가 발생했습니다.", details: error.message });
    } finally {
        // 클라이언트 연결 반환
        client.release();
    }
});
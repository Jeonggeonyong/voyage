const express = require('express');
//const axios = require('axios');
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
    CREATE TABLE IF NOT EXISTS users_analysis (
            user_id TEXT PRIMARY KEY,
            user_name VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            token VARCHAR(255)
        );
    `,
    // 2. estates 테이블 (의존성 없음)
    `
    CREATE TABLE IF NOT EXISTS estates (
        estate_id UUID PRIMARY KEY,
        estate_name VARCHAR(255),
        estate_address VARCHAR(255),
        zip_no VARCHAR(10),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `,
    // 3. threats (정적 테이블, 의존성 없음) - [수정됨]
    `
    CREATE TABLE IF NOT EXISTS threats (
        threat_id INT PRIMARY KEY,
        threat_name VARCHAR(50),
        contents TEXT,
        risk_level INT,
        category VARCHAR(10) NOT NULL CHECK (category IN ('title', 'a', 'b', 'extra'))
    );
    `,
    // 4. checklists (정적 테이블, threats 참조) - [새로 추가됨]
    `
    CREATE TABLE IF NOT EXISTS checklists (
        checklist_id SERIAL PRIMARY KEY,
        threat_id INT REFERENCES threats(threat_id) ON DELETE CASCADE,
        text TEXT
    );
    `,
    // 5. analysis 테이블 (estates 참조)
    `
    CREATE TABLE IF NOT EXISTS analysis (
        analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- estates 테이블 참조 (FK)
        estate_id UUID REFERENCES estates(estate_id) ON DELETE CASCADE,
    -- [추가25/10/28] users_analysis 테이블 참조 (FK)
        user_id TEXT REFERENCES users_analysis(user_id) ON DELETE CASCADE,
        risk_score INT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        title_section_analysis JSONB,
        part_a_analysis JSONB,
        part_b_analysis JSONB
    );
    `,
    // 6. user_checklists 테이블 (users_analysis, estates, threats 참조)
    `
    CREATE TABLE IF NOT EXISTS user_checklists (
        user_checklist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),     
        -- checklists (static) 테이블 참조 (FK)
        checklist_id INT REFERENCES checklists(checklist_id) ON DELETE CASCADE,      
        -- users_analysis 테이블 참조 (FK)
        user_id TEXT REFERENCES users_analysis(user_id) ON DELETE CASCADE,    
        -- estates 테이블 참조 (FK)
        estate_id UUID REFERENCES estates(estate_id) ON DELETE CASCADE,  
        -- threats 테이블 참조 (FK)
        threat_id INT REFERENCES threats(threat_id) ON DELETE CASCADE,   
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

    await seedStaticData(); //정적 데이터 삽입

    } catch (err) {
    console.error('데이터베이스 테이블 초기화 중 오류 발생:', err.message);
    process.exit(1);
    }
}

async function seedStaticData() {
  // 트랜잭션 시작 (데이터 일관성을 위해)

  // 1. 데이터가 이미 있는지 확인
    let rows;
    try {
    const result = await query('SELECT COUNT(*) as count FROM threats', []);
    rows = result.rows;
    } catch (err) {
    console.error('정적 데이터 확인 중 오류:', err.message);
    process.exit(1);
    }

    if (rows[0].count > 0) {
    console.log('정적 데이터(threats)가 이미 존재하므로, 삽입을 건너뜁니다.');
    return;
    }

  // 2. 데이터가 없으면 삽입 시작
    try {
    console.log('정적 데이터(threats, checklists) 삽입을 시작합니다...');

    // KOR: THREATS 테이블 데이터 삽입 (총 12개)
    await query(`
        INSERT INTO THREATS (threat_id, threat_name, contents, risk_level, category) VALUES
        (1, '계약 물건 불일치', '내가 계약하려는 집의 주소, 동, 호수와 등기부등본의 정보가 다른 경우.', 1, 'title'),
        (2, '불법 건축물 / 용도 위반', '주거용 건물이 아닌 ''근린생활시설''이나 ''사무실'' 등으로 등록된 경우. (일명 ''근생빌라'')', 1, 'title'),
        (3, '대지권 미등기', '아파트나 빌라(집합건물)에서 건물 소유권은 있지만, 그 건물이 서 있는 땅(대지)에 대한 권리가 등록되지 않은 상태.', 1, 'title');
    `, []);

    await query(`
        INSERT INTO THREATS (threat_id, threat_name, contents, risk_level, category) VALUES
        (4, '실소유주 불일치', '계약을 진행하는 사람(임대인)과 등기부등본 상의 현재 소유주가 다른 경우.', 2, 'a'),
        (5, '소유권 분쟁 중 (가처분)', '해당 부동산의 소유권을 두고 법적 다툼이 진행 중인 상태.', 2, 'a'),
        (6, '채무 문제 (압류/가압류)', '집주인이 세금이나 채무를 이행하지 않아 재산이 강제로 처분될 위기에 놓인 상태.', 3, 'a'),
        (7, '경매 진행 중', '이미 집이 경매 절차에 들어간 상태.', 3, 'a'),
        (8, '신탁 부동산', '실소유주(위탁자)가 아닌 신탁회사(수탁자)가 법적 소유자인 경우.', 2, 'a');
    `, []);

    await query(`
        INSERT INTO THREATS (threat_id, threat_name, contents, risk_level, category) VALUES
        (9, '과도한 대출 (근저당권)', '집에 담보 대출이 너무 많아, 경매 시 보증금을 돌려받지 못하는 경우. (일명 ''깡통전세'')', 2, 'b'),
        (10, '선순위 전세권자 존재', '나보다 먼저 이 집에 ''전세권''을 설정한 사람이 있는 경우.', 1, 'b'),
        (11, '이전 세입자의 문제', '이전 세입자가 보증금을 돌려받지 못해 법적 조치를 취한 경우.', 3, 'b'),
        (12, '세금 체납 (을구 함정)', '을구가 깨끗하더라도 집주인의 세금 체납은 등기부등본에 나오지 않습니다.', 2, 'b');
    `, []);

    // 등기부 외 위험 추가
    await query(`
            INSERT INTO THREATS (threat_id, threat_name, contents, risk_level, category) VALUES
            (13, '임대인 세금 체납', '집주인의 국세, 지방세 체납은 등기부등본에 표시되지 않으나, 보증금보다 우선 변제될 수 있습니다. (조세채권 우선 원칙)', 3, 'extra'),
            (14, '부정확한 시세 (깡통전세)', '등기부등본은 시세를 보여주지 않습니다. 시세 대비 융자+보증금이 과도한 경우 경매 시 보증금 손실 위험이 큽니다.', 2, 'extra'),
            (15, '위반건축물 등재', '불법 증축/용도변경 등은 등기부등본이 아닌 ''건축물대장''에만 표시되는 경우가 많아, 대출이나 보증보험 가입이 거절될 수 있습니다.', 1, 'extra'),
            (16, '임대인(소유주) 신원 불일치', '계약 자리에 나온 사람이 등기부등본 상 소유주 본인이 아니거나, 위임 서류(인감증명서 등)가 위조된 경우입니다.', 3, 'extra'),
            (17, '악의적 이중계약 / 당일 대출', '임대인이 계약 당일(잔금일) 오전에 다른 세입자와 계약하거나, 은행 대출(근저당)을 실행하여 임차인의 우선순위를 빼앗는 경우입니다.', 3, 'extra'),
            (18, '대항력/우선변제권 미확보', '이사와 전입신고(대항력), 확정일자(우선변제권)를 즉시 받지 않아 보증금에 대한 법적 보호 순위가 밀리는 경우입니다.', 3, 'extra'),
            (19, '전세보증금 반환보증보험 미가입', '집주인의 신용 문제나 시세 하락으로 보증금을 돌려받지 못할 위험에 대비하지 못하는 경우입니다.', 2, 'extra'),
            (20, '보증금 반환 지연/거부', '집주인이 자금 부족, 다음 세입자 미확보 등을 이유로 보증금 반환을 제때 이행하지 않는 경우입니다.', 3, 'extra'),
            (21, '과도한 원상복구 비용 청구', '사소한 흠집이나 자연적인 노후화를 빌미로 보증금에서 과도한 수리비를 공제하려는 경우입니다.', 1, 'extra');
        `, []);


    // checklist_id는 SERIAL이므로 자동으로 생성됨
    await query(`
        INSERT INTO CHECKLISTS (threat_id, text) VALUES
        (1, '임대차 계약서 및 건축물대장의 주소와 등기부등본의 [소재지번, 건물번호(동), 호수]가 정확히 일치하는지 확인합니다.'),
        (2, '[건물의 용도]가 ''다세대주택'', ''아파트'', ''오피스텔(주거용)'' 등이 맞는지 확인합니다.'),
        (2, '용도가 ''근린생활시설''이나 ''사무소''일 경우, 주택임대차보호법 적용이나 전세대출에 문제가 없는지 별도 확인이 필요합니다.'),
        (3, '[대지권의 표시] 항목이 비어있거나 ''대지권 미등기''라고 표시되어 있는지 확인합니다.');
    `, []);

    await query(`
        INSERT INTO CHECKLISTS (threat_id, text) VALUES
        (4, '등기부등본의 현재 [소유자] 정보(이름, 주민번호 앞자리)를 확인합니다.'),
        (4, '계약자의 신분증 정보와 등기부등본의 [소유자] 정보가 일치하는지 확인합니다.'),
        (5, '갑구에 [가처분] 또는 [처분금지가처분] 등기가 있는지 확인합니다.'),
        (6, '갑구에 [압류], [가압류] 등기가 있는지 확인합니다. (세금 체납, 채무 불이행 신호)'),
        (7, '갑구에 [경매개시결정] 등기가 있는지 확인합니다. (존재 시 계약 절대 금지)'), -- '7KE' -> '7' 수정
        (8, '소유자가 [신탁회사]로 되어 있는지 확인합니다.'),
        (8, '[신탁원부]를 발급받아 신탁회사(수탁자)의 사전 동의가 필요한지, 계약 주체가 누구인지 확인해야 합니다.');
    `, []);

    await query(`
        INSERT INTO CHECKLISTS (threat_id, text) VALUES
        (9, '을구에 [근저당권]이 설정되어 있는지 확인합니다.'),
        (9, '근저당권의 [채권최고액]이 얼마인지 확인합니다. (실제 대출금의 120~130% 수준)'),
        (9, '[채권최고액] + [나의 전세 보증금]이 현재 주택 매매 시세의 70~80%를 초과하는지 반드시 계산해봅니다.'),
        (10, '나의 전입신고일/확정일자보다 [접수일자]가 빠른 [전세권] 등기가 있는지 확인합니다.'),
        (11, '을구에 [임차권등기명령] 기록이 있는지 확인합니다. (집주인이 보증금을 돌려주지 않은 이력이 있다는 강력한 증거입니다.)'),
        (12, '을구가 깨끗하더라도, 계약 시 임대인에게 [국세 및 지방세 납세증명서]를 요구하여 세금 체납 여부를 확인합니다.');
    `, []);

    // 추가된 체크리스트 데이터
    await query(`
            INSERT INTO CHECKLISTS (threat_id, text) VALUES
            (13, '임대인에게 [국세 납세증명서]와 [지방세 납세증명서]를 요구하여 체납액이 없는지 확인합니다.'),
            (13, '임대인의 동의를 받아 계약 전이라도 관할 세무서에서 [미납국세 열람]을 신청합니다.'),
            (14, '국토부 실거래가, 주변 부동산, 중개 앱을 통해 [최소 3곳 이상의 시세]를 교차 확인합니다.'),
            (14, '계산: [선순위 융자(채권최고액)] + [내 보증금]이 [매매 시세의 70%]를 넘지 않는지 확인합니다.'),
            (15, '정부24 또는 구청에서 [건축물대장]을 발급받아 ''변동사항''란에 ''위반건축물'' 표기가 없는지 확인합니다.'),
            (16, '임대인 본인 계약 시, [신분증 원본]과 등기부등본 상 소유주 정보가 일치하는지 대조합니다. (신분증 진위 확인 서비스 이용)'),
            (16, '대리인 계약 시, [소유주 인감도장]이 날인된 [위임장], [소유주 인감증명서(최근 3개월 내)]를 반드시 확인합니다.'),
            (16, '보증금은 반드시 등기부등본 상 [소유주 명의의 계좌]로 이체합니다.'),
            (17, '잔금 납부 [직후] 즉시 등기부등본을 다시 발급받아, 그 사이에 근저당 등 권리 변동이 없는지 확인합니다.'),
            (17, '특약사항에 ''잔금일 익일(다음날)까지 임대인은 어떠한 추가 권리(근저당, 전세권 등)도 설정하지 않는다''는 문구를 기재합니다.'),
            (18, '잔금 납부(이사) [당일], 즉시 주민센터(행정복지센터)를 방문하여 [전입신고]를 완료합니다.'),
            (18, '전입신고와 동시에 계약서 원본에 [확정일자]를 받습니다. (대항력과 우선변제권 확보)'),
            (19, 'HUG(주택도시보증공사), SGI(서울보증) 등의 [전세보증금 반환보증보험] 가입을 신청합니다. (가입 가능 여부 확인 필수)'),
            (20, '계약 만료 6개월~2개월 전, 임대인에게 계약 갱신 거절(이사) 의사를 [문자, 카톡, 통화녹음] 등 증거가 남는 방식으로 명확히 통보합니다.'),
            (20, '보증금을 돌려받지 못한 상태로 이사해야 한다면, 반드시 법원에 [임차권등기명령]을 신청하고 등기부등본에 등재된 것을 확인한 후 이사합니다.'),
            (21, '입주 시 찍어둔 집 상태 사진/영상과 현재 상태를 비교합니다.'),
            (21, '고의/과실로 인한 파손이 아닌, 자연적인 마모나 노후화(벽지 변색, 장판 눌림 등)는 원상복구 대상이 아님을 주장합니다.');
        `, []);

    console.log('정적 데이터(threats, checklists) 삽입 완료.');

    } catch (err) {
    console.error('정적 데이터 삽입 중 오류 발생:', err.message);
    // (만약 트랜잭션을 사용했다면 여기에서 ROLLBACK 처리가 필요합니다)
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


// 체크리스트 초기화 API(위험분석 서버에서 요청함)
checkListServer.post('/users/:userId/:estateId/checklists/init', async (req, res) => {
    console.log('Request received. Params:', req.params);
    const { userId, estateId } = req.params;

    if (!userId || !estateId) {
        return res.status(400).json({ message: '사용자 및 매물 ID가 필요합니다.' });
    }

    const client = await pool.connect();
    try {
        console.log("Attempting pool.connect()..."); // <--- 2. DB 연결 시도
        await client.query('BEGIN');
        console.log("Pool connected."); // <--- 3. DB 연결 성공
        // 삽입을 시작하기 전, 이전에 존재하던 모든 데이터를 삭제합니다. -> 동일 API로 여러번 호출되면 생길 수 있는 문제 방지
        console.log(`Attempting to DELETE old data for user: ${userId}, estate: ${estateId}`);
        await client.query(
            'DELETE FROM user_checklists WHERE user_id = $1 AND estate_id = $2',
            [userId, estateId]
        );
        console.log("DELETE complete."); // <-- 이 로그가 안 찍히면 DELETE에서 락(Lock)


        // --- 1. 'analysis' 카테고리 항목 삽입 ---

       // 1-1. ANALYSIS 테이블에서 '특정 유저'의 '특정 매물' 분석 결과 조회
        console.log(`Attempting to SELECT from analysis for user: ${userId}, estate: ${estateId}`);
        const analysisRes = await client.query(
            `SELECT title_section_analysis, part_a_analysis, part_b_analysis 
            FROM analysis 
            WHERE estate_id = $1 AND user_id = $2`, //user_id 조건 추가
            [estateId, userId] //파라미터에 userId 추가
        );
        console.log("SELECT from analysis complete."); // <-- 이 로그가 안 찍히면 SELECT에서 락(Lock)
        // --- 4. 확인 끝 ---

        if (analysisRes.rows.length === 0) {
            // 오류 메시지 수정
            throw new Error(`ESTATE ID (${estateId})와 USER ID (${userId})에 해당하는 분석 데이터를 찾을 수 없습니다.`);
        }

        const analysisData = analysisRes.rows[0];
        const titleIds = analysisData.title_section_analysis || []; // [1, 2]
        const partAIds = analysisData.part_a_analysis || [];     // [4, 6]
        const partBIds = analysisData.part_b_analysis || [];     // [9]

        // 모든 threat_id를 중복 제거하여 합침
        const allThreatIds = [...new Set([...titleIds, ...partAIds, ...partBIds])]; // [1, 2, 4, 6, 9]

        let insertedAnalysisCount = 0;

        if (allThreatIds.length > 0) {
            // 1-2. threat_id 목록으로 static 'checklists' 테이블 조회
            const checklistsRes = await client.query(
                // threat_id가 allThreatIds 배열($1) 안에 포함된 모든 checklist 항목 조회
                'SELECT checklist_id, threat_id FROM checklists WHERE threat_id = ANY($1::int[])',
                [allThreatIds]
            );
            const analysisChecklists = checklistsRes.rows; // [{checklist_id: 1, threat_id: 1}, {checklist_id: 2, threat_id: 2}, ...]

            // 1-3. 조회된 항목들을 'user_checklists' 테이블에 삽입
            const insertPromises = analysisChecklists.map(item => {
                const insertQuery = `
                    INSERT INTO user_checklists 
                        (user_checklist_id, checklist_id, user_id, estate_id, threat_id, category, is_checked)
                    VALUES 
                        (gen_random_uuid(), $1, $2, $3, $4, 'analysis', false)
                `;
                return client.query(insertQuery, [item.checklist_id, userId, estateId, item.threat_id]);
            });
            
            await Promise.all(insertPromises);
            insertedAnalysisCount = insertPromises.length;
        }

        // --- 3. 'before_contract' 등 나머지 정적 카테고리 항목 삽입 ---
        
        const STATIC_CATEGORIES_MAP = {
            'before_contract': [13, 14, 15],  // 계약 전
            'contract_day': [16, 17],       // 계약 당일
            'after_contract': [18, 19],     // 계약 이후
            'after_expiration': [20, 21]    // 계약 만료후
        };
        
        let insertedStaticCount = 0;

        // (3-2) 각 카테고리를 순회하며 'analysis'와 동일한 로직으로 삽입합니다.
        for (const [categoryName, threatIds] of Object.entries(STATIC_CATEGORIES_MAP)) {
            
            if (threatIds.length === 0) continue;

            // (3-3) threat_id로 static 'checklists' 테이블 조회
            const checklistsRes = await client.query(
                'SELECT checklist_id, threat_id FROM checklists WHERE threat_id = ANY($1::int[])',
                [threatIds]
            );
            const staticChecklists = checklistsRes.rows;

            if (staticChecklists.length === 0) continue; // 해당되는 체크리스트 항목이 없으면 스킵

            // (3-4) 조회된 항목들을 'user_checklists' 테이블에 삽입
            const insertPromises = staticChecklists.map(item => {
                const insertQuery = `
                    INSERT INTO user_checklists 
                        (user_checklist_id, checklist_id, user_id, estate_id, threat_id, category, is_checked)
                    VALUES 
                        (gen_random_uuid(), $1, $2, $3, $4, $5, false)
                `;
                // 5번째 파라미터($5)로 순회 중인 카테고리 이름(categoryName)을 사용
                return client.query(insertQuery, [item.checklist_id, userId, estateId, item.threat_id, categoryName]);
            });
            
            await Promise.all(insertPromises);
            insertedStaticCount += insertPromises.length;
        }

        await client.query('COMMIT');
        res.status(201).json({ 
            message: "체크리스트가 성공적으로 초기화되었습니다.",
            insertedAnalysisItems: insertedAnalysisCount,
            insertedStaticItems: insertedStaticCount
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("체크리스트 초기화 중 오류 발생:", err);
        res.status(500).json({ message: "서버 오류가 발생했습니다.", details: err.message });
    } finally {
        client.release();
    }
});

// 위험 분석 후 DB에 INSERT 하고,
// DB의 USER_CHECKLIST 테이블 조회
// 예시 URL host/users/1111/123/checklist?isChecked=true&category=analysis
// 체크리스트 조회 API
checkListServer.get('/users/:userId/:estateId/checklist', async (req, res) => {
    try {
        const userId = req.params.userId;
        const estateId = req.params.estateId;
        const isChecked = req.query.isChecked; // 'true' 또는 'false'
        const category = req.query.category; // 'analysis', 'before_contract' 등등

        if (!userId || !estateId) {
            return res.status(400).json({ message: '사용자 및 매물 ID가 필요합니다.' });
        }

        // [수정] user_checklists를 기준으로 checklists와 threats를 JOIN 합니다.
        let sqlQuery = `
            SELECT 
                uc.user_checklist_id, 
                uc.is_checked, 
                uc.category,
                uc.checklist_id,
                c.text,                 -- checklists(static) 테이블의 실제 항목 텍스트
                t.threat_id,
                t.threat_name,          -- threats(static) 테이블의 위협 이름
                t.risk_level,
                t.contents AS threat_contents
            FROM 
                user_checklists uc
            JOIN 
                checklists c ON uc.checklist_id = c.checklist_id
            JOIN 
                threats t ON uc.threat_id = t.threat_id
            WHERE 
                uc.user_id = $1 AND uc.estate_id = $2
        `;
        const params = [userId, estateId];
        let paramIndex = 3; //파라미터 삽입위치

        // isChecked 값에 따른 필터링 조건 추가
        if (isChecked === 'true') {
            sqlQuery += ` AND uc.is_checked = TRUE`;
        } else if (isChecked === 'false') {
            sqlQuery += ` AND uc.is_checked = FALSE`;
        }

        // category 값에 따라서 파라미터 값 추가 필터링
        if (category) {
            sqlQuery += ` AND uc.category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        // 특정 순서로 정렬하는 ORDER BY CASE 문 -> 우선순위 부여
        sqlQuery += `
            ORDER BY
                CASE uc.category
                    WHEN 'analysis' THEN 1
                    WHEN 'before_contract' THEN 2
                    WHEN 'contract_day' THEN 3
                    WHEN 'after_contract' THEN 4
                    WHEN 'after_expiration' THEN 5
                    ELSE 99
                END, uc.created_at, c.checklist_id;
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

// 체크리스트 제출(업데이트)
checkListServer.put('/users/:userId/:estateId/checklists', async (req, res) => {
    const { userId, estateId } = req.params;
    const checklistsToUpdate = req.body.checklists; // 클라이언트에서 보낸 배열 데이터
    
    if (!userId || !estateId) {
        return res.status(400).json({ message: "사용자 및 매물 ID가 필요합니다." });
    }
    if (!checklistsToUpdate || !Array.isArray(checklistsToUpdate) || checklistsToUpdate.length === 0) {
        return res.status(400).json({ message: "업데이트할 체크리스트 데이터가 필요합니다." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updatePromises = checklistsToUpdate.map(async (item) => {
            // 클라이언트는 'user_checklist_id'와 'is_checked'를 보내야 함
            const { user_checklist_id, is_checked } = item;

            // 데이터 타입 검증 (변수명 수정)
            if (typeof user_checklist_id !== 'string' || typeof is_checked !== 'boolean') {
                throw new Error("유효하지 않은 체크리스트 데이터 형식입니다. (user_checklist_id: string, is_checked: boolean)");
            }

            // [수정] 'checklists' -> 'user_checklists' 테이블을 업데이트합니다.
            const updateQuery = `
                UPDATE user_checklists 
                SET is_checked = $1
                WHERE user_id = $2
                AND estate_id = $3
                AND user_checklist_id = $4
                RETURNING *;
            `;
            const values = [is_checked, userId, estateId, user_checklist_id];
            return client.query(updateQuery, values);
        });

        const results = await Promise.all(updatePromises);
        await client.query('COMMIT');

        res.status(200).json({
            message: "체크리스트 상태가 성공적으로 업데이트되었습니다.",
            updatedChecklists: results.map(result => result.rows[0])
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("트랜잭션 중 오류 발생:", error);
        res.status(500).json({ message: "서버 오류가 발생했습니다.", details: error.message });
    } finally {
        client.release();
    }
});
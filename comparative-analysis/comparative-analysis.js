const express = require('express')
const estatesCompareServer = express() // 추후에 위험 분석 서버 내부의 한 서비스로 라우팅할 예정
const axios = require('axios')
const cors = require('cors')
const { query } = require('./db.js') // DB 쿼리 실행 함수 가져옴
// 환경변수 모듈 
require('dotenv').config();
// 제미나이 모듈
const { GoogleGenAI } = require("@google/genai");

// .env 파일에서 API 키
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("오류: GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다.");
    process.exit(1); // 서버 시작 중단
}

estatesCompareServer.use(cors()) // 모든 요청 받을 예정 -> 이후 수정 예정
estatesCompareServer.use(express.json()); // 

// K8s Deployment의 containerPort와 일치시켜야 합니다.
const PORT = 3000;

async function initializeDatabase() {
    console.log('DB 테이블 초기화를 시작합니다.');

    // 테이블 생성 SQL 쿼리 목록
    const createTableQueries = [
        // 1. users_analysis 테이블
        `
        CREATE TABLE IF NOT EXISTS users_analysis (
            user_id TEXT PRIMARY KEY,
            user_name VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            token VARCHAR(255)
        );
        `,
        // 2. ESTATES 테이블
        `
        CREATE TABLE IF NOT EXISTS estates (
            estate_id UUID PRIMARY KEY,
            estate_name VARCHAR(255),
            estate_address VARCHAR(255),
            zip_no VARCHAR(10),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        `,
        // 3. THREATS (정적) 테이블 [수정됨]
        `
        CREATE TABLE IF NOT EXISTS threats (
            threat_id SERIAL PRIMARY KEY,
            threat_name VARCHAR(50) NOT NULL,
            contents TEXT,
            risk_level INT,
            category VARCHAR(10) NOT NULL CHECK (category IN ('title', 'a', 'b', 'extra'))
        );
        `,
        // 4. ANALYSIS 테이블
        `
        CREATE TABLE IF NOT EXISTS analysis (
            analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            estate_id UUID REFERENCES estates(estate_id) ON DELETE CASCADE,
            user_id TEXT REFERENCES users_analysis(user_id) ON DELETE CASCADE,
            risk_score INT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            title_section_analysis JSONB,
            part_a_analysis JSONB,
            part_b_analysis JSONB
        );
        `,
        // 5. INTERACTIONS 테이블
        `
        CREATE TABLE IF NOT EXISTS interactions (
            interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT REFERENCES users_analysis(user_id) ON DELETE CASCADE,
            estate_id UUID REFERENCES estates(estate_id) ON DELETE CASCADE,
            
            interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('isNotified', 'analysisCompleted', 'interested', 'contractCompleted')),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        `
    ];

    try {
        // 모든 쿼리를 순차적으로 실행
        for (const sql of createTableQueries) {
            await query(sql, []);
        }
        console.log('모든 데이터베이스 테이블이 성공적으로 준비되었습니다.');
    } catch (err) {
        console.error('데이터베이스 테이블 초기화 중 오류 발생:', err.message);
        process.exit(1);
    }
}

// DB 초기화 후 서버 리스닝 시작
initializeDatabase().then(() => {
    // 0.0.0.0으로 호스트를 지정해야 Docker 컨테이너 외부에서 접근이 가능합니다.
    estatesCompareServer.listen(PORT, '0.0.0.0', () => {
        console.log(`comparative-analysis server listening on port ${PORT}`);
    });
}).catch(err => {
    // initializeDatabase에서 이미 process.exit(1)을 했지만, 혹시 모를 상황 대비
    console.error('서버 시작 중 오류 발생:', err);
    process.exit(1);
});

estatesCompareServer.get('/', (req, res) => {
    // 이 서버가 어떤 서버인지 식별할 수 있는 메시지를 반환합니다.
    res.send('Hello from Express! (comparative-analysis server v1)');
});

// 제미나이 연결
const ai = new GoogleGenAI(GEMINI_API_KEY);
estatesCompareServer.get('users/:userId/ai/ask', async (req, res) => {
    try {
        const { userId } = req.params; 
        const userPrompt = req.query.prompt;

        const threatQuery = {
            text: `
                SELECT DISTINCT t.threat_name 
                FROM threats t
                JOIN user_checklists uc ON t.threat_id = uc.threat_id
                WHERE uc.user_id = $1
            `,
            values: [userId],
        };

        const dbResponse = await query(threatQuery.text, threatQuery.values);        
        const threatNames = dbResponse.rows.map(row => row.threat_name);

        let promptPrefix = "";
        
        if (threatNames.length > 0) {
            // 유저가 가진 위험이 있다면, 쉼표(,)로 구분된 문자열로 만듭니다.
            const threatString = threatNames.join(', ');
            promptPrefix = `사용자가 가진 체크리스트 위험은 ${threatString}입니다. `;
        }
        
        // [수정] 최종 프롬프트 = (위험 정보) + (사용자 질문)
        const finalPrompt = promptPrefix + userPrompt;

        // (디버깅용) 최종 프롬프트 확인
        console.log("Final Prompt to AI:", finalPrompt);

        // 7. AI 모델 호출
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: finalPrompt, // [수정] 기존 prompt 대신 finalPrompt 사용
        });

        res.status(200).json(response.text);
        console.log(response.text);

    } catch (error) {
        // [수정] 에러 핸들링
        console.error("Error in /ai/ask route:", error);
        res.status(500).json({ error: "AI 요청 중 오류가 발생했습니다." });
    }
});

// 주소 검색 API -> 추후 라우터로 분리 예정
const confmKey = "devU01TX0FVVEgyMDI1MDkyNTEwMTgzOTExNjI2NDU="

estatesCompareServer.get('/estates/search', async (req, res) => {
    try {
        const keyword = req.query.keyword;
        if (!keyword) {
            return res.status(400).json({ message: '검색할 키워드를 입력해주세요.' });
        }
        const currentPage = 1;
        const countPerPage = 10;
        const searchAddressURL = "https://business.juso.go.kr/addrlink/addrLinkApi.do"
        const params = { // 요청시 쿼리 파라미터를 넘기면 자동으로 ?와 &와 연결해서 할당
            currentPage: 1,
            countPerPage: 10,
            keyword: keyword,
            confmKey: confmKey,
            hstryYn: 'Y',
            firstSort: 'road',
            resultType: 'json'
        };

        const apiResponse = await axios.get(searchAddressURL, { // 두번째 인자는 옵션, 여러 옵션이 들어갈 수 있기 때문에 객체 리터럴
            params: params
        });

        console.log(apiResponse);

        const totalCount = apiResponse.data.results.common.totalCount;
        const addressData = apiResponse.data.results.juso || [];
        const filteredAddressData = addressData.map(estate => {
            return {
                roadAddr: estate.roadAddr,
                zipNo: estate.zipNo,
                bdNm: estate.bdNm
            };
        });

        console.log("검색 결과 매물 수 : " + totalCount);
        console.log(filteredAddressData);

        if (filteredAddressData.length === 0) {
            return res.status(200).json({
                message: "검색 결과가 없습니다.",
                data: []
            });
        }

        res.status(200).json({
            message: "주소 검색 결과를 성공적으로 가져왔습니다.",
            data: filteredAddressData
        });
    }
    catch (err) {
        console.error("주소 API 조회 중 오류 발생:", err.message);
        res.status(500).json({ message: "주소 검색 중 서버 오류가 발생했습니다." });
    }
});


// 매물 목록 조회 서비스
// analysisDB/USER_INTERACTION 테이블에서 원하는 매물 목록 조회
// URL 예시 host/users/123/estates?analysisCompleted=true
estatesCompareServer.get('/users/:userId/estates', async (req, res) => {
    try {
        // 경로 파라미터는 userId로 받아야 합니다.
        const userId = req.params.userId;
        const { analysisCompleted, contractCompleted, isNotified, interested } = req.query;

        // userId로 파라미터 이름 수정
        if (!userId) {
            return res.status(400).json({ message: "사용자 ID가 필요합니다." });
        }

        // 각 매물 조회 쿼리
        // 쿼리들을 동적 구성을 위해 제거하고 단일 쿼리로 통합합니다.
        let sqlQuery = `
        SELECT
            ui.user_id,
            ui.estate_id,
            ui.created_at,
            ui.interaction_type,
            e.estate_address  -- estate_analysis 테이블에서 주소 정보 추가
        FROM
            interactions ui
        JOIN -- INNER JOIN을 사용하여 두 테이블에 모두 존재하는 레코드만 가져옵니다.
            estates e ON ui.estate_id = e.estate_id
        WHERE
            ui.user_id = $1
`;
        const params = [userId];

        // 쿼리 필터링을 동적으로 처리하여 복합 조건을 지원합니다.
        const interactionTypes = [];

        // req.query 값을 문자열 'true'와 비교합니다.
        if (analysisCompleted === 'true') {
            interactionTypes.push('analysisCompleted');
        }
        if (contractCompleted === 'true') {
            interactionTypes.push('contractCompleted');
        }
        if (isNotified === 'true') {
            interactionTypes.push('isNotified');
        }
        if (interested === 'true') {
            interactionTypes.push('interested');
        }

        if (interactionTypes.length > 0) {
            const placeholders = interactionTypes.map((_, index) => `$${params.length + index + 1}`).join(', ');
            sqlQuery += ` AND interaction_type IN (${placeholders})`;
            params.push(...interactionTypes);
        }

        // 동적 쿼리로 대체했으므로 if/else 블록 제거 후 바로 쿼리 실행
        const response = await query(sqlQuery, params);

        // DB 결과의 행 개수는 .rows.length로 확인합니다.
        if (response.rows.length === 0) {
            return res.status(404).json({ message: "찾을 매물이 없습니다." });
        }

        const filteredEstates = response.rows.map(estate => ({
            estateId: estate.estate_id,
            userId: estate.user_id,
            createdAt: estate.created_at,
            interactionType: estate.interaction_type,
            estateAddress: estate.estate_address
        }));

        res.status(200).json({
            message: "매물 목록을 성공적으로 가져왔습니다.",
            data: filteredEstates
        });

    } catch (err) {
        console.error("데이터베이스 조회 중 오류 발생:", err);
        res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
});

// 원하는 분석 완료 매물 2개 선택 후 비교
// URL 예시 host/users/1111/comparison?estate1Id=123&estate2Id=321
estatesCompareServer.get('/users/:userId/comparison', async (req, res) => {
    const userId = req.params.userId;
    const estate1Id = req.query.estate1Id
    const estate2Id = req.query.estate2Id

    if (!estate1Id || !estate2Id) {
        return res.status(400).json({ message: "비교할 두 매물의 ID가 필요합니다." });
    }

    try {
        // 첫 번째 매물(estate1Id)의 최신 데이터 조회
        const estateAnalysisQuery = `
            SELECT
                risk_score,
                title_section_analysis,
                part_a_analysis,
                part_b_analysis
            FROM
                analysis
            WHERE
                estate_id = $1
                AND user_id = $2
            ORDER BY
                created_at DESC
            LIMIT 1;
        `;

        // 💡 수정 7: pool.query, db.query 대신 가져온 query 함수 사용 및 Promise.all로 병렬 처리
        const [result1, result2] = await Promise.all([
            query(estateAnalysisQuery, [estate1Id, userId]), // userId 추가
            query(estateAnalysisQuery, [estate2Id, userId])  // userId 추가
        ]);

        // 두 번째 매물(estate2Id)의 최신 데이터 조회
        // 💡 수정: 중복 쿼리 정의 제거 (estateAnalysisQuery로 대체됨)

        // 데이터가 없는 경우 처리
        if (result1.rows.length === 0 || result2.rows.length === 0) {
            return res.status(404).json({ message: "해당 매물의 분석 데이터를 찾을 수 없습니다." });
        }

        // 조회된 데이터를 객체에 담기
        const estate1Data = result1.rows[0];
        const estate2Data = result2.rows[0];

        // 두 매물의 risk_score 차이
        const riskScoreDifference = estate1Data.risk_score - estate2Data.risk_score;

        // 클라이언트에 데이터 반환
        res.status(200).json({
            estate1Data,
            estate2Data,
            riskScoreDifference // 계산된 차이를 추가
        });

        // 클라이언트에 데이터 반환
        // 💡 수정: 중복된 응답 제거

    } catch (err) {
        console.error("데이터베이스 조회 중 오류 발생:", err);
        res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
});

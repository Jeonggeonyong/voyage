const express = require('express')
const estatesCompareServer = express() // 추후에 위험 분석 서버 내부의 한 서비스로 라우팅할 예정
const axios = require('axios')
const cors = require('cors')
// import { query } from '../oauth2/db.js' // 원래의 import 대신 require로 변경
const { query } = require('../oauth2/db.js') // DB 쿼리 실행 함수 가져옴

estatesCompareServer.use(cors()) // 모든 요청 받을 예정 -> 이후 수정 예정
estatesCompareServer.use(express.json()); // 

// K8s Deployment의 containerPort와 일치시켜야 합니다.
const PORT = 3000;

estatesCompareServer.get('/', (req, res) => {
    // 이 서버가 어떤 서버인지 식별할 수 있는 메시지를 반환합니다.
    res.send('Hello from Express! (comparative-analysis server v1)');
});

// 0.0.0.0으로 호스트를 지정해야 Docker 컨테이너 외부에서 접근이 가능합니다.
estatesCompareServer.listen(PORT, '0.0.0.0', () => {
    console.log(`comparative-analysis server listening on port ${PORT}`);
});

// 매물 위험도 비교 서비스

// analysisDB/USER_INTERACTION 테이블에서 원하는 매물 목록 조회
// URL 예시 host/users/123/estates?analysisCompleted=true
estatesCompareServer.get('/users/:userId/estates', async (req, res) => {
    try {
        // 경로 파라미터는 userId로 받아야 합니다.
        const userId = req.params.userId; 
        const { analysisCompleted, contractCompleted, subscribed, interested } = req.query;

        // userId로 파라미터 이름 수정
        if (!userId) {
            return res.status(400).json({ message: "사용자 ID가 필요합니다." });
        }

        // 각 매물 조회 쿼리
        // 쿼리들을 동적 구성을 위해 제거하고 단일 쿼리로 통합합니다.
        let sqlQuery = `
            SELECT estate_id, estate_address, user_id, created_at, interaction_type 
            FROM USER_INTERACTION
            WHERE user_id = $1
        `;
        const params = [userId];
        
        // 쿼리 필터링을 동적으로 처리하여 복합 조건을 지원합니다.
        const interactionTypes = [];

        // req.query 값을 문자열 'true'와 비교합니다.
        if (analysisCompleted === 'true') {
            interactionTypes.push('analysis_completed');
        }
        if (contractCompleted === 'true') {
            interactionTypes.push('contract_completed');
        }
        if (subscribed === 'true') {
            interactionTypes.push('subscribed');
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
            estate_address: estate.estate_address,
            userId: estate.user_id,
            createdAt: estate.created_at
        }));

        res.status(200).json({
            message: "분석 완료 매물 목록을 성공적으로 가져왔습니다.",
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
        // 💡 수정: 쿼리 문자열 통합
        const estateAnalysisQuery = `
            SELECT
                risk_score,
                title_section_analysis,
                part_a_analysis,
                part_b_analysis
            FROM
                analysisDB
            WHERE
                estate_id = $1
            ORDER BY
                created_at DESC
            LIMIT 1;
        `;
        
        // 💡 수정 7: pool.query, db.query 대신 가져온 query 함수 사용 및 Promise.all로 병렬 처리
        const [result1, result2] = await Promise.all([
            query(estateAnalysisQuery, [estate1Id]),
            query(estateAnalysisQuery, [estate2Id])
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

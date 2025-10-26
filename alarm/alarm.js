const express = require('express')
const axios = require('axios')
const cors = require('cors')
const { default: nodeCron } = require('node-cron')
const { query } = require('./db.js');

// 푸시 알림 관련 모듈 -> 클라이언트에서 토큰 사용
// const admin = require('firebase-admin');
// const serviceAccount = require("./estatesanalysisalarm-firebase-adminsdk-fbsvc-39c69e4e62.json");
/*admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});*/

const notifyServer = express()
notifyServer.use(cors()) // 모든 요청 받을 예정 -> 이후 수정 예정
notifyServer.use(express.json()); // json 형식으로 받을 것

// K8s Deployment의 containerPort와 일치시켜야 합니다.
const PORT = 3000;

async function initializeDatabase() {
    console.log('🔄 데이터베이스 테이블 초기화를 시작합니다...');
    
    // 테이블 생성 SQL 쿼리 목록 (3개 테이블만)
    const createTableQueries = [
        // 1. USER_alarm 테이블
        `
        CREATE TABLE IF NOT EXISTS "user_alarm" (
            user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_name VARCHAR(50),
            email VARCHAR(255),
            password VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            phone_number VARCHAR(20),
            home_address VARCHAR(255)
        );
        `,
        // 2. ESTATE_alarm 테이블
        `
        CREATE TABLE IF NOT EXISTS "estate_alarm" (
            estate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            estate_name VARCHAR(255),
            estate_address VARCHAR(255),
            zip_no VARCHAR(10),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        `,
        // 3. NOTI_INFO_alarm 테이블
        `
        CREATE TABLE IF NOT EXISTS "noti_info_alarm" (
            alarm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES user_alarm(user_id) ON DELETE CASCADE,
            estate_id UUID REFERENCES estate_alarm(estate_id) ON DELETE CASCADE,
            is_active BOOLEAN DEFAULT TRUE,
            frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('1 month', '3 months', '6 months', '1 year')),
            last_notified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
        console.error('데이터베이스 테이블 초기화 중 치명적인 오류 발생:', err.message);
        process.exit(1); 
    }
}

// DB 초기화 후 서버 리스닝 시작
initializeDatabase().then(() => {
    // 0.0.0.0으로 호스트를 지정해야 Docker 컨테이너 외부에서 접근이 가능합니다.
    notifyServer.listen(PORT, '0.0.0.0', () => {
        console.log(`ALARM server listening on port ${PORT}`);
    });
}).catch(err => {
    console.error('서버 시작 중 오류 발생:', err);
    process.exit(1);
});

notifyServer.get('/', (req, res) => {
    // 이 서버가 어떤 서버인지 식별할 수 있는 메시지를 반환합니다.
    res.send('Hello from Express! (ALARM server v1)');
});



// notiInfoDB(alarmId, userId, estateId, isActive, frequency, lastNotifiedAt)

// 주기적 동작, DB에서 조건에 해당하는 유저 정보 조회
nodeCron.schedule("0 * * * *", async () => { 
    console.log("알림 보낼 유저 탐색");
    const users = await findAlarmUser();
    const userLength = users.length;
    if (userLength > 0) {
        // sendAlarm(users); 
        console.log(`알림 발송 예정 유저 ${userLength}명. (Firebase 설정 대기 중)`);
        console.log("--- 알림 예정 유저 목록 ---");
        users.forEach((user, index) => {
            // 사용자 ID, 구독 ID, FCM 토큰의 일부를 출력하여 정보를 확인합니다.
            console.log(`[${index + 1}] UserID: ${user.user_id}, SubscriptionID: ${user.alarm_id}`);
        });
        console.log("---------------------------");
        
        // sendAlarm(users); 
        console.log(`(Firebase 설정 대기 중)`);
        // 실제 운영에서는 sendAlarm 내부에서 성공 사용자만 업데이트해야 합니다.
        await updateLastNotifiedAt(users); 
    }
    else {
        console.log("조회된 알림이 없습니다.")
    }
});

async function findAlarmUser() { // 해당 코드 fcm_token SELECT는 삭제한 상태 -> 클라이언트 조율 후 구현 예정
    const findQuery = `
        SELECT alarm_id, user_id
        FROM noti_info_alarm
        WHERE is_active = TRUE
        AND last_notified_at <= CURRENT_DATE - INTERVAL '1 month' * CASE
            WHEN frequency = '1 month' THEN 1
            WHEN frequency = '3 months' THEN 3
            WHEN frequency = '6 months' THEN 6
            WHEN frequency = '1 year' THEN 12
        END;`;
    const response = await query(findQuery); 
    return response.rows;
}

/*
async function sendAlarm(users) {
    // ... (Firebase Admin SDK 로직)
}
*/

async function updateLastNotifiedAt(users) {
    // 1. users 배열에 데이터가 없으면 함수를 종료합니다.
    if (users.length === 0) return;

    // 2. users 배열에서 userId만 추출합니다.
    const userIds = users.map(user => user.user_id); 

    // 3. userIds 배열을 SQL IN 절에 매개변수화된 형태로 사용하기 위해 $1, $2, ... 플레이스홀더를 만듭니다.
    const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');

    const updateQuery = `
        UPDATE noti_info_alarm
        SET last_notified_at = CURRENT_DATE
        WHERE user_id IN (${placeholders});
    `;

    // 4. 쿼리를 실행합니다. params 배열에 실제 userIds를 전달합니다.
    await query(updateQuery, userIds);

    // 5. 업데이트된 사용자 수를 로그로 출력합니다.
    console.log(`${userIds.length}명의 last_notified_at이 업데이트되었습니다.`);
}


//매물 조회API(위험 분석 서버 API 요청하고 받은 데이터 클라이언트에 전송)
notifyServer.get('/users/:userId/estates', async (req, res) => { 
    const userId = req.params.userId;
    // 불리언으로 변환
    const isNotified = req.query.isNotified === 'true';
    const analysisCompleted = req.query.analysisCompleted === 'true';

    const threatAnalysisServer = "http://comparative-analysis.voyage-app-02/users/" + userId + "/estates";

    try {
        const params = {};
        if (isNotified) {
            params.isNotified = true;
        }
        if (isCompleted) {
            params.isCompleted = true;
        }

        const response = await axios.get(threatAnalysisServer, { params });
        const estateInfo = response.data; // 응답 데이터

        res.status(200).json({
            estateAddress: estateInfo,
            message: "성공적으로 매물을 조회했습니다."
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "매물을 조회하는 중 오류가 발생했습니다."
        });
    }
});

//알리미 매물 신청 제출
notifyServer.post('/users/subscription', async (req, res) => {
    // 사용자 요청 body에서 데이터 추출
    const { userId, estateId, frequency } = req.body;

    try {
        // 이미 존재하는지 확인
        const checkQuery = 'SELECT * FROM noti_info_alarm WHERE user_id = $1 AND estate_id = $2'; 
        const checkResult = await query(checkQuery, [userId, estateId]);

        if (checkResult.rows.length > 0) {
            // 존재하면, isActive를 true로 업데이트
            const updateQuery = 'UPDATE noti_info_alarm SET is_active = TRUE, frequency = $1, last_notified_at = NOW() WHERE user_id = $2 AND estate_id = $3';
            await query(updateQuery, [frequency, userId, estateId]);
        } else {
            // 없다면 새로운 데이터 삽입
            const insertQuery = 'INSERT INTO noti_info_alarm (user_id, estate_id, frequency) VALUES ($1, $2, $3)'; 
            await query(insertQuery, [userId, estateId, frequency]);
        }

        res.status(201).json({
            message: "알리미 신청이 완료되었습니다.",
            data: { userId, estateId, frequency }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
});

//알리미 매물 취소
notifyServer.delete('/users/subscription/:subscriptionID', async (req, res) => {
    const subscriptionID = req.params.subscriptionID;

    // DB에서 alarm_id로 조회해서 isActive 상태를 false로 변경
    const updateQuery = "UPDATE noti_info_alarm SET is_active = FALSE WHERE alarm_id = $1";
    await query(updateQuery, [subscriptionID]);

    res.status(201).json({
        message: "알리미 취소가 완료되었습니다.",
        data: { subscriptionID: subscriptionID } 
    });
});

//알리미 매물 frequency 변경
notifyServer.patch('/users/subscription/:subscriptionID', async (req, res) => {
    const subscriptionID = req.params.subscriptionID;
    const frequency = req.body.frequency;

    // DB에서 subscriptionID로 조회해서 frequency를 변경하고, lastNotifiedAt을 현재시각으로 변경
    const updateQuery = "UPDATE noti_info_alarm SET frequency = $1, last_notified_at = NOW() WHERE alarm_id = $2";
    await query(updateQuery, [frequency, subscriptionID]);

    res.status(201).json({
        message: "알리미 주기 변경이 완료되었습니다.",
        data: { subscriptionID: subscriptionID, frequency: frequency } 
    });
});

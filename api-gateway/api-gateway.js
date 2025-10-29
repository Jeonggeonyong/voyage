require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const proxy = require('express-http-proxy'); // 👈 프록시 라이브러리 import
const { query } = require('./db'); // DB 쿼리 함수

const app = express();
// express-http-proxy는 자체적으로 body를 스트리밍하므로 express.json()이 필요 없을 수 있습니다.
// 만약 다른 미들웨어가 JSON body를 필요로 한다면 남겨두세요.
// app.use(express.json());

// --- CORS 설정 ---
const corsOptions = {
    origin: 'http://localhost:5500', // 로컬 테스트 환경 주소
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// --- CORS 설정 끝 ---

// [설정] 라우팅할 서비스 목록 (FQDN 사용 필수!)
const services = {
    '/oauth2': 'http://service-oauth2.voyage-app-02.svc.cluster.local',
    '/alarm': 'http://service-alarm.voyage-app-02.svc.cluster.local',
    '/risk-analysis': 'http://service-risk-analysis.voyage-app-02.svc.cluster.local',
    '/community': 'http://service-community.voyage-app-02.svc.cluster.local',
    '/comparative-analysis': 'http://service-comparative-analysis.voyage-app-02.svc.cluster.local', // 실제 서비스 이름 확인
    '/checklist': 'http://service-checklist.voyage-app-02.svc.cluster.local' // 실제 서비스 이름 확인
};

// [설정] JWT 인증이 필요 없는 공개 경로 목록
const publicRoutes = ['/oauth2'];

// --- 인증 미들웨어 (DB 조회 포함) ---
const authenticateJWT = async (req, res, next) => {
    const isPublic = publicRoutes.some(route => req.path.startsWith(route));
    if (isPublic) {
        return next(); // 공개 경로면 통과
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized. Token required.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('JWT 검증 성공 (payload):', decoded); // decoded.id는 Google ID

        // Google ID로 DB에서 사용자 PK 조회
        const { rows } = await query('SELECT id FROM users WHERE google_id = $1', [decoded.id]);

        if (rows.length === 0) {
            console.warn(`Authentication Error: User (google_id) ${decoded.id} not found in DB.`);
            return res.status(401).json({ message: 'Unauthorized. User not found.' });
        }

        // req 객체에 DB 사용자 ID 저장 (나중에 프록시 헤더에 추가하기 위해)
        req.dbUserId = rows[0].id;
        req.userEmail = decoded.email; // 이메일도 저장
        next();
    } catch (error) {
        console.error('JWT Verification Error:', error.message);
        return res.status(403).json({ message: 'Forbidden. Invalid token.' });
    }
};
// --- 인증 미들웨어 끝 ---

// 모든 요청에 대해 인증 미들웨어를 먼저 거치도록 설정
app.use(authenticateJWT);

// --- 프록시 라우팅 설정 ---
for (const prefix in services) {
    const target = services[prefix];

    app.use(prefix, proxy(target, {
        // 옵션: 프록시 요청 보내기 전 옵션 설정
        proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
            // 인증 미들웨어에서 저장한 사용자 정보를 헤더에 추가
            if (srcReq.dbUserId) {
                proxyReqOpts.headers['x-user-id'] = srcReq.dbUserId;
            }
            if (srcReq.userEmail) {
                proxyReqOpts.headers['x-user-email'] = srcReq.userEmail;
            }
            // 원래 호스트 헤더 대신 타겟 서비스의 호스트 사용 (K8s 환경에서 중요할 수 있음)
            proxyReqOpts.headers['host'] = new URL(target).hostname;

            console.log(`Proxying ${srcReq.method} ${srcReq.originalUrl} to ${target}`);
            return proxyReqOpts;
        },
        // 옵션: 프록시 요청 경로 설정 (원본 경로 그대로 전달)
        proxyReqPathResolver: function (req) {
            const originalPath = req.originalUrl;
            console.log(`Resolving path: ${originalPath}`);
            return originalPath;
        },
        // 옵션: 백엔드 서비스 에러 처리
        userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
            if (proxyRes.statusCode >= 400) {
                 console.error(`Error response from backend service (${proxyRes.statusCode}):`, proxyResData.toString('utf8'));
                 // 클라이언트에게 에러 메시지를 좀 더 친절하게 전달할 수도 있음
                 // return JSON.stringify({ message: "Backend service error." });
            }
            return proxyResData; // 성공 시 데이터 그대로 반환
        }
    }));
}
// --- 프록시 라우팅 끝 ---

// 매칭되는 서비스 경로가 없을 경우 404 처리
app.use((req, res) => {
    res.status(404).json({ message: 'Not Found. No matching service route.' });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => { // 👈 컨테이너 외부 접근을 위해 '0.0.0.0' 추가
    console.log(`API Gateway server running on port ${PORT}`);
});
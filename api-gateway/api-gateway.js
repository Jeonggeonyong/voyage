require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { query } = require('./db');

const app = express();
// JSON 요청 처리를 위해 유지합니다. 파일 업로드는 아래에서 다르게 처리합니다.
app.use(express.json());

// --- CORS 설정 ---
const corsOptions = {
    origin: 'http://localhost:5500',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// --- CORS 설정 끝 ---

// [설정] 라우팅할 서비스 목록 (FQDN 사용 필수!)
const services = {
    '/oauth2': { target: 'http://service-oauth2.voyage-app-02.svc.cluster.local' },
    '/alarm': { target: 'http://service-alarm.voyage-app-02.svc.cluster.local' },
    '/risk-analysis': { target: 'http://service-risk-analysis.voyage-app-02.svc.cluster.local' },
    '/community': { target: 'http://service-community.voyage-app-02.svc.cluster.local' },
    '/comparative-analysis': { target: 'http://service-comparative-analysis.voyage-app-02.svc.cluster.local' },
    '/checklist': { target: 'http://service-checklist.voyage-app-02.svc.cluster.local' }
};

// [설정] JWT 인증이 필요 없는 공개 경로 목록
const publicRoutes = ['/oauth2'];

// --- 인증 미들웨어 (이전과 동일) ---
const authenticateJWT = async (req, res, next) => {
    // ... (인증 로직 변경 없음) ...
    const isPublic = publicRoutes.some(route => req.path.startsWith(route));
    if (isPublic) {
        return next();
    }
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { rows } = await query('SELECT id FROM users WHERE google_id = $1', [decoded.id]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Unauthorized. User not found.' });
        }
        req.headers['x-user-id'] = rows[0].id; // DB PK 전달
        req.headers['x-user-email'] = decoded.email;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Forbidden.' });
    }
};
app.use(authenticateJWT);
// --- 인증 미들웨어 끝 ---

// --- 프록시 요청 처리 ---
app.use('/', (req, res) => { // async 제거 (스트림 파이핑을 위해)
    for (const prefix in services) {
        if (req.path.startsWith(prefix)) {
            const { target } = services[prefix];
            const targetUrl = new URL(target);

            // [수정] Prefix 제거 로직 (필요하다면 유지, 필요 없다면 req.originalUrl 사용)
            const backendPath = req.originalUrl.substring(prefix.length) || '/';
            const url = `${targetUrl.origin}${backendPath}`;

            console.log(`Forwarding request for '${req.originalUrl}' to ${url}`);

            // [ 여기가 핵심 수정 ]
            // axios 대신 req 스트림을 직접 파이핑합니다.
            req.pipe(axios({
                method: req.method,
                url: url,
                // data: req.body, // 제거: req.body 대신 스트림 사용
                headers: {
                    // 원본 헤더 전달 (Content-Type 포함 중요!)
                    ...req.headers,
                    // 인증 미들웨어에서 추가한 헤더 포함
                    'x-user-id': req.headers['x-user-id'],
                    'x-user-email': req.headers['x-user-email'],
                    // 호스트 헤더는 백엔드 서비스 것으로 교체
                    'host': targetUrl.hostname
                },
                responseType: 'stream',
                // 파일 업로드를 위해 제한 해제 (선택 사항이지만 안전)
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }).then(response => {
                // 백엔드 응답 헤더 설정
                res.status(response.status);
                // 중요 헤더만 선별적으로 전달하거나, 필요에 따라 모두 전달
                // 주의: 모든 헤더 전달 시 보안 문제 발생 가능성 있음 (예: set-cookie)
                 Object.keys(response.headers).forEach(key => {
                    // 예시: 특정 헤더만 전달
                    if (['content-type', 'content-length'].includes(key.toLowerCase())) {
                       res.setHeader(key, response.headers[key]);
                    }
                 });
                // 백엔드 응답 스트림을 클라이언트로 파이핑
                response.data.pipe(res);
            }).catch(error => {
                // 에러 처리 로직 (이전과 유사)
                console.error('--- Axios Error during Pipe ---');
                if (error.response) {
                    console.error('Status:', error.response.status);
                    console.error('Headers:', error.response.headers);
                    // 에러 응답 스트림 처리 (선택 사항)
                    let errorData = '';
                    error.response.data.on('data', chunk => errorData += chunk);
                    error.response.data.on('end', () => {
                         console.error('Data:', errorData);
                         const statusCode = error.response.status || 502;
                         res.status(statusCode).json({ message: 'Error forwarding to service (backend error).' });
                    });
                } else if (error.request) {
                    console.error('Request Error:', error.request);
                    res.status(502).json({ message: 'Error forwarding to service (no response).' });
                } else {
                    console.error('Error Message:', error.message);
                    res.status(500).json({ message: 'Error forwarding to service (setup error).' });
                }
            }));
            // [ 핵심 수정 끝 ]

            return; // 요청 처리 완료
        }
    }
    // 매칭되는 서비스 경로가 없을 경우 404
    res.status(404).json({ message: 'Not Found. No matching service route.' });
});
// --- 프록시 요청 처리 끝 ---

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Gateway server running on port ${PORT}`);
});
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // cors 라이브러리 불러오기
const { query } = require('./db'); // [추가] db.js의 query 함수 불러오기

const app = express();
app.use(express.json());

// --- CORS 설정 ---
const corsOptions = {
  origin: 'http://localhost:5500',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// --- CORS 설정 끝 ---

// [설정] 라우팅할 서비스 목록
const services = {
  '/oauth2': { target: 'http://service-oauth2.voyage-app-02' },
  '/alarm': { target: 'http://alarm.voyage-app-02' },
  '/risk-analysis': { target: 'http://risk-analysis.voyage-app-02' },
  '/community': { target: 'http://community.voyage-app-02' },
  '/comparative-analysis': { target: 'http://comparative-analysis.voyage-app-02' },
  '/checklist': { target: 'http://checklist.voyage-app-02' }
};

// [설정] JWT 인증이 필요 없는 공개 경로 목록
const publicRoutes = ['/oauth2'];

// 인증 미들웨어
const authenticateJWT = async (req, res, next) => {
  const isPublic = publicRoutes.some(route => req.path.startsWith(route));
  if (isPublic) {
    return next(); // 공개 경로면 통과
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('JWT 검증 성공 (payload):', decoded); // decoded.id는 Google ID

    // --- [최종 수정] ---
    // decoded.id (Google ID)를 사용해 'google_id' 컬럼에서 사용자를 찾습니다.
    const { rows } = await query('SELECT id FROM users WHERE google_id = $1', [decoded.id]);
    // --- [최종 수정 끝] ---

    if (rows.length === 0) {
      console.warn(`Authentication Error: User (google_id) ${decoded.id} not found in DB.`);
      return res.status(401).json({ message: 'Unauthorized. User not found.' });
    }

    // 마이크로서비스에는 DB의 PK (rows[0].id)를 전달
    const dbUserId = rows[0].id;
    req.headers['x-user-id'] = dbUserId;
    req.headers['x-user-email'] = decoded.email;
    next();
  } catch (error) {
    // JWT 만료 또는 서명 오류
    return res.status(403).json({ message: 'Forbidden.' });
  }
};

// 모든 요청에 대해 인증 미들웨어를 먼저 거치도록 설정
app.use(authenticateJWT);

// 프록시 요청 처리
app.use('/', async (req, res) => {
  for (const prefix in services) {
    if (req.path.startsWith(prefix)) {
      const { target } = services[prefix];
      const targetUrl = new URL(target);

      console.log(`Forwarding request for '${req.originalUrl}' to host '${targetUrl.hostname}'`);

      try {
        const newPath = req.originalUrl.substring(prefix.length);

        const response = await axios({
          method: req.method,
          url: `${targetUrl.origin}${newPath}`,
          data: req.body,
          headers: { ...req.headers, host: targetUrl.hostname },
          responseType: 'stream',
        });

        res.status(response.status);
        for (const [key, value] of Object.entries(response.headers)) {
          res.setHeader(key, value);
        }
        response.data.pipe(res);

      } catch (error) {
        console.error('--- Full Axios Error ---');
        if (error.response) {
          console.error('Data:', error.response.data);
          console.error('Status:', error.response.status);
          console.error('Headers:', error.response.headers);
        } else if (error.request) {
          console.error('Request:', error.request);
        } else {
          console.error('Error Message:', error.message);
        }
        console.error('--- End of Error ---');

        const statusCode = error.response ? error.response.status : 502;
        res.status(statusCode).json({ message: 'Error forwarding to service.' });
      }
      return;
    }
  }
  res.status(404).json({ message: 'Not Found.' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API Gateway server running on port ${PORT}`);
});

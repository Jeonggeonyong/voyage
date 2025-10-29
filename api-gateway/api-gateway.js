require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { query } = require('./db');

const app = express();
// [수정] express.json()을 제거합니다.
// 게이트웨이는 요청 본문의 형식을 몰라도 됩니다. (JSON, multipart/form-data 등)
// app.use(express.json());

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
  '/alarm': { target: 'http://service-alarm.voyage-app-02' },
  '/risk-analysis': { target: 'http://service-risk-analysis.voyage-app-02' },
  '/community': { target: 'http://service-community.voyage-app-02' },
  '/comparative-analysis': { target: 'http://service-comparative-analysis.voyage-app-02' },
  '/checklist': { target: 'http://service-checklist.voyage-app-02' }
};

// [설정] JWT 인증이 필요 없는 공개 경로 목록
const publicRoutes = ['/oauth2'];

// 인증 미들웨어
const authenticateJWT = async (req, res, next) => {
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
    console.log('JWT 검증 성공 (payload):', decoded);

    const { rows } = await query('SELECT id FROM users WHERE google_id = $1', [decoded.id]);

    if (rows.length === 0) {
      console.warn(`Authentication Error: User (google_id) ${decoded.id} not found in DB.`);
      return res.status(401).json({ message: 'Unauthorized. User not found.' });
    }

    const dbUserId = rows[0].id;
    req.headers['x-user-id'] = dbUserId;
    req.headers['x-user-email'] = decoded.email;
    next();
  } catch (error) {
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
          // [수정] req.body 대신 req 객체(스트림) 자체를 전달합니다.
          data: req,
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
          // [추가] 스트림 오류 시 처리
          if (error.response.data && typeof error.response.data.pipe === 'function') {
            error.response.data.pipe(res);
            return;
          }
        } else if (error.request) {
          console.error('Request:', error.request);
        } else {
          console.error('Error Message:', error.message);
        }
        console.error('--- End of Error ---');

        const statusCode = error.response ? error.response.status : 502;
        // [수정] 이미 스트림 오류를 처리했다면 json 응답을 보내지 않도록 체크
        if (!res.headersSent) {
          res.status(statusCode).json({ message: 'Error forwarding to service.' });
        }
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
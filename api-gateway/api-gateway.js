require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // cors 라이브러리 불러오기
const { query } = require('./db'); // [추가] db.js의 query 함수 불러오기

const app = express();
app.use(express.json());

// --- CORS 설정 ---
// 테스트 웹페이지의 출처를 명시적으로 허용합니다.
const corsOptions = {
  origin: 'http://localhost:5500', // Live Server의 기본 주소
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions)); // CORS 미들웨어 적용
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
// [수정] DB 조회를 위해 async 함수로 변경
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
    console.log('JWT 검증 성공:', decoded);

    // --- [추가] DB에서 실제 사용자 확인 ---
    // 'users' 테이블에 해당 id를 가진 사용자가 있는지 확인합니다.
    // (테이블 이름이 'users'가 아니라면 실제 환경에 맞게 수정해야 합니다.)
    const { rows } = await query('SELECT id FROM users WHERE id = $1', [decoded.id]);

    if (rows.length === 0) {
      // 토큰은 유효하지만 DB에 해당 사용자가 없는 경우 (예: 탈퇴한 회원)
      console.warn(`Authentication Error: User ID ${decoded.id} not found in DB.`);
      return res.status(401).json({ message: 'Unauthorized. User not found.' });
    }
    // --- [추가] 끝 ---

    req.headers['x-user-id'] = decoded.id;
    req.headers['x-user-email'] = decoded.email;
    next();
  } catch (error) {
    // JWT 자체의 오류 (예: 만료, 서명 불일치)
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
        // [수정] URL에서 prefix(예: /community)를 제거합니다.
        // (예: /community/posts/123?sort=new -> /posts/123?sort=new)
        const newPath = req.originalUrl.substring(prefix.length);

        const response = await axios({
          method: req.method,
          url: `${targetUrl.origin}${newPath}`, // [수정] newPath 사용
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
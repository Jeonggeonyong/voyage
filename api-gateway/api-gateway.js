require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // cors 라이브러리 불러오기

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
};

// [설정] JWT 인증이 필요 없는 공개 경로 목록
const publicRoutes = ['/oauth2'];

// 인증 미들웨어
const authenticateJWT = (req, res, next) => {
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
    req.headers['x-user-id'] = decoded.id;
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
        const response = await axios({
          method: req.method,
          url: `${targetUrl.origin}${req.originalUrl}`,
          data: req.body, // http 모듈과 달리 express는 body를 파싱해야 합니다. app.use(express.json()) 필요
          headers: { ...req.headers, host: targetUrl.hostname },
          responseType: 'stream',
        });

        res.status(response.status);
        for (const [key, value] of Object.entries(response.headers)) {
            res.setHeader(key, value);
        }
        response.data.pipe(res);

      } catch (error) {
        // --- 디버깅을 위해 이 부분을 수정 ---
        console.error('--- Full Axios Error ---');
        if (error.response) {
            // 서버가 응답을 했지만 상태 코드가 2xx가 아님
            console.error('Data:', error.response.data);
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        } else if (error.request) {
            // 요청은 했지만 응답을 받지 못함 (네트워크 오류)
            console.error('Request:', error.request);
        } else {
            // 요청 설정 중 에러 발생
            console.error('Error Message:', error.message);
        }
        console.error('--- End of Error ---');
        // --- 수정 끝 ---
        
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
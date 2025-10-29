require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const axios = require('axios');

// './userService.js' 파일에서 findOrCreateUser 함수를 가져옴
const { findOrCreateUser } = require('./userService');
// './analysisService.js' 파일에서 함수를 가져옴
const { checkInUserAnalysis } = require('./analysisService');

const app = express();
app.use(express.json());
app.use(cors());

// Oauth2 클라이언트 설정
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// API 게이트웨이의 /oauth2/ 경로를 통해 이 라우터가 호출
app.post('/', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ message: 'Need auth code.' });
  }

  try {
    // 1. 인증 코드로 Google Access Token 요청
    const { tokens } = await client.getToken(code);
    const { id_token } = tokens;

    // 2. ID Token 검증
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const googleUser = ticket.getPayload(); // { sub, email, name, picture }

    // 3-1. DB에서 사용자 조회 또는 생성 (userService.js 사용)
    // googleUser의 sub가 'google_id' 컬럼에 저장됩니다.
    // dbUser는 { id, google_id, email, full_name, ... } 형태
    const dbUser = await findOrCreateUser(googleUser);
    // 3-2. users_analysis 테이블에 데이터 추가 (ID, 이름)
    // dbUser.id는 users 테이블의 PK이며, 이를 users_analysis의 user_id로 사용
    await checkInUserAnalysis(dbUser.google_id, dbUser.full_name);
    // 3-3. community 서버의 users DB에 추가
    try {
      const communityApiUrl = 'http://service-community.voyage-app-02/users';
      
      // 요청 스펙에 맞게 데이터 매핑
      const communityUserData = {
        google_id: dbUser.google_id,           // "google_hashed_id"
        username: dbUser.full_name,          // "John Johnson"
        image_url: dbUser.profile_picture_url // "link_to_some_image.com"
      };

      // POST 요청 전송
      await axios.post(communityApiUrl, communityUserData);
      console.log('User data successfully sent to community service.');

    } catch (communityError) {
      console.error('Failed to send data to community service:', communityError.message);
    }

    // 4. 우리 서비스의 JWT 생성 
    const payload = {
      id: dbUser.google_id, // 'dbUser.sub'(undefined)가 아닌 'dbUser.google_id'
      email: dbUser.email,
    };
    const ourToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });

    // 5. 프론트엔드로 응답
    res.status(200).json({
      message: 'Login success!',
      token: ourToken,
      user: {
        // API 게이트웨이가 검증할 google_id를 id로 전달
        id: dbUser.google_id,
        email: dbUser.email,
        name: dbUser.full_name, // DB 컬럼명 기준
        picture: dbUser.profile_picture_url, // DB 컬럼명 기준
      },
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error.' });
  }
});


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`OAuth2 service running on port ${PORT}`);
});

require('dotenv').config();
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');

const { findOrCreateUser } = require('./userService');


const app = express();
app.use(express.json());
app.use(cors());

// Oauth2 클라이언트 설정 (new google.auth.OAuth2 -> new OAuth2Client)
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

app.post('/oauth2', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ message: 'Need auth code.' });
  }

  try {
    // 1. 인증 코드로 Google Access Token 요청 
    const { tokens } = await client.getToken(code);
    const { access_token, id_token } = tokens;

    // 2. ID Token을 검증하여 사용자 정보를 얻는 것을 더 권장
    // 이 방식은 추가적인 API 호출(userinfo) 없이 사용자 정보를 안전하게 얻을 수 있음
    const ticket = await client.verifyIdToken({
        idToken: id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const googleUser = ticket.getPayload();

    console.log('Google User Info from ID Token:', googleUser);
    
    // 3. DB에서 사용자 조회 또는 생성
    const dbUser = await findOrCreateUser(googleUser);

    // 4. 우리 서비스의 JWT 생성
    const payload = {
      id: dbUser.sub, // 'sub'는 사용자의 고유 ID입니다.
      email: dbUser.email,
    };
    const ourToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.status(200).json({
      message: 'Login success!',
      token: ourToken,
      user: {
          id: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture
      },
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error.' });
  }
});


const PORT = 3000; 
app.listen(PORT, () => {
  console.log(`API Gateway server running on port ${PORT}`);
});
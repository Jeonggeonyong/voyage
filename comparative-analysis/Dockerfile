# 1. Node.js 18-alpine 버전을 기반으로 이미지를 만듭니다.
FROM node:18-alpine

# 2. 컨테이너 내부에 작업 폴더를 만듭니다.
WORKDIR /usr/src/app

# 3. 의존성 파일들을 먼저 복사합니다.
COPY package.json package-lock.json* ./

# 4. 의존성을 설치합니다.
# (프로덕션용 의존성만 설치하여 이미지 경량화)
RUN npm install --omit=dev

# 5. 소스 코드와 필요한 모듈을 복사합니다.

# 5a. comparative-analysis 서버 파일 복사
# 💡 수정: 빌드 컨텍스트가 상위 폴더임을 가정하여 경로를 명시합니다.
COPY comparative-analysis/comparative-analysis.js ./

# 5b. DB 모듈과 환경 설정 파일을 복사하여 상대 경로를 맞춥니다.
# 💡 수정: Node.js에서 require('../oauth2/db.js')가 작동하도록 경로 구조를 생성합니다.
RUN mkdir -p /usr/src/app/oauth2
COPY oauth2/db.js ./oauth2/db.js
# 💡 수정: .env 파일을 복사하여 DB 접속 정보를 로드할 수 있게 합니다.
COPY oauth2/.env ./.env

# 6. 앱이 3000번 포트를 사용한다고 명시합니다.
EXPOSE 3000

# 7. 컨테이너가 시작될 때 "node comparative-analysis.js" 명령어를 실행합니다.
CMD [ "node", "comparative-analysis.js" ]
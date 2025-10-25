# 1. Node.js 18-alpine 버전을 기반으로 이미지를 만듭니다.
FROM node:18-alpine

# 2. 컨테이너 내부에 작업 폴더를 만듭니다.
WORKDIR /usr/src/app

# 3. 의존성 파일들을 먼저 복사합니다.
COPY package.json package-lock.json* ./

# 4. 의존성을 설치합니다.
# (프로덕션용 의존성만 설치하여 이미지 경량화)
RUN npm install --omit=dev

# 5. 소스 코드를 복사합니다.
# (server.js, .env 등)
COPY alarm.js .

# 6. 앱이 3000번 포트를 사용한다고 명시합니다.
EXPOSE 3000

# 7. 컨테이너가 시작될 때 "node server.js" 명령어를 실행합니다.
CMD [ "node", "alarm.js" ]
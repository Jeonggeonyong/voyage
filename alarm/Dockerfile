# 1. Node.js 18-alpine 버전을 기반으로 이미지를 만듭니다.
FROM node:18-alpine

# 2. 컨테이너 내부에 작업 폴더를 /usr/src/app으로 설정합니다.
# 이 경로는 Node.js 서버의 루트 디렉토리가 됩니다.
WORKDIR /usr/src/app

# 3. 의존성 파일들을 먼저 복사하고 설치하여 캐싱을 활용합니다.
COPY package.json package-lock.json* ./

# 4. 의존성을 설치합니다.
# (프로덕션용 의존성만 설치하여 이미지 경량화)
RUN npm install --omit=dev

# 5. 소스 코드와 필요한 모듈을 복사합니다.
# (빌드 컨텍스트가 상위 디렉토리(voyage/)라고 가정합니다.)

# 5a. ALARM 서버 파일 복사
COPY ../alarm/alarm_server.js ./alarm_server.js

# 5b. DB 모듈 복사: alarm 폴더에서 가져와서 WORKDIR의 루트에 복사합니다.
# (소스: alarm/db.js, 대상: ./db.js)
COPY ../alarm/db.js ./db.js
# .env 파일 복사 라인 제거: 클라우드 Secret/ConfigMap으로 환경 변수를 주입합니다.


# 6. 앱이 3000번 포트를 사용한다고 명시합니다.
EXPOSE 3000

# 7. 컨테이너가 시작될 때 "node alarm_server.js" 명령어를 실행합니다.
CMD [ "node", "alarm_server.js" ]

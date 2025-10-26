# 1. Node.js 18-alpine 버전을 기반으로 이미지를 만듭니다.
FROM node:18-alpine

# 2. 컨테이너 내부에 작업 폴더를 /usr/src/app으로 설정합니다.
# 이 경로는 voyage/checklist/ 의 역할 및 WORKDIR이 됩니다.
WORKDIR /usr/src/app

# 3. 의존성 파일들을 먼저 복사하고 설치하여 캐싱을 활용합니다.
COPY package.json package-lock.json* ./
# 프로덕션용 의존성만 설치하여 이미지 경량화
RUN npm install --omit=dev

# 4. 소스 코드와 필요한 모듈을 복사합니다.
# (빌드 컨텍스트가 voyage/의 상위 디렉토리라고 가정합니다.)

# 4a. checklist 서버 파일 복사
COPY checklist/checklist.js ./

# 4b. DB 모듈 복사: checklist 폴더에서 가져와서 WORKDIR의 루트에 복사합니다.
# (소스: checklist/db.js, 대상: ./db.js)
COPY checklist/db.js ./db.js
# .env 파일 복사 (DB 접속 정보 로드를 위해)
# 💡 클라우드 Secret/ConfigMap으로 환경 변수를 주입하기 위해 이 라인을 제거합니다.


# 5. 앱이 3000번 포트를 사용한다고 명시합니다.
EXPOSE 3000

# 6. 컨테이너가 시작될 때 "node checklist.js" 명령어를 실행합니다.
CMD [ "node", "checklist.js" ]

# Node.js 18-alpine 버전을 기반으로 이미지를 만듭니다.
FROM node:18-alpine

# 컨테이너 내부에 작업 폴더를 만듭니다.
WORKDIR /usr/src/app

# 1. package.json 파일을 먼저 복사합니다.
COPY package*.json ./

# 2. 의존성을 설치합니다. (가장 중요한 부분)
RUN npm install

# 현재 폴더의 모든 파일을 작업 폴더로 복사합니다.
# (실제 프로젝트에서는 package.json을 먼저 복사하는 것이 좋습니다.)
COPY . .

# 앱이 3000번 포트를 사용한다고 명시합니다.
EXPOSE 3000

# 컨테이너가 시작될 때 이 명령어를 실행합니다.
CMD [ "node", "oauth2.js" ]
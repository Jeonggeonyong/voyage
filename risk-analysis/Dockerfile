# 1. 기본이 되는 Python 이미지를 가져옵니다.
FROM python:3.10-slim

# 2. 작업 디렉토리를 설정합니다.
WORKDIR /app

# 3. requirements.txt 대신 Flask를 직접 설치합니다.
RUN pip install Flask requests

# 4. 소스 코드를 복사합니다.
COPY risk-analysis.py .

# 5. K8s가 접근할 포트를 노출합니다. (app.py의 포트와 일치)
EXPOSE 3000

# 6. 컨테이너가 시작될 때 실행할 명령입니다.
CMD ["flask", "run", "--host=0.0.0.0", "--port=3000"]

from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    # 이 서버가 어떤 서버인지 식별할 수 있는 메시지를 반환합니다.
    return "Hello from Flask! (community server)"

if __name__ == '__main__':
    # 0.0.0.0으로 호스트를 지정해야 Docker 컨테이너 외부에서 접근이 가능합니다.
    # K8s Deployment의 컨테이너 포트와 일치시키세요. 
    app.run(host='0.0.0.0', port=3000)
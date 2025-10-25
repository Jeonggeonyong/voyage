const express = require('express');
const app = express();

// K8s Deployment의 containerPort와 일치시켜야 합니다.
const PORT = 3000;

app.get('/', (req, res) => {
    // 이 서버가 어떤 서버인지 식별할 수 있는 메시지를 반환합니다.
    res.send('Hello from Express! (comparative-analysis server v1)');
});

// 0.0.0.0으로 호스트를 지정해야 Docker 컨테이너 외부에서 접근이 가능합니다.
app.listen(PORT, '0.0.0.0', () => {
    console.log(`comparative-analysis server listening on port ${PORT}`);
});
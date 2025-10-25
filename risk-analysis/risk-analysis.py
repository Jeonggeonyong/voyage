from flask import Flask, request, jsonify # Flask 관련 모듈
import requests # 외부 API 통신을 위한 라이브러리 (Node.js의 axios 역할)

app = Flask(__name__)

@app.route('/')
def hello():
    # 이 서버가 어떤 서버인지 식별할 수 있는 메시지를 반환합니다.
    return "Hello from Flask! (risk-analysis server)"

if __name__ == '__main__':
    # 0.0.0.0으로 호스트를 지정해야 Docker 컨테이너 외부에서 접근이 가능합니다.
    # K8s Deployment의 컨테이너 포트와 일치시키세요. 
    app.run(host='0.0.0.0', port=3000)


# --- Flask 애플리케이션 초기화 (Flask 앱 객체가 estatesCompareServer라고 가정) ---
# 기존 코드에 붙여넣을 때 이 부분은 이미 정의되어 있을 수 있습니다.
# app = Flask(__name__) 
# estates_compare_server = app # 예시로 Flask 앱 객체를 estates_compare_server 변수에 할당했다고 가정

# API 키 정의
confmKey = "devU01TX0FVVEgyMDI1MDkyNTEwMTgzOTExNjI2NDU="

# 주소 검색 API 라우트 정의
@estates_compare_server.route('/estates/search', methods=['GET'])
def estates_search():
    # 1. 키워드 추출 (req.query.keyword 대신 request.args.get('keyword') 사용)
    keyword = request.args.get('keyword')

    if not keyword:
        # Express의 res.status(400).send()와 동일
        return "검색할 키워드를 입력해주세요.", 400 

    # 2. API 요청 설정
    # (currentPage와 countPerPage는 params 객체 내에서만 설정해도 충분하므로,
    #  별도의 변수 선언은 생략했습니다.)
    search_address_url = "https://business.juso.go.kr/addrlink/addrLinkApi.do"
    
    params = {
        'currentPage': 1,
        'countPerPage': 10,
        'keyword': keyword,
        'confmKey': confmKey,
        'hstryYn': 'Y',
        'firstSort': 'road',
        'resultType': 'json'
    }

    # 3. 외부 API 호출 (axios.get 대신 requests.get 사용)
    try:
        api_response = requests.get(search_address_url, params=params)
        api_response.raise_for_status() # 4xx, 5xx 에러 발생 시 예외 처리
        
        # Express의 apiResponse.data
        api_data = api_response.json() 
        
        # console.log(api_response) 대신 Python 콘솔 출력
        # print(api_data) 

        # 4. 데이터 가공 및 필터링
        results_data = api_data.get('results', {})
        total_count = results_data.get('common', {}).get('totalCount', '0')
        address_data = results_data.get('juso', [])

        filtered_address_data = []
        for estate in address_data:
            filtered_address_data.append({
                'roadAddr': estate.get('roadAddr'),
                'zipNo': estate.get('zipNo')
            })

        print(f"검색 결과 매물 수 : {total_count}")
        # print(filtered_address_data)

        # 5. 응답 반환 (res.send(filteredAddressData) 대신 jsonify 사용)
        return jsonify(filtered_address_data)
    
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
        return jsonify({"message": "외부 API 호출 중 HTTP 오류가 발생했습니다."}), api_response.status_code
    except Exception as err:
        print(f"Other error occurred: {err}")
        return jsonify({"message": "외부 API 호출 중 예상치 못한 오류가 발생했습니다."}), 500
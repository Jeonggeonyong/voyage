from flask import Flask, jsonify, request
import requests
import psycopg2
from dotenv import load_dotenv
import os
import uuid

from risk_anal_analysis import risk_analysis_extract
from risk_anal_get_text import risk_anal_get_text
from risk_anal_text_merge import risk_anal_dataFrameParsing 
from risk_anal_sql_insert import risk_anal_sql_insert
import risk_anal_sql_t_analysis as sql_anaysis
import risk_anal_sql_t_estates as sql_estate
import risk_anal_sql_t_user as sql_user
import risk_anal_sql_interations as sql_interactions


load_dotenv()
 
def init_db():
    t3 = """CREATE TABLE IF NOT EXISTS public.analysis (
        analysis_id UUID PRIMARY KEY,
        estate_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        risk_score INT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        title_section_analysis JSONB,
        part_a_analysis JSONB,
        part_b_analysis JSONB,
        CONSTRAINT fk_estate
            FOREIGN KEY (estate_id)
            REFERENCES public.estates (estate_id)
            ON DELETE CASCADE,
        CONSTRAINT fk_user
            FOREIGN KEY (user_id)
            REFERENCES public.users_analysis (user_id)
            ON DELETE CASCADE
    );"""
    t1 = """CREATE TABLE IF NOT EXISTS public.users_analysis (
        user_id TEXT PRIMARY KEY,
        user_name VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        token VARCHAR(255)
    );"""
    t2 = """CREATE TABLE IF NOT EXISTS public.estates (
        estate_id UUID PRIMARY KEY,
        estate_name VARCHAR(255),
        estate_address VARCHAR(255),
        zip_no VARCHAR(10),
        created_at TIMESTAMPTZ DEFAULT NOW()
    );"""
    t4 = """CREATE TABLE IF NOT EXISTS public.interactions (
        interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES public.users_analysis(user_id),
        estate_id UUID NOT NULL REFERENCES public.estates(estate_id),
        interaction_type VARCHAR(50) NOT NULL CHECK (
            interaction_type IN ('isNotified', 'analysisCompleted', 'interested', 'contractCompleted')
        ),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(t1)
    cur.execute(t2)
    cur.execute(t3)
    cur.execute(t4)
    conn.commit()
    cur.close()

def get_db_connection():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        dbname=os.getenv("DB_DATABASE"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT")
    )
    return conn

# def get_db_connection():   
#     conn = psycopg2.connect(
#         host = "localhost",
#         port = 5432,
#         dbname = "kpaas_analysis_database",
#         user = "kpaas_anal_db_master",
#         password = "kpaas_anal_db_master"
#     )

#     return conn


app = Flask(__name__)
# with app.app_context():
#     init_db()

USER_ID = ""
DOC_ID = ""

int_estateID = 1
int_analysisID = 1

Location ="경기도 용인시 수지구 죽전동 123외 79필지 단국대 죽전캠퍼스 소프트웨어  아이씨티관, 미디어센터"
perpose = "교육연구시설"
Space = "not_found"
Ratio = "not_found"
Additional = "not_found"
FirstRegistedDate = "2007년8월20일"
OwnerName = "학교법인단국대학"
Additional ="not_found"
OtherRight ="not_found"


# curl -X POST http://localhost:5000/api/pdf/upload \
#   -F "file=@/path/to/sample.pdf" \
#   -F "user_id=alice_01" \
#   -F "document_id=contract_2025_10_28"
#와 같은 형태일 떄
#pdf파일과 동시에 유저아이디, 문서아이디를 받는 호출 api
# @app.route("/request_analysis/<userID>/<locationData>", methods=["POST"])
# def get_pdf(userID, docID):
    
#     f = request.files.get("file")
#     if not f:
#         return jsonify({"error": "file 필드가 필요합니다."}), 400

#     # user_id = request.form.get("uid")
#     # document_id = request.form.get("did")
#     int_estateID = int_estateID + 1
#     int_analysisID = int_analysisID + 1


#     docID = int_estateID
#     body(f, userID, docID)
    # return jsonify({"message" : "we got file, "})

@app.route("/request_analysis/<userID>", methods=["POST"])
def get_pdf2(userID):
    
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "file 필드가 필요합니다."}), 400

    # user_id = request.form.get("uid")
    # document_id = request.form.get("did")
    # int_estateID = int_estateID + 1
    # int_analysisID = int_analysisID + 1
    uid = userID
    docID = 1

    docID = int_estateID
    body(f, uid, docID)
    return jsonify({"message" : "proccess complete"})


def request_to_checklist_server(uID, eID):

    dest_url = "http://service-checklist.voyage-app-02"
    dest_api = f"/users/{uID}/{eID}/checklists/init"    

    request_url = dest_url + dest_api
    try:
        requests.post(request_url)  # 본문 없이 URL만 POST
        print(f"POST sent to {request_url}")
    except requests.exceptions.RequestException as e:
        print(f"Error sending POST: {e}")

# 모든 유저 목록	/users	시스템에 등록된 모든 유저 목록
# 특정 유저	/users/{userID}	{userID}에 해당하는 특정 유저
# 모든 매물 목록	/estates	모든 매물 목록
# 특정 매물	/estates/{estateID}	{estateID}에 해당하는 특정 매물
# 특정 유저의 위험 분석 완료 매물	/users/{userID}/estates?isAnalysis=true	특정 유저의 위험 분석 완료 매물 목록
# 두 위험분석 완료 매물의 비교 데이터	/users/{userID}/comparison	특정 유저가 조회한 두 매물의 비교 데이터


######### 실행순서
# 1. 서버 실행 전 initDB를 하고 서버가 listen할 수 있도록, 해당 테이블 없다면 생성해주는 코드를 추가
# 2. 위험 분석 이후, ESTATES, ANALYSIS, INTERACTIONS 테이블에 INSERT한다.

# 이 때, ANALYSIS 테이블의

# - `title_section_analysis` (`JSONB`)
# - `part_a_analysis` (`JSONB`)
# - `part_b_analysis` (`JSONB`)

# 각각의 요소에 `threat_id`  INSERT.

# 이 `threat_id`는 THREATS 테이블에 명시되어 있기도 하고, 그냥 JSONB 형식에 넣을 때 ,

# 따로 저장해놓은 표를 보고 넣어도 됨.

# <표>

# 1. INSERT를 완료한 시점에 checklist 서버 URL : POST `/users/:userId/:estateId/checklists/init` 로 요청

# 1. 요청 받았다면 params(userId, estateId)로 ANALYSIS 테이블을 조회해서 세 부분에 포함된  `threat_id` 를 조회하고, CHECKLISTS 테이블에 이 `threat_id` 로 `checklist_id`를 쿼리를 보냄
# 2. 이 정보로 USER_CHECKLISTS 테이블에 

# `category` : `analysis` 로 INSERT.

# 1. 이어서 

# `'before_contract','contract_day','after_contract','after_expiration'` 나머지 값들도 INSERT.

# 1. 클라이언트는 체크리스트를 원할 때 GET `/users/:userId/:estateId/checklist` 로 요청을 보내면,  값을 반환받는 것은 동일

#인터렉션
#분석 끝났으면 자동생성해서, 

# @app.route("/activate")
def body(input_file, input_uid, input_did):

    #동작순서
    # 입력받음
    # 받은 데이터로 처리
    # 받은데이터로 처리 완료
    # 처리 이후
    global USER_ID
    global DOC_ID
    id_test = input_uid
    doc_id_test = input_did
    id_test = "uid_dummy"
    doc_id_test = "docid_dummy"
    #이거 지역정보에 대해서 처리 추가 필요(함수 인자를 추가하든, 튜플을 복사할때 끼워 넣든 등)
    #해결시 해당 문구 제거할 것
    building_location_info, scaned_text_df_dict = risk_anal_get_text(input_file, id_test, doc_id_test)
    merged_text_df_dict = risk_anal_dataFrameParsing(scaned_text_df_dict)
    extracted_tutple = risk_analysis_extract(merged_text_df_dict, building_location_info)

    #uuid 생성
    u4uid = uuid.uuid4()
    u4eid = uuid.uuid4()
    u4aid = uuid.uuid4()

    u4uid = str(u4uid)
    u4eid = str(u4eid)
    u4aid = str(u4aid)

    # print("u4uid >>> ", u4uid)
    print("u4eid >>> ", u4eid)
    print("u4aid >>> ", u4aid)
    ##uuid생성 

    u4uid = str(input_uid)

    ##########
    conn = get_db_connection()

    #### 가라코드 유저정보 테이블
    # sql_user.sql_insert_to_analysis(conn, u4uid)
###########
    ##### estate 삽입
    eid = int_estateID #d이거는 수정해야해 uuid 패키지 사용하는걸로 일단 이거는 테스트용 가라코드
    sql_estate.sql_insert_to_estates(conn, u4eid,"경기도 용인시 수지구 죽전동 123외 79필지 단국대 죽전캠퍼스 소프트웨어  아이씨티관, 미디어센터" , "경기도 용인시 수지구 죽전동 123외 79필지 단국대 죽전캠퍼스 소프트웨어  아이씨티관, 미디어센터", "16890")
    ##### analysis 삽입 
    analid = int_analysisID
    sql_anaysis.sql_insert_to_analysis(conn, u4aid, u4eid, u4uid, 50)
    ######### interaction 삽입
    sql_interactions.sql_insert_to_interaction(conn, u4uid, u4eid, "analysisCompleted")
    #
    print("after insert")
    
    conn.close()

    # request_to_checklist_server(u4uid, u4eid)

    risk_anal_sql_insert(id_test, doc_id_test, extracted_tutple)
    print("back end watch, process one cycle end")
    return "Flask Install success"



@app.route("/users")
def user_all():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": 1}), 500
    cur = conn.cursor()
    

    # 3. SQL 실행
    cur.execute("""
        SELECT user_id, user_name, created_at, token
        FROM public.users_analysis;
    """)
    # 4. 결과 가져오기

    if request.method == "GET":
        rows = cur.fetchall()
    elif request.method == "POST":
        rows = cur.fetchall()
    # 5. 결과 출력
    for row in rows:  
        pass
    cur.close()
    conn.close()

@app.route("/users/<int:userID>", methods=["GET", "POST"])
def user_target(userID):
    f"{userID}"
    pass
    return

    
@app.route("/estate", methods= ["GET"])
def estates_all():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            estate_id,
            estate_name,
            estate_address,
            zip_no,
            created_at
        FROM public.estates
        ORDER BY created_at DESC;
    """)
    rows = cur.fetchall()
    for row in rows:
        pass

    return

@app.route("/estate/<estateID>")
def estates_target(estateID):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            estate_id,
            estate_name,
            estate_address,
            zip_no,
            created_at
        FROM public.estates
        WHERE estate_id = %s;
    """, (estateID,))
    rows = cur.fetchall()
    for row in rows:
        pass

    return

@app.route("/users/<userID>/estates?isAnalysis=true")
def estate_target_user_anal_complete(userID):
    pass
    return


@app.route("/users/<userID>/comparison", methods = ["GET"])
def eatate_compare_target_user(usrID):
    conn  = get_db_connection()
    cur = conn.cursor()
    cur.execute("""SELECT * FROM public.analysis WHERE user_id = %s;""", (usrID,))
    
    rows = cur.fetchall()
    for row in rows:
        pass
    return

# @app.route("/keywords")
#이건 뭐고?

@app.route("/status/info")
def status():
    return "status info"

if __name__ == "__main__":
    app.run(host = "0.0.0.0", port= 3000)


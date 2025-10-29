from flask import Flask, jsonify, request
import requests
import psycopg2
from dotenv import load_dotenv
import os
import uuid
#up is packages

#down is user idenfied .py files to analysis fucntions
from risk_anal_analysis import risk_analysis_extract
from risk_anal_get_text import risk_anal_get_text
from risk_anal_text_merge import risk_anal_dataFrameParsing 

#down is user identified .py files to SQL control
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
with app.app_context():
    app.logger.warning("before db init")
    init_db()
    app.logger.warning("after db init")

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

@app.route("/request_analysis/<userID>", methods=["POST"])
def get_pdf2(userID):
    app.logger.warning("before take pdf file")
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "file 필드가 필요합니다."}), 400
    app.logger.warning("pdf file take end")
    # user_id = request.form.get("uid")
    # document_id = request.form.get("did")
    uid = userID
    docID = 1
    docID = int_estateID
    app.logger.warning("body funciton start")
    booltype = body(f, uid, docID)
    app.logger.warning("body function end")
    app.logger.warning("body return type >>> ", booltype)
    app.logger.warning("END PROCESS =======================================")
    if(booltype == True):
        return  jsonify({"message" : "proccess complete"}), 200
    else:
        return jsonify({"message" : "proccess error by not return True"}), 500
    
    


def request_to_checklist_server(uID, eID):
    app.logger.warning("start send request to checklist_server")
    dest_url = "http://service-checklist.voyage-app-02"
    dest_api = f"/users/{uID}/{eID}/checklists/init"    
    
    request_url = dest_url + dest_api
    app.logger.warning(f"POST TRY BY URL >>>> {request_url}")
    try:
        requests.post(request_url)
        # response = requests.post(request_url)  
        # app.logger.warning("status code", response.status_code)
        # app.logger.warning("response text", response.text)
        # return str(response.status_code)  +"___" + str(response.text)
        print(f"POST sent to {request_url}")
        app.logger.warning("POST COMPLETE")
    except requests.exceptions.RequestException as e:
        app.logger.warning(f"start send request to checklist_server\n ERROR sending POST {e}")
        # print(f"Error sending POST: {e}")
    app.logger.warning("end send request to checklist_server")

# @app.route("/activate")
def body(input_file, input_uid, input_did):
    app.logger.warning("start body")
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
    app.logger.warning("before get text")
    building_location_info, scaned_text_df_dict = risk_anal_get_text(input_file, id_test, doc_id_test)

    app.logger.warning("before parsing")
    merged_text_df_dict = risk_anal_dataFrameParsing(scaned_text_df_dict)
    
    app.logger.warning("before extract")
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
    #uid는 기존 uuid였다 바뀐것(TEXT)
    u4uid = str(input_uid)

    ##########
    app.logger.warning("conn object gen start")
    conn = get_db_connection()
    app.logger.warning("conn object gen end")
    #### 가라코드 유저정보 테이블 필요없음 => 사전에 반드시 입력되어있어야함
    # sql_user.sql_insert_to_analysis(conn, u4uid)
    ###########
    ##### estate 삽입
    eid = int_estateID #d이거는 수정해야해 uuid 패키지 사용하는걸로 일단 이거는 테스트용 가라코드
    app.logger.warning("before insert esates")
    sql_estate.sql_insert_to_estates(conn, u4eid,"경기도 용인시 수지구 죽전동 123외 79필지 단국대 죽전캠퍼스 소프트웨어  아이씨티관, 미디어센터" , "경기도 용인시 수지구 죽전동 123외 79필지 단국대 죽전캠퍼스 소프트웨어  아이씨티관, 미디어센터", "16890")
    app.logger.warning("after insert estates")
    ##### analysis 삽입 
    analid = int_analysisID
    app.logger.warning("before insert analysis")
    sql_anaysis.sql_insert_to_analysis(conn, u4aid, u4eid, u4uid, 50)
    app.logger.warning("after insert analysis")
    ######### interaction 삽입
    app.logger.warning("before insert interaction")
    sql_interactions.sql_insert_to_interaction(conn, u4uid, u4eid, "analysisCompleted")
    app.logger.warning("after insert interaction")
    #
    
    
    conn.close()
    app.logger.warning("conn object close end")
    request_to_checklist_server(u4uid, u4eid)

    app.logger.warning("back end watch, process one cycle end")
    return True



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
    return jsonify({"message" : "proccess running"}), 200

if __name__ == "__main__":
    app.run(host = "0.0.0.0", port= 3000, debug= True)


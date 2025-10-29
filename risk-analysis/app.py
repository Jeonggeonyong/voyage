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
from risk_anal_threat_classify import threat_classify
#down is user identified .py files to SQL control
import risk_anal_sql_t_analysis as sql_anaysis
import risk_anal_sql_t_estates as sql_estate
import risk_anal_sql_t_user as sql_user
import risk_anal_sql_interations as sql_interactions
import risk_anal_sql_estaes_isin as sql_isin_estate

load_dotenv()
 #아날 아이디 자동생성으로 변경
def init_db():
    t3 = """CREATE TABLE IF NOT EXISTS public.analysis (
        analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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



############ do not addit
PROJECT_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_DNS, "kpaas-address-namespace")

# curl -X POST http://localhost:5000/api/pdf/upload \
#   -F "file=@/path/to/sample.pdf" \
#   -F "user_id=alice_01" \
#   -F "document_id=contract_2025_10_28"
#와 같은 형태일 떄
#pdf파일과 동시에 유저아이디, 문서아이디를 받는 호출 api

# curl -X POST \
#   -H "Authorization: Bearer <token>" \
#   -F "file=@/path/to/check_register.pdf" \
#   -F "roadAddr=서울특별시 중구 세종대로 110" \
#   -F "zipNo=04524" \
#   -F "bdNm=서울시청" \
#   -F "ownerName=홍길동" \
#   -F "buildingUse=주거용" \
#   -F "jeonseDeposit=50000000" \
#   "http://nginx.210.178.1.110.nip.io/risk-analysis/request_analysis/109930773329408493076"

@app.route("/request_analysis/<userID>", methods=["POST"])
def takeFileAndInitiateProccess(userID):
    app.logger.warning("before take pdf file")
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "file 필드가 필요합니다."}), 400
    app.logger.warning("pdf file take end")
    # user_id = request.form.get("uid")
    # document_id = request.form.get("did")

    building_addr = ""
    building_name =""
    building_zipno = ""
    building_perpose = ""
    building_owner = ""
    building_money = ""
    ################3 endpoint 이외 전달받은 사항 얻기(파일 제외)
    building_addr = request.form.get("roadAddr")
    building_zipno = request.form.get("zipNo")
    building_name = request.form.get("bdNm")

    building_owner = request.form.get("ownerName")
    building_perpose = request.form.get("buildingUse")
    building_money = request.form.get("jeonseDeposit")


    app.logger.warning(f"UID >>> {userID}")
    app.logger.warning(f"Addr >>> {building_addr}")
    app.logger.warning(f"ZipNo >>> {building_zipno}")
    app.logger.warning(f"Bname >>> {building_name}")
    #아래의 데이터들은 입력이 없을 시 'noData' 형식을 가짐
    app.logger.warning(f"Owner >>> {building_owner}")
    app.logger.warning(f"Perpose >>> {building_perpose}")
    app.logger.warning(f"Money >>> {building_money}")

    ##################
    uid = userID
    docID = 1
    docID = int_estateID
    app.logger.warning("body funciton start")
    booltype = body(f, uid, docID, building_addr, building_zipno, building_name, building_owner, building_perpose, building_money)
    app.logger.warning("body function end")
    # app.logger.warning("body return type >>> ", booltype)
    app.logger.warning("END PROCESS =======================================")
    if(booltype == True):
        return  jsonify({"message" : "proccess complete"}), 200
    else:
        return jsonify({"message" : "proccess error by not return True"}), 500
    
def deterministic_uuid_by_zipno(input_zipno : str) -> uuid:
    return uuid.uuid5(PROJECT_NAMESPACE, input_zipno)




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

#################################################################################################################################
#################################################################################################################################
#################################################################################################################################
#################################################################################################################################
# @app.route("/activate")
#(파일, 유저아이디, 문서아이디, 주소, 우편번호, 건물명, 목적, 소유주, 돈)
def body(input_file, input_uid, input_did, input_building_addr, input_building_zipno, input_building_name, input_building_owner, input_building_perpose, input_building_money):
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
    app.logger.warning("before parsing extracted tuple")
    ext_building_addr = extracted_tutple[0][0]
    app.logger.warning("before threat Classfiy")
    extracted_list_tuple = threat_classify(extracted_tutple, input_building_addr, input_building_perpose, input_building_owner)
    app.logger.warning("BEFORE SQL PROCCESS")
    ##################################################################################################위는 분석 소스
#############
#############
#############
#############
    ##################################################################################################아래는 sql관련 처리
    app.logger.warning("START SQL PROCCESS")
    #uuid 생성 
    # u4uid = uuid.uuid4()
    # new_u5euid_str = uuid.uuid4()
    # u4aid = uuid.uuid4()

    # u4uid = str(u4uid)
    # new_u5euid_str = str(new_u5euid_str)
    # u4aid = str(u4aid)

    # print("u4uid >>> ", u4uid)
    # print("u4eid >>> ", new_u5euid_str)
    # print("u4aid >>> ", u4aid)

    ##############
    ##uuid생성 
    #uid는 기존 uuid였다 바뀐것(TEXT)
    u4uid = str(input_uid)

    ###########
    app.logger.warning("conn object gen start")
    conn = get_db_connection()
    app.logger.warning("conn object gen end")

    ############# new estateID by deterministic uuid5
    app.logger.warning("BEFORE MAKE estates ID")
    new_u5euid = deterministic_uuid_by_zipno(input_building_zipno)
    new_u5euid_str = str(new_u5euid)
    app.logger.warning("BEFORE MAKE estatesID IS exist")
    is_exist = sql_isin_estate.isin_estateID(conn, new_u5euid_str)
    if(is_exist == True):
        #만약 esatesID가 이미 존재한다면
        #estates에 삽입 불필요
        app.logger.warning("Now esateID is already exist")
        
    elif(is_exist == False):
        app.logger.warning("Now esateID is new ID")
        ##### estate 삽입
        eid = int_estateID #d이거는 수정해야해 uuid 패키지 사용하는걸로 일단 이거는 테스트용 가라코드
        app.logger.warning("before insert esates")
        #name, addr 순
        sql_estate.sql_insert_to_estates(conn, new_u5euid_str,input_building_name, ext_building_addr, input_building_zipno)
        app.logger.warning("after insert estates")
    else:
        app.logger.warning("======sql query has some problem=========")


    ##########
    #### 가라코드 유저정보 테이블 필요없음 => 사전에 반드시 입력되어있어야함
    # sql_user.sql_insert_to_analysis(conn, u4uid)
    ###########

    ##### analysis 삽입 
    ### 반드시 여기에서 입력받은 모든 값을 사용하여, 위험에 대한 분류를 시행해야 함 
    analid = int_analysisID
    app.logger.warning("before insert analysis")
    sql_anaysis.sql_insert_to_analysis(conn, new_u5euid_str, u4uid, 50, extracted_list_tuple)
    app.logger.warning("after insert analysis")





    ######### interaction 삽입
    app.logger.warning("before insert interaction")
    sql_interactions.sql_insert_to_interaction(conn, u4uid, new_u5euid_str, "analysisCompleted")
    app.logger.warning("after insert interaction")
    #
    
    
    conn.close()
    app.logger.warning("conn object close end")


    #체크리스트 서버에 리퀘스트 던지기
    request_to_checklist_server(u4uid, new_u5euid_str)

    app.logger.warning("back end watch, process one cycle end")
    return True












########################################################################################################################################
########################################################################################################################################
########################################################################################################################################
########################################################################################################################################

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


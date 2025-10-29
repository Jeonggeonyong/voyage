import psycopg2

def risk_anal_sql_insert(uid : str, doc_id: str,input_tuple : tuple):
    #연결설정
    conn = psycopg2.connect(
        host = "localhost",
        port = 5432,
        dbname = "kpaas_analysis_database",
        user = "kpaas_anal_db_master",
        password = "kpaas_anal_db_master"
    )

    #커서 생성
    cur = conn.cursor()


    #테스트 삽입 데이터
    user_id = "1"
    doc_number = "2"
    title_address = "3"
    title_building_perpose = "4"
    title_leased_part_info = "5"
    title_land_share_ratio = "6"
    title_land_rights_notes = "7"
    fst_first_registration_date = "8"
    fst_current_owner = "9"
    fst_special_notes = "10"
    scd_non_ownership_rights = "11"


    user_id = uid
    doc_number = doc_id
    title_address, title_building_perpose, title_leased_part_info, title_land_share_ratio,\
    title_land_rights_notes = input_tuple[0]
    fst_first_registration_date, fst_current_owner, fst_special_notes = input_tuple[1]
    scd_non_ownership_rights = input_tuple[2]

    print(input_tuple[0])
    print(input_tuple[1])
    print(input_tuple[2])
    
    sql_q = """INSERT INTO registry_entry (user_id, doc_number, 
    title_address, title_building_perpose, title_leased_part_info,
    title_land_share_ratio, title_land_rights_notes, fst_first_registration_date,
    fst_current_owner, fst_special_notes, scd_non_ownership_rights)
    VALUES (%s, %s, %s, %s,%s,%s,%s,%s,%s,%s,%s)"""

    #SQL 실행
    cur.execute(sql_q, (user_id,
    doc_number,
    title_address,
    title_building_perpose,
    title_leased_part_info,
    title_land_share_ratio,
    title_land_rights_notes,
    fst_first_registration_date,
    fst_current_owner,
    fst_special_notes,
    scd_non_ownership_rights))

    # print("aaa")

    # 저장
    conn.commit()

    # 5. 종료
    cur.close()
    conn.close()
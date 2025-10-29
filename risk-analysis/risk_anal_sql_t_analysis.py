#### analysis

# - `analysis_id` (**PK**, `UUID`)
# - `estate_id` (**FK**, `UUID`)
# - `user_id` (**FK**, `UUID`)
# - `risk_score` (`INT`)
# - `created_at` (`TIMESTAMPTZ`)

# > 표제부, 갑구, 을구 위험 사항은 변동 사항이 많아 JSONB 형태로 구성할 예정입니다.
# JSONB 내부엔 배열이 있고, 배열의 요소는 `위험 id` 데이터를 포함하고 있어서 해당 내용을 조회해서 바로 유저_체크리스트에 INSERT 할 예정입니다.
# > 
# - `title_section_analysis` (`JSONB`)
# - `part_a_analysis` (`JSONB`)
# - `part_b_analysis` (`JSONB`)


#제어 인자
#7개/ 스탬프는 자동생성
import psycopg2
import json

def sql_insert_to_analysis(conn, esID, uID, risk_score, list_tuple : tuple):
    #psycopg2.connect.cursor()
    #cur => conn.cursor()
    #analID is automatically generated
    print(esID, uID, risk_score)
    insert_query = "INSERT INTO public.analysis (estate_id, user_id, risk_score, title_section_analysis, part_a_analysis, part_b_analysis) VALUES (%s, %s, %s, %s, %s, %s)"

    array_title = list_tuple[0]
    array_a = list_tuple[1]
    array_b = list_tuple[2]

    t = json.dumps(array_title)
    a= json.dumps(array_a)
    b=json.dumps(array_b)

    cur = conn.cursor()
    cur.execute(insert_query, (esID, uID, risk_score, t, a, b))
    


    conn.commit()
    cur.close()
    return True
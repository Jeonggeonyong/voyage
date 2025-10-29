#같은 estateID값이 존재하는지 확인하는 함수

import psycopg2

def isin_estateID(conn, input_eid) -> bool:
    isin_estateID_query = "SELECT EXISTS (SELECT 1 FROM public.estates WHERE estate_id = %s);"
    
    cur = conn.cursor()

    cur.execute(isin_estateID_query, (str(input_eid),))
    exists = cur.fetchone()[0]
    cur.close()

    return exists


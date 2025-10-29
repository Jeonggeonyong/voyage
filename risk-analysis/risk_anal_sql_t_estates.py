# ### estates

# - `estate_id` (**PK**, `UUID`)
# - `estate_name` (`VARCHAR(255)`)
# - `estate_address` (`VARCHAR(255)`)
# - `zip_no` (`VARCHAR(10)`) : 우편번호
# - `created_at` (`TIMESTAMPTZ`)

#제어 인자
#4개 / 스탬프는 자동생성
import psycopg2

def sql_insert_to_estates(conn, eid, ename, eaddr, zipno):
    # eid = str(eid)

    # eid 는 내좆대로 int, ename이랑 eaddr는 가능하면 맞춰주고 안되면 주소로, zipno 단국대 16890
    insert_query = "INSERT INTO public.estates (estate_id, estate_name, estate_address, zip_no) VALUES (%s, %s, %s, %s)"
    
    cur = conn.cursor()

    cur.execute(insert_query, (eid, ename, eaddr, zipno))
    
    conn.commit()
    cur.close()
    return True

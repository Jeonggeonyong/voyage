### users_analysis

# - `user_id` (**PK**, `UUID`)
# - `user_name` (`VARCHAR(50)`)
# - `created_at` (`TIMESTAMPTZ`)
# - `token`(`VARCHAR(255)`) → 단용이가 FCM 토큰 INSERT 해줄 곳     (25/10/28 수정)

#제어 필요 인자, 2가지(2개는 외부 혹은 자동)


#필요 값, 유저 아이디, 유저 명
import psycopg2

def sql_insert_to_analysis(conn, dummy_uid):
    #psycopg2.connect.cursor()
    #cur => conn.cursor()
    insert_query = "INSERT INTO public.users_analysis (user_id) VALUES (%s)"

    cur = conn.cursor()
    cur.execute(insert_query, (dummy_uid,))
    
    cur.close()
    conn.commit()
    return True

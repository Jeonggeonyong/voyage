### interactions

# - `interaction_id` (**PK**, `UUID`)
# - `user_id` (**FK**, `UUID`)
# - `estate_id` (**FK**, `UUID`)
# - `interaction_type` (`ENUM`, `VARCHAR(50)`) : `isNotified, analysisCompleted, interested, contractCompleted`
# - `created_at` (`TIMESTAMPTZ`)



import psycopg2

def sql_insert_to_interaction(conn, uid, eid, itype):
    insert_query = """INSERT INTO public.interactions (
    user_id, estate_id, interaction_type) VALUES (%s, %s, %s)"""

    # itype = "analysisCompleted"

    cur = conn.cursor()
    cur.execute(insert_query, (uid, eid, itype))
    
    conn.commit()
    cur.close()
    return True
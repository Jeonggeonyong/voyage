import os
from dotenv import load_dotenv
import psycopg2
from flask import Flask, request, jsonify

load_dotenv()

def init_db():
    t1 = """CREATE TABLE IF NOT EXISTS users_community (
        id SERIAL PRIMARY KEY,
        google_id TEXT NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        image_url TEXT NOT NULL
    );"""
    t2 = """CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users_community(id),
        title VARCHAR(255) NOT NULL,
        content TEXT DEFAULT ''
    );"""
    t3 = """CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users_community(id),
        post_id INTEGER REFERENCES posts(id),
        content TEXT DEFAULT ''
    );"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(t1)
    cur.execute(t2)
    cur.execute(t3)
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

app = Flask(__name__)

with app.app_context():
    init_db()
    
@app.route('/')
def hello():
    return jsonify({"msg": "Voyage Community Server"})

@app.route("/users", methods=["GET", "POST"])
def users_main():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": "1"}), 500

    cur = conn.cursor()
    if request.method == "GET":
        cur.execute("SELECT id, username, image_url FROM users_community")
        rows = cur.fetchall()
        data = []
        for r in rows:
            data.append({"userID": str(r[0]), "username": str(r[1]), "image_url": str(r[2])})
        cur.close()
        conn.close()
        return jsonify(data), 200
    
    elif request.method == "POST":
        data = request.json
        try:
            cur.execute("INSERT INTO users_community (google_id, username, image_url) VALUES (%s, %s, %s)", 
                       (data['google_id'], data['username'], data['image_url']))
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            return jsonify({"code": "1"}), 500
        finally:
            cur.close()
            conn.close()

@app.route("/posts", methods=["GET", "POST"])
def posts_main():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": "1"}), 500

    cur = conn.cursor()
    if request.method == "GET":
        cur.execute("SELECT id, user_id, title, content FROM posts")
        rows = cur.fetchall()
        data = []
        for r in rows:
            data.append({"postID": str(r[0]), "userID": str(r[1]), "postTitle": str(r[2]), "postContent": str(r[3])})
        cur.close()
        conn.close()
        return jsonify(data), 200
    
    # {"userID":"109930773329408493076","postTitle":"test","postContent":"tetris"}
    elif request.method == "POST":
        data = request.json
        try:
            # 수정: 파라미터 바인딩 수정 (튜플로 전달)
            cur.execute("SELECT id, username, url FROM users_community WHERE google_id = %s", (data['userID'],))
            row = cur.fetchone()
            if row is None:
                return jsonify({"code": "1", "message": "User not found"}), 404
            local_user_id, username, url = row

            cur.execute("INSERT INTO posts (user_id, title, content) VALUES (%s, %s, %s)", 
                       (local_user_id, data['postTitle'], data['postContent']))
            conn.commit()
            return jsonify({"username": username, "image_url": url}), 200
        except Exception as e:
            return jsonify({"code": "1", "error": str(e)}), 500
        finally:
            cur.close()
            conn.close()

@app.route("/comments", methods=["GET", "POST"])
def comments_main():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": "1"}), 500
        
    cur = conn.cursor()
    if request.method == "GET":
        cur.execute("SELECT id, user_id, post_id, content FROM comments")
        rows = cur.fetchall()
        data = []
        for r in rows:
            data.append({"commentID": str(r[0]), "userID": str(r[1]), "postID": str(r[2]), "commentContent": str(r[3])})
        cur.close()
        conn.close()
        return jsonify(data), 200
        
    elif request.method == "POST":
        data = request.json
        try:
            # 수정: google_id로 users_community.id 조회 후 사용
            cur.execute("SELECT id, username, url FROM users_community WHERE google_id = %s", (data['userID'],))
            row = cur.fetchone()
            if row is None:
                return jsonify({"code": "1", "message": "User not found"}), 404
            local_user_id, username, url = row
            
            # 수정: 내부 user_id 사용
            cur.execute("INSERT INTO comments (user_id, post_id, content) VALUES (%s, %s, %s)", 
                       (local_user_id, data['postID'], data['commentContent']))
            conn.commit()
            return jsonify({"username": username, "image_url": url}), 200
        except Exception as e:
            return jsonify({"code": "1", "error": str(e)}), 500
        finally:
            cur.close()
            conn.close()

@app.route("/users/<int:userID>", methods=["GET"])
def get_user(userID):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": "1"}), 500
        
    cur = conn.cursor()
    if request.method == "GET":
        # 수정: 파라미터화된 쿼리 사용
        cur.execute("SELECT id, username FROM users_community WHERE id = %s", (userID,))
        row = cur.fetchone()
        if row is None:
            return jsonify({"code": "1"}), 404
        cur.close()
        conn.close()
        return jsonify({"userID": str(row[0]), "username": str(row[1])}), 200

@app.route("/posts/<int:postID>", methods=["GET"])
def get_post(postID):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": "1"}), 500

    cur = conn.cursor()
    if request.method == "GET":
        # 수정: 파라미터화된 쿼리 사용
        cur.execute("SELECT id, user_id, title, content FROM posts WHERE id = %s", (postID,))
        row = cur.fetchone()
        if row is None:
            return jsonify({"code": "1"}), 404
        data = {"postID": str(row[0]), "userID": str(row[1]), "postTitle": str(row[2]), "postContent": str(row[3]), "comments": []}
        cur.execute("SELECT id, user_id, content FROM comments WHERE post_id = %s", (postID,))
        rows = cur.fetchall()
        for r in rows:
            data["comments"].append({"commentID": str(r[0]), "userID": str(r[1]), "commentContent": str(r[2])})
        cur.close()
        conn.close()
        return jsonify(data), 200
        
@app.route("/comments/<int:commentID>", methods=["GET"])
def get_comment(commentID):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": "1"}), 500

    cur = conn.cursor()
    if request.method == "GET":
        # 수정: 파라미터화된 쿼리 사용
        cur.execute("SELECT id, user_id, post_id, content FROM comments WHERE id = %s", (commentID,))
        row = cur.fetchone()
        if row is None:
            return jsonify({"code": "1"}), 404
        data = {"commentID": str(row[0]), "userID": str(row[1]), "postID": str(row[2]), "commentContent": str(row[3])}
        cur.close()
        conn.close()
        return jsonify(data), 200
        
@app.route("/users/<userID>/posts/<int:postID>", methods=["GET", "POST", "DELETE"])
def handle_user_post(userID, postID):  # 수정: userID를 문자열로 받음
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": "1"}), 500

    cur = conn.cursor()
    if request.method == "GET":
        # 수정: google_id로 users_community.id 조회 후 사용
        cur.execute("SELECT id FROM users_community WHERE google_id = %s", (userID,))
        local_user_id_result = cur.fetchone()
        if local_user_id_result is None:
            return jsonify({"code": "1"}), 404
        local_user_id = local_user_id_result[0]
        
        cur.execute("SELECT id, user_id, title, content FROM posts WHERE id = %s AND user_id = %s", (postID, local_user_id))
        row = cur.fetchone()
        if row is None:
            return jsonify({"code": "1"}), 404
        data = {"postID": str(row[0]), "userID": str(row[1]), "postTitle": str(row[2]), "postContent": str(row[3]), "comments": []}
        cur.execute("SELECT id, user_id, content FROM comments WHERE post_id = %s", (postID,))
        rows = cur.fetchall()
        for r in rows:
            data["comments"].append({"commentID": str(r[0]), "userID": str(r[1]), "commentContent": str(r[2])})
        cur.close()
        conn.close()
        return jsonify(data), 200

    elif request.method == "POST":
        data = request.json
        try:
            # 수정: google_id로 users_community.id 조회 후 사용
            cur.execute("SELECT id FROM users_community WHERE google_id = %s", (userID,))
            local_user_id_result = cur.fetchone()
            if local_user_id_result is None:
                return jsonify({"code": "1"}), 404
            local_user_id = local_user_id_result[0]
            
            cur.execute("UPDATE posts SET title = %s, content = %s WHERE id = %s AND user_id = %s", 
                       (data['postTitle'], data['postContent'], postID, local_user_id))
            if cur.rowcount == 0:
                conn.rollback()
                return jsonify({"code": "1", "message": "Post not found or unauthorized"}), 404
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            conn.rollback()
            return jsonify({"code": "1", "error": str(e)}), 500
        finally:
            cur.close()
            conn.close()
    
    elif request.method == "DELETE":
        try:
            # 수정: google_id로 users_community.id 조회
            cur.execute("SELECT id FROM users_community WHERE google_id = %s", (userID,))
            local_user_id_result = cur.fetchone()
            if local_user_id_result is None:
                return jsonify({"code": "1", "message": "User not found"}), 404
            local_user_id = local_user_id_result[0]
            
            # 수정: 파라미터화된 쿼리 사용 및 권한 체크
            cur.execute("DELETE FROM comments WHERE post_id = %s", (postID,))
            cur.execute("DELETE FROM posts WHERE id = %s AND user_id = %s", (postID, local_user_id))
            
            if cur.rowcount == 0:  # 삭제된 행이 없으면 권한 없음
                conn.rollback()
                return jsonify({"code": "1", "message": "Post not found or unauthorized"}), 404
            
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            conn.rollback()
            return jsonify({"code": "1", "error": str(e)}), 500
        finally:
            cur.close()
            conn.close()

@app.route("/users/<userID>/comments/<int:commentID>", methods=["GET", "POST", "DELETE"])
def handle_user_comment(userID, commentID):  # 수정: userID를 문자열로 받음
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": "1"}), 500

    cur = conn.cursor()
    if request.method == "GET":
        # 수정: google_id로 users_community.id 조회 후 사용
        cur.execute("SELECT id FROM users_community WHERE google_id = %s", (userID,))
        local_user_id_result = cur.fetchone()
        if local_user_id_result is None:
            return jsonify({"code": "1"}), 404
        local_user_id = local_user_id_result[0]
        
        cur.execute("SELECT id, user_id, post_id, content FROM comments WHERE id = %s AND user_id = %s", 
                   (commentID, local_user_id))
        row = cur.fetchone()
        if row is None:
            return jsonify({"code": "1"}), 404
        return jsonify({"commentID": str(row[0]), "userID": str(row[1]), "postID": str(row[2]), "commentContent": str(row[3])}), 200

    elif request.method == "POST":
        data = request.json
        try:
            # 수정: google_id로 users_community.id 조회 후 사용
            cur.execute("SELECT id FROM users_community WHERE google_id = %s", (userID,))
            local_user_id_result = cur.fetchone()
            if local_user_id_result is None:
                return jsonify({"code": "1"}), 404
            local_user_id = local_user_id_result[0]
            
            cur.execute("UPDATE comments SET content = %s WHERE id = %s AND user_id = %s", 
                       (data['commentContent'], commentID, local_user_id))
            if cur.rowcount == 0:
                conn.rollback()
                return jsonify({"code": "1", "message": "Comment not found or unauthorized"}), 404
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            conn.rollback()
            return jsonify({"code": "1", "error": str(e)}), 500
        finally:
            cur.close()
            conn.close()
    
    elif request.method == "DELETE":
        try:
            # 수정: google_id로 users_community.id 조회
            cur.execute("SELECT id FROM users_community WHERE google_id = %s", (userID,))
            local_user_id_result = cur.fetchone()
            if local_user_id_result is None:
                return jsonify({"code": "1", "message": "User not found"}), 404
            local_user_id = local_user_id_result[0]
            
            # 수정: 파라미터화된 쿼리 사용 및 권한 체크
            cur.execute("DELETE FROM comments WHERE id = %s AND user_id = %s", (commentID, local_user_id))
            
            if cur.rowcount == 0:  # 삭제된 행이 없으면 권한 없음
                conn.rollback()
                return jsonify({"code": "1", "message": "Comment not found or unauthorized"}), 404
            
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            conn.rollback()
            return jsonify({"code": "1", "error": str(e)}), 500
        finally:
            cur.close()
            conn.close()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)

# temporary fix from cursor ai. will revert if anything goes wrong.
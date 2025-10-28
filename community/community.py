import os
from dotenv import load_dotenv
import psycopg2
from flask import Flask, request, jsonify

load_dotenv()

def init_db():
    t1 = """CREATE TABLE IF NOT EXISTS users_community (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL
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
        cur.execute("SELECT id, username FROM users_community")
        rows = cur.fetchall()
        data = []
        for r in rows:
            data.append({"userID": str(r[0]), "username": str(r[1])})
        cur.close()
        conn.close()
        return jsonify(data), 200
    
    elif request.method == "POST":
        data = request.json
        try:
            cur.execute(f"INSERT INTO users_community (username) VALUES ({data['username']});")
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
        
    elif request.method == "POST":
        data = request.json
        try:
            cur.execute(f"INSERT INTO posts (user_id, title, content) VALUES ({data['userID']}, {data['postTitle']}, {data['postContent']});")
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            return jsonify({"code": "1"}), 500
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
            cur.execute(f"INSERT INTO comments (user_id, post_id, content) VALUES ({data['userID']}, {data['postID']}, {data['commentContent']});")
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            return jsonify({"code": "1"}), 500
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
        cur.execute(f"SELECT id, username FROM users_community WHERE id = {userID}")
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
        cur.execute(f"SELECT id, user_id, title, content FROM posts WHERE id = {postID}")
        row = cur.fetchone()
        if row is None:
            return jsonify({"code": "1"}), 404
        data = {"postID": str(row[0]), "userID": str(row[1]), "postTitle": str(row[2]), "postContent": str(row[3]), "comments": []}
        cur.execute(f"SELECT id, user_id, content FROM comments WHERE post_id = {postID}")
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
        cur.execute(f"SELECT id, user_id, post_id, content FROM comments WHERE id = {commentID}")
        row = cur.fetchone()
        if row is None:
            return jsonify({"code": "1"}), 404
        data = {"commentID": str(row[0]), "userID": str(row[1]), "postID": str(row[2]), "commentContent": str(row[3])}
        cur.close()
        conn.close()
        return jsonify(data), 200
        
@app.route("/users/<int:userID>/posts/<int:postID>", methods=["GET", "POST", "DELETE"])
def handle_user_post(userID, postID):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": "1"}), 500

    cur = conn.cursor()
    if request.method == "GET":
        cur.execute(f"SELECT id, user_id, title, content FROM posts WHERE id = {postID} AND user_id = {userID}")
        row = cur.fetchone()
        if row is None:
            return jsonify({"code": "1"}), 404
        data = {"postID": str(row[0]), "userID": str(row[1]), "postTitle": str(row[2]), "postContent": str(row[3]), "comments": []}
        cur.execute(f"SELECT id, user_id, content FROM comments WHERE post_id = {postID}")
        rows = cur.fetchall()
        for r in rows:
            data["comments"].append({"commentID": str(r[0]), "userID": str(r[1]), "commentContent": str(r[2])})
        cur.close()
        conn.close()
        return jsonify(data), 200

    elif request.method == "POST":
        data = request.json
        try:
            cur.execute(f"UPDATE posts SET title = {data['postTitle']}, content = {data['postContent']} WHERE id = {postID} AND user_id = {userID}")
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            return jsonify({"code": "1"}), 500
        finally:
            cur.close()
            conn.close()
    
    elif request.method == "DELETE":
        try:
            cur.execute(f"DELETE FROM posts WHERE id = {postID} AND user_id = {userID}")
            cur.execute(f"DELETE FROM comments where post_id = {postID}")
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            return jsonify({"code": "1"}), 500
        finally:
            cur.close()
            conn.close()

@app.route("/users/<int:userID>/comments/<int:commentID>", methods=["GET", "POST", "DELETE"])
def handle_user_comment(userID, commentID):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"code": "1"}), 500

    cur = conn.cursor()
    if request.method == "GET":
        cur.execute(f"SELECT id, user_id, post_id, content FROM comments WHERE id = {commentID} AND user_id = {userID}")
        row = cur.fetchone()
        if row is None:
            return jsonify({"code": "1"}), 404
        return jsonify({"commentID": str(row[0]), "userID": str(row[1]), "postID": str(row[2]), "commentContent": str(row[3])}), 200

    elif request.method == "POST":
        data = request.json
        try:
            cur.execute(f"UPDATE comments SET content = {data['commentContent']} WHERE id = {commentID} AND user_id = {userID}")
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            return jsonify({"code": "1"}), 500
        finally:
            cur.close()
            conn.close()
    
    elif request.method == "DELETE":
        try:
            cur.execute(f"DELETE FROM comments where comment_id = {commentID}")
            conn.commit()
            return jsonify({"code": "0"}), 200
        except Exception as e:
            return jsonify({"code": "1"}), 500
        finally:
            cur.close()
            conn.close()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)

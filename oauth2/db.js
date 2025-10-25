// db.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// 애플리케이션 어디서든 이 query 함수를 사용해 DB에 쿼리를 날릴 수 있습니다.
module.exports = {
  query: (text, params) => pool.query(text, params),
};
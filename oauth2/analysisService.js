// db.js에서 query 함수 가져옴
const { query } = require('./db');

/**
 * users_analysis 테이블에 사용자 정보를 추가 (UPSERT)
 * 이미 user_id가 존재하면 작업 X
 * * @param {number} userId - users 테이블의 기본 키 (PK)
 * @param {string} userName - 사용자의 전체 이름 (full_name)
 */
const checkInUserAnalysis = async (userId, userName) => {
  // PostgreSQL의 "INSERT ... ON CONFLICT ... DO NOTHING" (UPSERT) 구문 사용
  // user_id가 PK 또는 UNIQUE 제약 조건이 걸려있어야 함
  const insertQuery = `
    INSERT INTO users_analysis (user_id, user_name, created_at, token)
    VALUES ($1, $2, NOW(), NULL)
    ON CONFLICT (user_id) DO NOTHING;
  `;

  try {
    // 쿼리 실행
    await query(insertQuery, [userId, userName]);
    console.log(`[Analysis DB] User ${userId} checked in users_analysis table.`);
  } catch (error) {
    console.error(`Error adding user ${userId} to users_analysis:`, error.message);
    // 참고: 이 작업이 로그인/회원가입의 핵심 흐름을 막으면 안 된다면,
    // 여기서 에러를 throw하지 않고 로깅만 하고 넘어가는 것이 더 안전
    // (현재는 로깅만 하고, 로그인 흐름은 계속 진행)
  }
};

module.exports = {
  checkInUserAnalysis,
};
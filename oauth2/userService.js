const db = require('./db'); // 위에서 만든 DB 연결 모듈

/**
 * Google 유저 정보 기반으로 DB에서 유저를 찾거나 새로 생성합니다.
 * @param {object} googleUser - Google ID Token에서 얻은 유저 페이로드
 * @returns {object} DB에 저장된 유저 정보
 */
async function findOrCreateUser(googleUser) {
  const { sub, email, name, picture } = googleUser;

  const queryText = `
    INSERT INTO users (google_id, email, full_name, profile_picture_url, last_login_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (google_id) 
    DO UPDATE SET 
      full_name = $3, 
      profile_picture_url = $4, 
      last_login_at = NOW()
    RETURNING *;
  `;

  const values = [sub, email, name, picture];

  try {
    const { rows } = await db.query(queryText, values);
    console.log('DB User:', rows[0]);
    return rows[0];
  } catch (error) {
    console.error('Error in findOrCreateUser:', error);
    throw error;
  }
}

module.exports = { findOrCreateUser };
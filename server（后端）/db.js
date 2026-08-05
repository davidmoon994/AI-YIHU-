"use strict";

const mysql = require("mysql2/promise");
const logger = require("./utils/logger");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  namedPlaceholders: true,
  dateStrings: true,
  timezone: "+08:00"
});

/**
 * 执行单条SQL（自动获取/释放连接）
 * @param {string} sql
 * @param {object|array} params
 */
async function query(sql, params) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    logger.error(`[DB QUERY ERROR] ${err.message} | SQL: ${sql}`);
    throw err;
  }
}

/**
 * 执行事务
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<any>} handler
 */
async function transaction(handler) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await handler(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    logger.error(`[DB TRANSACTION ERROR] ${err.message}`);
    throw err;
  } finally {
    conn.release();
  }
}

async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  logger.info("MySQL 连接池初始化成功");
}

module.exports = {
  pool,
  query,
  transaction,
  testConnection
};

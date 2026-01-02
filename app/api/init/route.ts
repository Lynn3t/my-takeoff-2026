import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { hashPassword, generatePassword } from '@/lib/auth';

// 初始化数据库 - 创建表和默认管理员用户
export async function POST() {
  const logs: string[] = [];
  let adminPassword: string | null = null;

  try {
    // 创建用户表
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    logs.push('[OK] users 表已创建或已存在');

    // 创建会话表
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    logs.push('[OK] sessions 表已创建或已存在');

    // 创建 takeoff_logs 表（如果不存在）- 带用户数据隔离
    await sql`
      CREATE TABLE IF NOT EXISTS takeoff_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date_key VARCHAR(10) NOT NULL,
        status INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date_key)
      )
    `;
    logs.push('[OK] takeoff_logs 表已创建或已存在');

    // 创建索引以提升查询性能
    await sql`
      CREATE INDEX IF NOT EXISTS idx_takeoff_logs_user_id
      ON takeoff_logs(user_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_takeoff_logs_date_key
      ON takeoff_logs(date_key)
    `;
    logs.push('[OK] takeoff_logs 索引已创建或已存在');

    // 检查是否已存在管理员用户 Fimall
    const { rows: existingUsers } = await sql`
      SELECT * FROM users WHERE username = 'Fimall'
    `;

    if (existingUsers.length === 0) {
      // 生成随机密码
      adminPassword = generatePassword(16);
      const passwordHash = await hashPassword(adminPassword);

      // 创建默认管理员用户
      await sql`
        INSERT INTO users (username, password_hash, is_admin)
        VALUES ('Fimall', ${passwordHash}, TRUE)
      `;
      logs.push('[OK] 管理员用户 Fimall 已创建');
      logs.push(`[IMPORTANT] 初始密码: ${adminPassword}`);
      logs.push('[IMPORTANT] 请登录后立即修改密码！');
    } else {
      logs.push('[INFO] 管理员用户 Fimall 已存在，跳过创建');
    }

    return NextResponse.json({
      success: true,
      logs,
      adminPassword // 只有在新创建时才会返回密码
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '初始化失败';
    logs.push(`[ERROR] ${message}`);
    return NextResponse.json({
      success: false,
      logs,
      error: message
    }, { status: 500 });
  }
}

// 检查是否需要初始化
export async function GET() {
  try {
    // 检查 users 表是否存在
    const { rows } = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      ) as exists
    `;

    const tableExists = rows[0]?.exists === true;

    if (!tableExists) {
      return NextResponse.json({ needsInit: true, message: '需要初始化数据库' });
    }

    // 检查是否有用户
    const { rows: users } = await sql`SELECT COUNT(*) as count FROM users`;
    const userCount = parseInt(users[0]?.count || '0');

    if (userCount === 0) {
      return NextResponse.json({ needsInit: true, message: '需要创建管理员用户' });
    }

    return NextResponse.json({ needsInit: false, message: '数据库已初始化' });
  } catch {
    // 表不存在会报错，需要初始化
    return NextResponse.json({ needsInit: true, message: '需要初始化数据库' });
  }
}

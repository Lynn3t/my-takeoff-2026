import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// 数据迁移API - 仅管理员可用，一次性使用
export async function POST(request: Request) {
  const logs: string[] = [];

  try {
    // 严格验证：仅管理员可执行迁移
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (!user.is_admin) {
      return NextResponse.json({ error: '无权限，仅管理员可执行迁移' }, { status: 403 });
    }

    // 检查是否已经迁移过（通过检查表结构是否有user_id列）
    const { rows: columns } = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'takeoff_logs' AND column_name = 'user_id'
    `;

    if (columns.length > 0) {
      return NextResponse.json({
        success: false,
        message: '已经是新表结构，无需迁移',
        logs: ['[INFO] 表结构已包含 user_id 列，跳过迁移']
      });
    }

    // 步骤1: 创建新表
    await sql`
      CREATE TABLE takeoff_logs_new (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date_key VARCHAR(10) NOT NULL,
        status INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date_key)
      )
    `;
    logs.push('[OK] 新表 takeoff_logs_new 创建成功');

    // 步骤2: 为每个现有用户复制所有现有数据
    const { rowCount } = await sql`
      INSERT INTO takeoff_logs_new (user_id, date_key, status)
      SELECT u.id, t.date_key, t.status
      FROM users u
      CROSS JOIN takeoff_logs t
    `;
    logs.push(`[OK] 已为所有用户复制数据，共 ${rowCount} 条记录`);

    // 步骤3: 重命名表
    await sql`ALTER TABLE takeoff_logs RENAME TO takeoff_logs_backup`;
    logs.push('[OK] 原表已备份为 takeoff_logs_backup');

    await sql`ALTER TABLE takeoff_logs_new RENAME TO takeoff_logs`;
    logs.push('[OK] 新表已重命名为 takeoff_logs');

    // 步骤4: 创建索引
    await sql`CREATE INDEX idx_takeoff_logs_user_id ON takeoff_logs(user_id)`;
    await sql`CREATE INDEX idx_takeoff_logs_date_key ON takeoff_logs(date_key)`;
    logs.push('[OK] 索引创建成功');

    return NextResponse.json({
      success: true,
      logs,
      message: '迁移完成！备份表 takeoff_logs_backup 保留供检查，确认无误后可手动删除'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '迁移失败';
    logs.push(`[ERROR] ${message}`);
    return NextResponse.json({ success: false, logs, error: message }, { status: 500 });
  }
}

// 检查迁移状态
export async function GET(request: Request) {
  try {
    // 验证用户已登录
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 检查表结构
    const { rows: columns } = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'takeoff_logs' AND column_name = 'user_id'
    `;

    const isMigrated = columns.length > 0;

    // 检查是否存在备份表
    const { rows: backupTable } = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'takeoff_logs_backup'
      ) as exists
    `;
    const hasBackup = backupTable[0]?.exists === true;

    return NextResponse.json({
      isMigrated,
      hasBackup,
      message: isMigrated
        ? '已迁移到新表结构（支持用户数据隔离）'
        : '尚未迁移，仍使用旧表结构（数据共享）'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '检查失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

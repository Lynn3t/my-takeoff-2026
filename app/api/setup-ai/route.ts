import { sql } from '@vercel/postgres';
import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// 创建 AI 相关表
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  const logs: string[] = [];

  try {
    // 创建 AI 配置表
    await sql`
      CREATE TABLE IF NOT EXISTS ai_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      )
    `;
    logs.push('[OK] ai_config 表已创建');

    // 创建报告查看记录表
    await sql`
      CREATE TABLE IF NOT EXISTS report_viewed (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_type VARCHAR(20) NOT NULL,
        period_key VARCHAR(20) NOT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, report_type, period_key)
      )
    `;
    logs.push('[OK] report_viewed 表已创建');

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建表失败';
    logs.push(`[ERROR] ${message}`);
    return NextResponse.json({ success: false, logs, error: message }, { status: 500 });
  }
}

// 检查表是否存在
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('ai_config', 'report_viewed')
    `;

    const tables = rows.map(r => r.table_name);

    return NextResponse.json({
      ai_config: tables.includes('ai_config'),
      report_viewed: tables.includes('report_viewed'),
      message: tables.length === 2 ? '所有表已存在' : '需要创建表'
    });
  } catch (error) {
    return NextResponse.json({ error: '检查失败' }, { status: 500 });
  }
}

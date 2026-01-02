import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // 1. 获取当前用户 - 防止越权访问
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    // 2. 严格验证用户已登录
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 3. 只查询当前用户的数据 - 使用服务端获取的 user.id，不信任客户端
    const { rows } = await sql`
      SELECT date_key, status
      FROM takeoff_logs
      WHERE user_id = ${user.id}
    `;

    // 4. 转换为前端需要的格式
    const dataMap: Record<string, number> = {};
    rows.forEach(row => {
      dataMap[row.date_key] = row.status;
    });

    return NextResponse.json({ data: dataMap });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取数据失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 1. 获取当前用户 - 防止越权访问
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    // 2. 严格验证用户已登录
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { date, status, isDelete } = body;

    // 3. 日期验证（保留原有逻辑）
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    if (date > todayString) {
      return NextResponse.json(
        { error: '禁止提前填写未来日期' },
        { status: 400 }
      );
    }

    // 4. 执行操作 - 始终使用服务端获取的 user.id，防止越权
    if (isDelete) {
      // 只能删除自己的数据
      await sql`
        DELETE FROM takeoff_logs
        WHERE user_id = ${user.id} AND date_key = ${date}
      `;
    } else {
      // 插入或更新自己的数据
      await sql`
        INSERT INTO takeoff_logs (user_id, date_key, status, updated_at)
        VALUES (${user.id}, ${date}, ${status}, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, date_key)
        DO UPDATE SET status = ${status}, updated_at = CURRENT_TIMESTAMP
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '操作失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

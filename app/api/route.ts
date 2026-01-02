import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM takeoff_logs`;
    // 显式声明类型 accumulator
    const dataMap: Record<string, number> = {};
    rows.forEach(row => {
      dataMap[row.date_key] = row.status;
    });
    return NextResponse.json({ data: dataMap });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, status, isDelete } = body;

    // 获取今天的日期（使用服务器时区）
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // 禁止填写未来日期
    if (date > todayString) {
      return NextResponse.json(
        { error: '禁止提前填写未来日期' },
        { status: 400 }
      );
    }

    if (isDelete) {
      await sql`DELETE FROM takeoff_logs WHERE date_key = ${date}`;
    } else {
      await sql`
        INSERT INTO takeoff_logs (date_key, status)
        VALUES (${date}, ${status})
        ON CONFLICT (date_key) 
        DO UPDATE SET status = ${status};
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
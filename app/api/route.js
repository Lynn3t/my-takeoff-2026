import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM takeoff_logs`;
    const dataMap = {};
    rows.forEach(row => {
      dataMap[row.date_key] = row.status;
    });
    return NextResponse.json({ data: dataMap });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { date, status, isDelete } = body;

    if (isDelete) {
      // 如果前端传了删除标记，从数据库移除该条目
      await sql`DELETE FROM takeoff_logs WHERE date_key = ${date}`;
    } else {
      // 插入或更新
      await sql`
        INSERT INTO takeoff_logs (date_key, status)
        VALUES (${date}, ${status})
        ON CONFLICT (date_key) 
        DO UPDATE SET status = ${status};
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
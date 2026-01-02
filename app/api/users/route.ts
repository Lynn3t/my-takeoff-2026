import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { hashPassword, getCurrentUser } from '@/lib/auth';

// 获取所有用户（仅管理员）
export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    if (!user || !user.is_admin) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const { rows } = await sql`
      SELECT id, username, is_admin, created_at FROM users ORDER BY id
    `;

    return NextResponse.json({ users: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取用户列表失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 新增用户（仅管理员）
export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    if (!user || !user.is_admin) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { username, password, is_admin } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    if (username.length < 2 || username.length > 50) {
      return NextResponse.json({ error: '用户名长度应为 2-50 个字符' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码长度至少 6 个字符' }, { status: 400 });
    }

    // 检查用户名是否已存在
    const { rows: existing } = await sql`
      SELECT id FROM users WHERE username = ${username}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const { rows } = await sql`
      INSERT INTO users (username, password_hash, is_admin)
      VALUES (${username}, ${passwordHash}, ${is_admin || false})
      RETURNING id, username, is_admin, created_at
    `;

    return NextResponse.json({ success: true, user: rows[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建用户失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 删除用户（仅管理员）
export async function DELETE(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    if (!user || !user.is_admin) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    // 不能删除自己
    if (parseInt(userId) === user.id) {
      return NextResponse.json({ error: '不能删除当前登录用户' }, { status: 400 });
    }

    await sql`DELETE FROM users WHERE id = ${parseInt(userId)}`;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除用户失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 修改密码
export async function PUT(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, newPassword } = body;

    // 管理员可以修改任何人的密码，普通用户只能改自己的
    if (!user.is_admin && userId !== user.id) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: '密码长度至少 6 个字符' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);

    await sql`
      UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '修改密码失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

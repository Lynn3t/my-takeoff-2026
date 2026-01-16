import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { verifyPassword, generateSessionToken, getCurrentUser } from '@/lib/auth';

// 登录
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    // 查找用户
    const { rows } = await sql`SELECT * FROM users WHERE username = ${username}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const user = rows[0];

    // 验证密码
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 创建会话
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后过期

    await sql`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt.toISOString()})
    `;

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin
      }
    });

    // 设置 cookie
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '登录失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 登出
export async function DELETE(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    if (user) {
      // 删除所有该用户的会话
      await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete('session_token');
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '登出失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 获取当前用户信息
export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取用户信息失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

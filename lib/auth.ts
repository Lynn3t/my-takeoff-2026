import bcrypt from 'bcryptjs';
import { sql } from '@vercel/postgres';

// 生成随机密码
export function generatePassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// 哈希密码
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// 验证密码
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 生成会话 token
export function generateSessionToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// 用户类型
export interface User {
  id: number;
  username: string;
  password_hash: string;
  is_admin: boolean;
  created_at: Date;
}

// 验证会话
export async function validateSession(token: string): Promise<User | null> {
  try {
    const { rows } = await sql`
      SELECT u.* FROM users u
      JOIN sessions s ON u.id = s.user_id
      WHERE s.token = ${token} AND s.expires_at > NOW()
    `;
    if (rows.length > 0) {
      return rows[0] as User;
    }
    return null;
  } catch {
    return null;
  }
}

// 从 cookie 获取当前用户
export async function getCurrentUser(cookieHeader: string | null): Promise<User | null> {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const token = cookies['session_token'];
  if (!token) return null;

  return validateSession(token);
}

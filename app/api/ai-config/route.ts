import { sql } from '@vercel/postgres';
import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// 获取 AI 配置
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { rows } = await sql`
      SELECT config_key, config_value FROM ai_config
    `;

    // 转换为对象格式
    const config: Record<string, string> = {};
    rows.forEach(row => {
      config[row.config_key] = row.config_value;
    });

    // 非管理员隐藏敏感信息（只返回是否已配置）
    if (!user.is_admin) {
      return NextResponse.json({
        configured: !!(config['ai_endpoint'] && config['ai_api_key']),
        model: config['ai_model'] || 'gpt-3.5-turbo'
      });
    }

    return NextResponse.json({
      config: {
        ai_endpoint: config['ai_endpoint'] || '',
        ai_api_key: config['ai_api_key'] ? '******' : '', // 隐藏 API key
        ai_model: config['ai_model'] || 'gpt-3.5-turbo',
        has_api_key: !!config['ai_api_key']
      }
    });
  } catch (error) {
    console.error('获取 AI 配置失败:', error);
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
}

// 更新 AI 配置（仅管理员）
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { ai_endpoint, ai_api_key, ai_model } = body;

    // 验证必填字段
    if (!ai_endpoint) {
      return NextResponse.json({ error: 'AI 端点地址不能为空' }, { status: 400 });
    }

    // 更新或插入配置
    const configs = [
      { key: 'ai_endpoint', value: ai_endpoint },
      { key: 'ai_model', value: ai_model || 'gpt-3.5-turbo' }
    ];

    // 只有当 API key 不是占位符时才更新
    if (ai_api_key && ai_api_key !== '******') {
      configs.push({ key: 'ai_api_key', value: ai_api_key });
    }

    for (const { key, value } of configs) {
      await sql`
        INSERT INTO ai_config (config_key, config_value, updated_by, updated_at)
        VALUES (${key}, ${value}, ${user.id}, NOW())
        ON CONFLICT (config_key)
        DO UPDATE SET config_value = ${value}, updated_by = ${user.id}, updated_at = NOW()
      `;
    }

    return NextResponse.json({ success: true, message: 'AI 配置已保存' });
  } catch (error) {
    console.error('保存 AI 配置失败:', error);
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 });
  }
}

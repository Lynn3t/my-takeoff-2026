import { sql } from '@vercel/postgres';
import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { TAKEOFF_REPORT_SYSTEM_PROMPT, generateUserDataPrompt } from '@/lib/ai-prompts';

type ReportType = 'week' | 'month' | 'quarter' | 'year';

// 获取周期的开始和结束日期
function getPeriodDates(type: ReportType, date: Date): { start: string; end: string; label: string; periodKey: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  switch (type) {
    case 'week': {
      // 获取本周一和周日
      const dayOfWeek = date.getDay();
      const monday = new Date(date);
      monday.setDate(day - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const startStr = formatDate(monday);
      const endStr = formatDate(sunday);
      const weekNum = getWeekNumber(monday);

      return {
        start: startStr,
        end: endStr,
        label: `${year}年第${weekNum}周`,
        periodKey: `${year}-W${weekNum.toString().padStart(2, '0')}`
      };
    }
    case 'month': {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      return {
        start: formatDate(firstDay),
        end: formatDate(lastDay),
        label: `${year}年${month + 1}月`,
        periodKey: `${year}-M${(month + 1).toString().padStart(2, '0')}`
      };
    }
    case 'quarter': {
      const quarter = Math.floor(month / 3);
      const firstDay = new Date(year, quarter * 3, 1);
      const lastDay = new Date(year, quarter * 3 + 3, 0);
      return {
        start: formatDate(firstDay),
        end: formatDate(lastDay),
        label: `${year}年Q${quarter + 1}`,
        periodKey: `${year}-Q${quarter + 1}`
      };
    }
    case 'year': {
      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        label: `${year}年`,
        periodKey: `${year}`
      };
    }
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// 计算统计数据
function calculateStats(data: { date_key: string; status: number }[], startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

  // 过滤周期内的数据
  const periodData = data.filter(d => d.date_key >= startDate && d.date_key <= endDate);

  const recordedDays = periodData.length;
  const successDays = periodData.filter(d => d.status > 0).length;
  const zeroDays = periodData.filter(d => d.status === 0).length;
  const totalCount = periodData.reduce((sum, d) => sum + (d.status > 0 ? d.status : 0), 0);
  const avgPerDay = recordedDays > 0 ? totalCount / recordedDays : 0;

  // 找最高记录
  let maxCount = 0;
  let maxCountDate = '';
  periodData.forEach(d => {
    if (d.status > maxCount) {
      maxCount = d.status;
      maxCountDate = d.date_key;
    }
  });

  // 计算连续记录天数
  let streakDays = 0;
  const sortedData = [...periodData].sort((a, b) => b.date_key.localeCompare(a.date_key));
  for (const d of sortedData) {
    if (d.status > 0) {
      streakDays++;
    } else {
      break;
    }
  }

  // 按星期统计
  const dayOfWeekStats: Record<string, { count: number; days: number }> = {};
  for (let i = 0; i < 7; i++) {
    dayOfWeekStats[i.toString()] = { count: 0, days: 0 };
  }
  periodData.forEach(d => {
    const date = new Date(d.date_key);
    const dow = date.getDay().toString();
    if (d.status > 0) {
      dayOfWeekStats[dow].count += d.status;
      dayOfWeekStats[dow].days++;
    }
  });

  return {
    totalDays,
    recordedDays,
    totalCount,
    successDays,
    zeroDays,
    avgPerDay,
    maxCount,
    maxCountDate,
    streakDays,
    dayOfWeekStats
  };
}

// 检查是否有未查看的报告
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const today = new Date();
    const reportTypes: ReportType[] = ['week', 'month', 'quarter', 'year'];
    const pendingReports: { type: ReportType; periodKey: string; label: string }[] = [];

    for (const type of reportTypes) {
      // 获取上一个周期（不是当前周期）
      const prevDate = new Date(today);
      switch (type) {
        case 'week':
          prevDate.setDate(prevDate.getDate() - 7);
          break;
        case 'month':
          prevDate.setMonth(prevDate.getMonth() - 1);
          break;
        case 'quarter':
          prevDate.setMonth(prevDate.getMonth() - 3);
          break;
        case 'year':
          prevDate.setFullYear(prevDate.getFullYear() - 1);
          break;
      }

      const period = getPeriodDates(type, prevDate);

      // 检查是否已查看
      const { rows } = await sql`
        SELECT id FROM report_viewed
        WHERE user_id = ${user.id}
          AND report_type = ${type}
          AND period_key = ${period.periodKey}
      `;

      if (rows.length === 0) {
        pendingReports.push({
          type,
          periodKey: period.periodKey,
          label: period.label
        });
      }
    }

    // 检查AI是否已配置
    const { rows: configRows } = await sql`
      SELECT config_value FROM ai_config WHERE config_key = 'ai_endpoint'
    `;
    const aiConfigured = configRows.length > 0 && configRows[0].config_value;

    return NextResponse.json({
      pendingReports,
      aiConfigured: !!aiConfigured
    });
  } catch (error) {
    console.error('检查报告状态失败:', error);
    return NextResponse.json({ error: '检查失败' }, { status: 500 });
  }
}

// 生成报告
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, markViewed, periodOffset = 0 } = body as { type: ReportType; markViewed?: boolean; periodOffset?: number };

    if (!['week', 'month', 'quarter', 'year'].includes(type)) {
      return NextResponse.json({ error: '无效的报告类型' }, { status: 400 });
    }

    // 根据periodOffset获取对应周期（0=当前周期，-1=上一周期）
    const today = new Date();
    const targetDate = new Date(today);
    switch (type) {
      case 'week':
        targetDate.setDate(targetDate.getDate() + periodOffset * 7);
        break;
      case 'month':
        targetDate.setMonth(targetDate.getMonth() + periodOffset);
        break;
      case 'quarter':
        targetDate.setMonth(targetDate.getMonth() + periodOffset * 3);
        break;
      case 'year':
        targetDate.setFullYear(targetDate.getFullYear() + periodOffset);
        break;
    }

    const period = getPeriodDates(type, targetDate);

    // 获取AI配置
    const { rows: configRows } = await sql`
      SELECT config_key, config_value FROM ai_config
    `;
    const config: Record<string, string> = {};
    configRows.forEach(row => {
      config[row.config_key] = row.config_value;
    });

    if (!config['ai_endpoint'] || !config['ai_api_key']) {
      return NextResponse.json({ error: 'AI 未配置，请联系管理员' }, { status: 400 });
    }

    // 获取用户数据
    const { rows: dataRows } = await sql`
      SELECT date_key, status FROM takeoff_logs
      WHERE user_id = ${user.id}
        AND date_key >= ${period.start}
        AND date_key <= ${period.end}
      ORDER BY date_key
    `;

    // 计算统计
    const stats = calculateStats(dataRows as { date_key: string; status: number }[], period.start, period.end);

    // 如果没有数据，返回提示
    if (stats.recordedDays === 0) {
      const emptyReport = `## ${period.label} 起飞报告

这个周期内暂无记录数据。

开始记录你的起飞日志，才能生成有意义的报告哦！`;

      if (markViewed) {
        await sql`
          INSERT INTO report_viewed (user_id, report_type, period_key)
          VALUES (${user.id}, ${type}, ${period.periodKey})
          ON CONFLICT (user_id, report_type, period_key) DO NOTHING
        `;
      }

      return NextResponse.json({
        report: emptyReport,
        period: period.label,
        stats
      });
    }

    // 生成提示词
    const userPrompt = generateUserDataPrompt(type, period.label, stats);

    // 调用AI
    const aiResponse = await fetch(config['ai_endpoint'], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config['ai_api_key']}`
      },
      body: JSON.stringify({
        model: config['ai_model'] || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: TAKEOFF_REPORT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI 请求失败:', aiResponse.status, errorText);
      return NextResponse.json({
        error: `AI 服务请求失败 (${aiResponse.status}): ${errorText.slice(0, 200)}`
      }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const report = aiData.choices?.[0]?.message?.content || '报告生成失败';

    // 标记为已查看
    if (markViewed) {
      await sql`
        INSERT INTO report_viewed (user_id, report_type, period_key)
        VALUES (${user.id}, ${type}, ${period.periodKey})
        ON CONFLICT (user_id, report_type, period_key) DO NOTHING
      `;
    }

    return NextResponse.json({
      report,
      period: period.label,
      stats
    });
  } catch (error) {
    console.error('生成报告失败:', error);
    return NextResponse.json({ error: '生成报告失败' }, { status: 500 });
  }
}

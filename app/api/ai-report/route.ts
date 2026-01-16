import { sql } from '@vercel/postgres';
import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { TAKEOFF_REPORT_SYSTEM_PROMPT, buildStatsMarkdown, generateReportAnalysisPrompt } from '@/lib/ai-prompts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type ReportType = 'week' | 'month' | 'quarter' | 'year';

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

function getUtc8Date(date = new Date()): Date {
  const utc8 = new Date(date.getTime() + UTC8_OFFSET_MS);
  return new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth(), utc8.getUTCDate()));
}

// 获取周期的开始和结束日期
function getPeriodDates(type: ReportType, date: Date): { start: string; end: string; label: string; periodKey: string } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  switch (type) {
    case 'week': {
      // 获取本周一和周日
      const dayOfWeek = date.getUTCDay();
      const monday = new Date(date);
      monday.setUTCDate(day - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);

      const startStr = formatDate(monday);
      const endStr = formatDate(sunday);
      const isoWeek = getISOWeek(monday);

      return {
        start: startStr,
        end: endStr,
        label: `${isoWeek.year}年第${isoWeek.week}周`,
        periodKey: `${isoWeek.year}-W${isoWeek.week.toString().padStart(2, '0')}`
      };
    }
    case 'month': {
      const firstDay = new Date(Date.UTC(year, month, 1));
      const lastDay = new Date(Date.UTC(year, month + 1, 0));
      return {
        start: formatDate(firstDay),
        end: formatDate(lastDay),
        label: `${year}年${month + 1}月`,
        periodKey: `${year}-M${(month + 1).toString().padStart(2, '0')}`
      };
    }
    case 'quarter': {
      const quarter = Math.floor(month / 3);
      const firstDay = new Date(Date.UTC(year, quarter * 3, 1));
      const lastDay = new Date(Date.UTC(year, quarter * 3 + 3, 0));
      return {
        start: formatDate(firstDay),
        end: formatDate(lastDay),
        label: `${year}年Q${quarter + 1}`,
        periodKey: `${year}-Q${quarter + 1}`
      };
    }
    case 'year': {
      const firstDay = new Date(Date.UTC(year, 0, 1));
      const lastDay = new Date(Date.UTC(year, 11, 31));
      return {
        start: formatDate(firstDay),
        end: formatDate(lastDay),
        label: `${year}年`,
        periodKey: `${year}`
      };
    }
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildChatCompletionsEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const pathname = url.pathname.replace(/\/+$/, '');
    if (pathname.endsWith('/chat/completions')) {
      url.pathname = pathname;
      return url.toString();
    }
    url.pathname = `${pathname}/chat/completions`;
    return url.toString();
  } catch {
    const [base, query] = endpoint.split('?', 2);
    const trimmed = base.replace(/\/+$/, '');
    const full = trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
    return query ? `${full}?${query}` : full;
  }
}

// ISO 8601 周数计算：返回 { year, week }
// 一年的第一周是包含该年第一个周四的那一周
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // 设置到本周四（ISO周从周一开始，周四决定周属于哪一年）
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // 获取该周四所在年份的1月1日
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // 计算周数
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

// 计算统计数据
function calculateStats(data: { date_key: string; status: number }[], startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

  // 过滤周期内的数据，缺失日期视为 0 次
  const periodData = data.filter(d => d.date_key >= startDate && d.date_key <= endDate);
  const dataMap = new Map<string, number>();
  periodData.forEach(d => dataMap.set(d.date_key, d.status));

  const recordedDays = totalDays;
  let successDays = 0;
  let zeroDays = 0;
  let totalCount = 0;
  let maxCount = 0;
  let maxCountDate = '';
  let maxStreak = 0;
  let currentStreak = 0;

  // 按星期统计
  const dayOfWeekStats: Record<string, { count: number; days: number }> = {};
  for (let i = 0; i < 7; i++) {
    dayOfWeekStats[i.toString()] = { count: 0, days: 0 };
  }

  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dateKey = formatDate(cursor);
    const status = dataMap.get(dateKey) ?? 0;
    const dow = cursor.getUTCDay().toString();
    dayOfWeekStats[dow].days += 1;

    if (status > 0) {
      successDays++;
      totalCount += status;
      dayOfWeekStats[dow].count += status;
      if (status > maxCount) {
        maxCount = status;
        maxCountDate = dateKey;
      }
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else {
      zeroDays++;
      currentStreak = 0;
    }
  }

  const avgPerDay = recordedDays > 0 ? totalCount / recordedDays : 0;
  const streakDays = maxStreak;

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
    const today = getUtc8Date();
    const reportTypes: ReportType[] = ['week', 'month', 'quarter', 'year'];
    const pendingReports: { type: ReportType; periodKey: string; label: string }[] = [];

    for (const type of reportTypes) {
      // 获取上一个周期（不是当前周期）
      const prevDate = new Date(today);
      switch (type) {
        case 'week':
          prevDate.setUTCDate(prevDate.getUTCDate() - 7);
          break;
        case 'month':
          prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
          break;
        case 'quarter':
          prevDate.setUTCMonth(prevDate.getUTCMonth() - 3);
          break;
        case 'year':
          prevDate.setUTCFullYear(prevDate.getUTCFullYear() - 1);
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
      SELECT config_key, config_value FROM ai_config
      WHERE config_key IN ('ai_endpoint', 'ai_api_key')
    `;
    const config: Record<string, string> = {};
    configRows.forEach(row => {
      config[row.config_key] = row.config_value;
    });
    const aiConfigured = !!(config['ai_endpoint'] && config['ai_api_key']);

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
    const { type, markViewed, periodOffset = 0, forceRefresh } = body as {
      type: ReportType;
      markViewed?: boolean;
      periodOffset?: number;
      forceRefresh?: boolean;
    };

    if (!['week', 'month', 'quarter', 'year'].includes(type)) {
      return NextResponse.json({ error: '无效的报告类型' }, { status: 400 });
    }

    // 根据periodOffset获取对应周期（0=当前周期，-1=上一周期）
    const today = getUtc8Date();
    const targetDate = new Date(today);
    switch (type) {
      case 'week':
        targetDate.setUTCDate(targetDate.getUTCDate() + periodOffset * 7);
        break;
      case 'month':
        targetDate.setUTCMonth(targetDate.getUTCMonth() + periodOffset);
        break;
      case 'quarter':
        targetDate.setUTCMonth(targetDate.getUTCMonth() + periodOffset * 3);
        break;
      case 'year':
        targetDate.setUTCFullYear(targetDate.getUTCFullYear() + periodOffset);
        break;
    }

    const period = getPeriodDates(type, targetDate);

    // 对于当前周期（periodOffset === 0），使用今天作为结束日期
    // 即使数据不完整也提交给AI分析
    let actualEndDate = period.end;
    let isPartialPeriod = false;
    if (periodOffset === 0) {
      const todayStr = formatDate(today);
      if (todayStr < period.end) {
        actualEndDate = todayStr;
        isPartialPeriod = true;
      }
    }
    // 计算实际数据天数（从开始到实际结束日期）
    const startDateObj = new Date(period.start);
    const actualEndDateObj = new Date(actualEndDate);
    const actualDataDays = Math.floor((actualEndDateObj.getTime() - startDateObj.getTime()) / 86400000) + 1;
    const periodEndDateObj = new Date(period.end);
    const fullPeriodDays = Math.floor((periodEndDateObj.getTime() - startDateObj.getTime()) / 86400000) + 1;

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

    // 获取当前周期和前3个周期的数据用于趋势分析
    const previousPeriods: { label: string; stats: ReturnType<typeof calculateStats> }[] = [];

    // 计算前3个周期的日期范围
    for (let i = 1; i <= 3; i++) {
      const prevDate = new Date(targetDate);
      switch (type) {
        case 'week':
          prevDate.setUTCDate(prevDate.getUTCDate() - i * 7);
          break;
        case 'month':
          prevDate.setUTCMonth(prevDate.getUTCMonth() - i);
          break;
        case 'quarter':
          prevDate.setUTCMonth(prevDate.getUTCMonth() - i * 3);
          break;
        case 'year':
          prevDate.setUTCFullYear(prevDate.getUTCFullYear() - i);
          break;
      }
      const prevPeriod = getPeriodDates(type, prevDate);

      const { rows: prevDataRows } = await sql`
        SELECT date_key, status FROM takeoff_logs
        WHERE user_id = ${user.id}
          AND date_key >= ${prevPeriod.start}
          AND date_key <= ${prevPeriod.end}
        ORDER BY date_key
      `;

      const prevStats = calculateStats(prevDataRows as { date_key: string; status: number }[], prevPeriod.start, prevPeriod.end);
      previousPeriods.push({ label: prevPeriod.label, stats: prevStats });
    }

    // 获取当前周期用户数据（使用actualEndDate）
    const { rows: dataRows } = await sql`
      SELECT date_key, status FROM takeoff_logs
      WHERE user_id = ${user.id}
        AND date_key >= ${period.start}
        AND date_key <= ${actualEndDate}
      ORDER BY date_key
    `;

    // 计算当前周期统计（使用actualEndDate）
    const stats = calculateStats(dataRows as { date_key: string; status: number }[], period.start, actualEndDate);

    // 如果没有数据，返回提示
    if (dataRows.length === 0) {
      const partialNote = isPartialPeriod ? `（截至 ${actualEndDate}）` : '';
      const emptyReport = `## ${period.label} 起飞报告

${partialNote}这个周期内暂无记录数据。

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

    // 生成 UTC+8 时区的 ISO 格式当前时间
    const now = new Date();
    const utc8Time = new Date(now.getTime() + UTC8_OFFSET_MS + now.getTimezoneOffset() * 60 * 1000);
    const currentIsoTime = utc8Time.toISOString().replace('Z', '+08:00');

    // 生成提示词（包含趋势数据和部分周期信息）
    const refreshToken = forceRefresh ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : undefined;
    const userPrompt = generateReportAnalysisPrompt(
      type,
      period.label,
      stats,
      previousPeriods,
      currentIsoTime,
      isPartialPeriod ? { actualDataDays, fullPeriodDays } : undefined,
      refreshToken
    );

    // 调用AI
    const endpoint = buildChatCompletionsEndpoint(config['ai_endpoint']);

    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 45000);

    let aiResponse: Response;
    try {
      aiResponse = await fetch(endpoint, {
        method: 'POST',
        cache: 'no-store',
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
        }),
        signal: aiController.signal
      });
    } catch (error) {
      clearTimeout(aiTimeout);
      if ((error as DOMException)?.name === 'AbortError') {
        return NextResponse.json({ error: 'AI 响应超时，请稍后重试' }, { status: 504 });
      }
      throw error;
    } finally {
      clearTimeout(aiTimeout);
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI 请求失败:', aiResponse.status, errorText);
      return NextResponse.json({
        error: `AI 服务请求失败 (${aiResponse.status}): ${errorText.slice(0, 200)}`
      }, { status: 500 });
    }

    let aiData: { choices?: { message?: { content?: string } }[] } | null = null;
    try {
      aiData = await aiResponse.json();
    } catch (error) {
      console.error('AI 响应解析失败:', error);
      return NextResponse.json({ error: 'AI 返回格式异常，请稍后再试' }, { status: 502 });
    }
    const analysis = aiData.choices?.[0]?.message?.content?.trim();
    const statsMarkdown = buildStatsMarkdown(
      period.label,
      stats,
      isPartialPeriod ? { actualDataDays, fullPeriodDays } : undefined
    );
    const report = analysis ? `${statsMarkdown}\n\n${analysis}` : statsMarkdown;

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

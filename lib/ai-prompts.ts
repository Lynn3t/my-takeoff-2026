// AI 起飞报告系统提示词

export const TAKEOFF_REPORT_SYSTEM_PROMPT = `你是一位风趣幽默的私人健康顾问，专门分析用户的"起飞"数据。

## 时间与日历
- 使用 ISO 8601 日历标准（周一为一周的开始，第一周是包含该年第一个周四的那一周）
- 时区固定为 UTC+8（北京时间/中国标准时间）
- 用户数据中会提供当前日期与时间，请据此判断时间相关的分析

## 背景知识
- "起飞"是自慰/手淫的委婉说法
- 用户使用"起飞记录仪"APP追踪自己的性健康数据
- 数据中：0=当天未起飞，1-5=当天起飞次数

## 你的任务
根据提供的统计数据，生成一份专业但轻松的健康报告。

## 报告风格要求
1. 语气：像一位懂你的老朋友，幽默但不低俗，关心但不说教
2. 用词：可以用"起飞"、"冲刺"、"放松"等委婉词，避免直白粗俗用语
3. 态度：正面看待这是正常的生理需求，不做道德评判
4. 结构：简洁有力，重点突出

## 报告内容框架
1. **数据概览**：用趣味方式总结关键数字
2. **模式分析**：发现有趣的规律（如周几更活跃、是否有连续记录等）
3. **健康建议**：基于数据给出1-2条实用建议
4. **鼓励语**：用轻松的方式结尾

## 健康知识参考
- 适度的自慰是正常且健康的
- 一般建议每周1-3次较为适宜，但个体差异大
- 过度可能导致疲劳、影响日常生活
- 长期禁欲也不一定健康，适度释放有助于身心平衡

## 输出格式
- 使用 Markdown 格式
- 保持简洁，300字以内
- 可以适当使用emoji增加趣味性

请记住：你的目标是让用户既了解自己的数据，又能会心一笑，同时获得有价值的健康提示。`;

// 生成用户数据提示词
export function generateUserDataPrompt(
  periodType: 'week' | 'month' | 'quarter' | 'year',
  periodLabel: string,
  stats: {
    totalDays: number;
    recordedDays: number;
    totalCount: number;
    successDays: number;
    zeroDays: number;
    avgPerDay: number;
    maxCount: number;
    maxCountDate: string;
    streakDays: number;
    dayOfWeekStats: Record<string, { count: number; days: number }>;
  },
  previousPeriods?: { label: string; stats: typeof stats }[],
  currentIsoTime?: string,
  partialPeriodInfo?: { actualDataDays: number; fullPeriodDays: number }
) {
  const periodNames = {
    week: '周度',
    month: '月度',
    quarter: '季度',
    year: '年度'
  };

  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  // 找出最活跃的星期
  let mostActiveDay = '';
  let mostActiveCount = 0;
  Object.entries(stats.dayOfWeekStats).forEach(([day, data]) => {
    if (data.count > mostActiveCount) {
      mostActiveCount = data.count;
      mostActiveDay = dayNames[parseInt(day)];
    }
  });

  // 部分周期提示
  const partialPeriodNote = partialPeriodInfo
    ? `\n**注意：本期数据尚不完整，目前只有 ${partialPeriodInfo.actualDataDays} 天的数据（完整周期为 ${partialPeriodInfo.fullPeriodDays} 天）。请基于现有数据进行分析，并提醒用户这是截至目前的统计。**\n`
    : '';

  return `## ${periodNames[periodType]}报告 - ${periodLabel}
当前时间：${currentIsoTime || '未提供'}
${partialPeriodNote}
### 统计数据
- 统计天数（含未记录视为0）：${stats.recordedDays} 天
- 起飞总次数：${stats.totalCount} 次
- 成功起飞天数：${stats.successDays} 天
- 归零天数：${stats.zeroDays} 天
- 日均次数：${stats.avgPerDay.toFixed(2)} 次
- 单日最高：${stats.maxCount} 次（${stats.maxCountDate}）
- 当前连续记录：${stats.streakDays} 天
- 最活跃的日子：${mostActiveDay}（共 ${mostActiveCount} 次）

### 按星期统计
${Object.entries(stats.dayOfWeekStats)
  .map(([day, data]) => `- ${dayNames[parseInt(day)]}：${data.count} 次，${data.days} 天`)
  .join('\n')}
${previousPeriods && previousPeriods.length > 0 ? `
### 历史趋势（用于对比分析）
${previousPeriods.map(p => `
**${p.label}**
- 起飞总次数：${p.stats.totalCount} 次
- 日均次数：${p.stats.avgPerDay.toFixed(2)} 次
- 成功天数：${p.stats.successDays} 天
- 归零天数：${p.stats.zeroDays} 天`).join('\n')}

请结合历史数据分析趋势变化（是上升、下降还是稳定），并给出相应建议。
` : ''}
请根据以上数据生成${periodNames[periodType]}起飞报告。`;
}

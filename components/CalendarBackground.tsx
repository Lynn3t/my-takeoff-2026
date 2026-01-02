'use client';

import { memo, useMemo } from 'react';

const MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"] as const;

// 静态日历背景组件 - 用于登录页面等场景
const CalendarBackground = memo(function CalendarBackground() {
  const year = 2026;

  // 预计算日历数据
  const calendarData = useMemo(() => {
    return MONTHS.map((name, index) => {
      const daysInMonth = new Date(year, index + 1, 0).getDate();
      const firstDay = new Date(year, index, 1).getDay();

      const days = Array.from({ length: daysInMonth }).map((_, i) => {
        const d = i + 1;
        // 随机生成一些模拟数据用于视觉效果
        const hasData = Math.random() > 0.6;
        const status = hasData ? Math.floor(Math.random() * 5) + 1 : 0;
        return { d, status };
      });

      return { name, firstDay, days };
    });
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">
      <div className="absolute inset-0 bg-gray-900">
        <div className="absolute inset-0 flex items-center justify-center p-4 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 w-full max-w-6xl opacity-30 blur-[1px]">
            {calendarData.map(({ name, firstDay, days }) => (
              <div key={name} className="bg-gray-800 p-3 rounded-lg">
                <h3 className="text-center font-bold mb-2 text-xs text-gray-400">
                  {name}
                </h3>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {days.map(({ d, status }) => (
                    <div
                      key={d}
                      className={`aspect-square flex items-center justify-center text-[8px] rounded ${
                        status > 0
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-500'
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default CalendarBackground;

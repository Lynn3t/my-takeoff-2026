'use client';
import { useState, useEffect, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReportModal from '@/components/ReportModal';

// 骨架屏组件 - 日历月份
const CalendarSkeleton = memo(function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="h-6 bg-gray-200 rounded w-16 mx-auto mb-2 animate-pulse" />
          <div className="grid grid-cols-7 gap-1 mb-2">
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="h-3 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, j) => (
              <div key={j} className="aspect-square bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

// 用户信息栏骨架屏
const UserBarSkeleton = memo(function UserBarSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
    </div>
  );
});

// 日期单元格组件 - 使用 memo 避免不必要的重渲染
interface DayCellProps {
  dateKey: string;
  dayOfYear: number;
  day: number;
  text: string;
  className: string;
  onToggle: (dateKey: string) => void;
}

const DayCell = memo(function DayCell({ dateKey, dayOfYear, day, text, className, onToggle }: DayCellProps) {
  return (
    <div
      onClick={() => onToggle(dateKey)}
      className={`aspect-square flex flex-col items-center justify-center text-sm rounded cursor-pointer transition-all hover:scale-105 select-none ${className}`}
    >
      <span className="text-[8px] opacity-60 leading-none">{dayOfYear}</span>
      <span className="leading-none">{text || day}</span>
    </div>
  );
});

// 月份名称常量 - 避免每次渲染重新创建
const MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"] as const;

// 定义数据类型：key是日期字符串，value是数字状态
type DataMap = Record<string, number>;

type ReportType = 'week' | 'month' | 'quarter' | 'year';

interface PendingReport {
  type: ReportType;
  periodKey: string;
  label: string;
}

interface CurrentUser {
  id: number;
  username: string;
  is_admin: boolean;
}

export default function Home() {
  const router = useRouter();
  const [dataMap, setDataMap] = useState<DataMap>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const year = 2026;

  const getTodayString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset); 
    return local.toISOString().split('T')[0];
  };

  const todayKey = getTodayString();

  useEffect(() => {
    // 获取当前用户信息
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setCurrentUser(data.user);
        }
      });

    fetch('/api')
      .then(res => res.json())
      .then(json => {
        if (json.data) setDataMap(json.data);
        setLoading(false);
      });

    // 检查是否有未查看的报告
    fetch('/api/ai-report')
      .then(res => res.json())
      .then(data => {
        if (data.pendingReports && data.pendingReports.length > 0 && data.aiConfigured) {
          setPendingReports(data.pendingReports);
          setAiConfigured(data.aiConfigured);
          // 自动弹出报告提示
          setShowReportModal(true);
        }
      })
      .catch(() => {
        // 忽略错误（可能是表还未创建）
      });
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  const toggleDay = async (dateKey: string) => {
    const currentStatus = dataMap[dateKey];
    let nextStatus: number | null;

    // 未来日期：将数据置为空而非提交数值
    if (dateKey > todayKey) {
      nextStatus = null;
    }
    // 逻辑: undefined -> 1 -> 2 -> 3 -> 4 -> 5 -> 0(红) -> undefined
    else if (currentStatus === undefined || currentStatus === null) {
      nextStatus = 1;
    } else if (currentStatus >= 1 && currentStatus < 5) {
      nextStatus = currentStatus + 1;
    } else if (currentStatus === 5) {
      nextStatus = 0;
    } else {
      nextStatus = null;
    }

    const newData = { ...dataMap };
    if (nextStatus === null) {
      delete newData[dateKey];
    } else {
      newData[dateKey] = nextStatus;
    }
    setDataMap(newData);

    try {
      await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date: dateKey, 
          status: nextStatus, 
          isDelete: nextStatus === null 
        })
      });
    } catch (e) {
      console.error("保存失败", e);
    }
  };

  // 获取显示逻辑（复用于 UI 和 CSV 导出）
  const getDayStatus = (dateKey: string) => {
    const dbValue = dataMap[dateKey];
    
    // 1. 数据库有记录
    if (dbValue !== undefined && dbValue !== null) {
      if (dbValue === 0) return { val: 0, text: "0", label: "未起飞", className: "bg-red-500 text-white" }; 
      return { val: dbValue, text: dbValue.toString(), label: "起飞", className: "bg-green-500 text-white font-bold" };
    }

    // 2. 过期自动补零
    if (dateKey < todayKey) {
      return { val: 0, text: "0", label: "未起飞(自动)", className: "bg-red-500 text-white opacity-60" };
    }

    // 3. 待定
    return { val: null, text: "", label: "待定", className: "bg-gray-200" };
  };

  // === 新增：导出 CSV 功能 ===
  const downloadCSV = () => {
    // 表头
    const rows = [["日期", "次数", "状态"]];
    
    // 遍历 2026 全年
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const info = getDayStatus(dateKey);
        
        // 只有过去的日期或有记录的日期才导出数字，未来的空日期留空
        let countStr = "";
        if (info.val !== null) countStr = info.val.toString();
        
        rows.push([dateKey, countStr, info.label]);
      }
    }

    // 加上 BOM (\uFEFF) 解决 Excel 打开中文乱码问题
    const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `2026起飞记录_${todayKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 预计算日历数据 - 避免每次渲染重复计算
  const calendarData = useMemo(() => {
    const startOfYear = new Date(year, 0, 1);

    return MONTHS.map((name, index) => {
      const daysInMonth = new Date(year, index + 1, 0).getDate();
      const firstDay = new Date(year, index, 1).getDay();

      const days = Array.from({ length: daysInMonth }).map((_, i) => {
        const d = i + 1;
        const dateKey = `${year}-${String(index + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const currentDate = new Date(year, index, d);
        const dayOfYear = Math.floor((currentDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        return { d, dateKey, dayOfYear };
      });

      return { name, index, firstDay, days };
    });
  }, [year]);

  const renderCalendar = () => {
    return calendarData.map(({ name, firstDay, days }) => {
      return (
        <div key={name} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-center font-bold mb-2 border-b pb-2 text-gray-700">
            {name}
          </h3>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
            <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(({ d, dateKey, dayOfYear }) => {
              const { text, className } = getDayStatus(dateKey);
              return (
                <DayCell
                  key={dateKey}
                  dateKey={dateKey}
                  dayOfYear={dayOfYear}
                  day={d}
                  text={text}
                  className={className}
                  onToggle={toggleDay}
                />
              );
            })}
          </div>
        </div>
      );
    });
  };

  const dbValues = Object.values(dataMap);
  const totalCount = dbValues.reduce((acc, v) => (v > 0 ? acc + v : acc), 0);
  const successDays = dbValues.filter(v => v > 0).length;

  // 计算2026年已过天数
  const getPassedDays = () => {
    const today = new Date(todayKey);
    const startOfYear = new Date(year, 0, 1);
    // 如果今天不在2026年，返回0或365
    if (today < startOfYear) return 0;
    const endOfYear = new Date(year, 11, 31);
    if (today > endOfYear) return 365;
    return Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };
  const passedDays = getPassedDays();
  const successRate = passedDays > 0 ? ((successDays / passedDays) * 100).toFixed(1) : '0';
  const avgPerDay = passedDays > 0 ? (totalCount / passedDays).toFixed(2) : '0';

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
      {/* 用户信息栏 */}
      <div className="w-full max-w-6xl flex justify-end items-center gap-4 mb-4 min-h-[24px]">
        {currentUser === null && loading ? (
          <UserBarSkeleton />
        ) : currentUser ? (
          <>
            <span className="text-sm text-gray-600">
              {currentUser.username}
              {currentUser.is_admin && <span className="ml-1 text-purple-600">(管理员)</span>}
            </span>
            {currentUser.is_admin && (
              <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-700">
                用户管理
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-700"
            >
              退出登录
            </button>
          </>
        ) : null}
      </div>

      <h1 className="text-2xl font-bold mb-4 text-gray-800">2026 起飞记录仪</h1>
      
      <div className="flex flex-wrap items-center justify-center gap-4 mb-8 bg-white p-3 rounded-xl shadow-sm px-6">
        <div className="flex gap-4 text-sm font-medium border-r pr-4 mr-2">
            <span className="text-green-600">起飞天数: {successDays}天 / {passedDays}天 - {successRate}%</span>
            <span className="text-blue-600">起飞次数: {totalCount}</span>
            <span className="text-purple-600">平均每天: {avgPerDay}次</span>
        </div>
        
        {/* 导出按钮 */}
        <button
            onClick={downloadCSV}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-full transition-colors font-medium flex items-center gap-1"
        >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            导出 CSV
        </button>

        {/* AI 报告按钮 */}
        {aiConfigured && (
          <button
              onClick={() => setShowReportModal(true)}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-full transition-colors font-medium flex items-center gap-1"
          >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              AI 报告
              {pendingReports.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">
                  {pendingReports.length}
                </span>
              )}
          </button>
        )}
      </div>

      {loading ? (
        <CalendarSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl">
          {renderCalendar()}
        </div>
      )}

      {/* AI 报告弹窗 */}
      {showReportModal && pendingReports.length > 0 && (
        <ReportModal
          pendingReports={pendingReports}
          onClose={() => {
            setShowReportModal(false);
            setPendingReports([]);
          }}
        />
      )}
    </main>
  );
}
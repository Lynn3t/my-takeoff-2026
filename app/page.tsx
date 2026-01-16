'use client';
import { useState, useEffect, useMemo, memo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReportModal from '@/components/ReportModal';

// 离线状态指示器组件
const OfflineIndicator = memo(function OfflineIndicator({
  isOnline,
  pendingCount,
  isSyncing,
  onManualSync,
  isAuthenticated
}: {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onManualSync: () => void;
  isAuthenticated: boolean | null;
}) {
  // 未登录时不显示（本地模式由顶部栏显示）
  if (isAuthenticated === false) return null;
  // 已登录且在线且无待同步时不显示
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm z-50 ${
      isOnline ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
    }`}>
      {!isOnline && (
        <>
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span>离线模式</span>
        </>
      )}
      {pendingCount > 0 && (
        <>
          <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
            {pendingCount} 条待同步
          </span>
          {isOnline && !isSyncing && (
            <button
              onClick={onManualSync}
              className="text-blue-600 hover:text-blue-700 underline text-xs"
            >
              立即同步
            </button>
          )}
          {isSyncing && (
            <span className="text-xs text-gray-600">同步中...</span>
          )}
        </>
      )}
    </div>
  );
});

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

// 安装提示组件 - 根据设备类型显示不同内容
type InstallPromptType = 'none' | 'android' | 'ios';

const InstallPrompt = memo(function InstallPrompt() {
  const [promptType] = useState<InstallPromptType>(() => {
    if (typeof window === 'undefined') return 'none';
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isMobile = isAndroid || isIOS;

    // 检测是否在 standalone 模式（PWA/TWA/已安装的 APK）
    const isStandalone = (window.matchMedia?.('(display-mode: standalone)').matches ?? false)
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    // 电脑或已安装的应用：不显示
    if (!isMobile || isStandalone) {
      return 'none';
    }

    // 安卓浏览器：显示下载 APK
    if (isAndroid) {
      return 'android';
    }

    // iOS 浏览器：显示添加到主屏幕
    if (isIOS) {
      return 'ios';
    }

    return 'none';
  });

  if (promptType === 'none') return null;

  if (promptType === 'android') {
    return (
      <a
        href="/FC26.apk"
        download="FC26.apk"
        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-full transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        安装 App
      </a>
    );
  }

  if (promptType === 'ios') {
    return (
      <button
        onClick={() => alert('点击底部分享按钮 → 选择"添加到主屏幕"')}
        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-full transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0-12L8 8m4-4l4 4M6 20h12" />
        </svg>
        添加到主屏幕
      </button>
    );
  }

  return null;
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

// 本地存储 key
const LOCAL_STORAGE_KEY = 'takeoff_local_data';

// 定义数据类型：key是日期字符串，value是数字状态
type DataMap = Record<string, number>;

// 本地存储工具函数
const loadLocalData = (): DataMap => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const saveLocalData = (data: DataMap) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('本地存储失败', e);
  }
};

interface CurrentUser {
  id: number;
  username: string;
  is_admin: boolean;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLocalMode = searchParams.get('local') === 'true';
  const [dataMap, setDataMap] = useState<DataMap>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null=未知, true=已登录, false=未登录
  const [showReportModal, setShowReportModal] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [todayKey] = useState<string>(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
  });
  const year = 2026;

  useEffect(() => {
    // 获取当前用户信息
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setCurrentUser(data.user);
          setIsAuthenticated(true);
        } else if (isLocalMode) {
          // 用户选择了本地模式
          setIsAuthenticated(false);
        } else {
          // 未登录且非本地模式：跳转到登录页面
          router.push('/login');
        }
      })
      .catch(() => {
        if (isLocalMode) {
          // 网络错误但用户选择了本地模式
          setIsAuthenticated(false);
        } else {
          // 网络错误：跳转到登录页面
          router.push('/login');
        }
      });

    // 获取数据 - 根据登录状态决定数据来源
    fetch('/api')
      .then(res => res.json())
      .then(async (json) => {
        if (json.authenticated === false) {
          // 未登录：使用本地存储
          setIsAuthenticated(false);
          const localData = loadLocalData();
          setDataMap(localData);
        } else if (json.data) {
          // 已登录：合并云端和本地数据（云端优先）
          const cloudData = json.data as DataMap;
          const localData = loadLocalData();

          // 找出本地独有的数据（云端没有的）
          const localOnlyEntries: Array<{ date: string; status: number }> = [];
          for (const [dateKey, status] of Object.entries(localData)) {
            if (!(dateKey in cloudData)) {
              localOnlyEntries.push({ date: dateKey, status });
            }
          }

          // 合并数据：云端 + 本地独有
          const mergedData = { ...localData, ...cloudData }; // 云端覆盖本地
          setDataMap(mergedData);

          // 将本地独有数据上传到云端
          if (localOnlyEntries.length > 0) {
            console.log(`[Sync] 发现 ${localOnlyEntries.length} 条本地数据需要上传`);
            for (const entry of localOnlyEntries) {
              try {
                await fetch('/api', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    date: entry.date,
                    status: entry.status,
                    isDelete: false
                  })
                });
              } catch (e) {
                console.error(`[Sync] 上传失败: ${entry.date}`, e);
              }
            }
            console.log('[Sync] 本地数据上传完成');
          }

          // 清空本地存储（已合并到云端）
          if (Object.keys(localData).length > 0) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            console.log('[Sync] 本地缓存已清空');
          }
        }
        setLoading(false);
      })
      .catch(() => {
        // 网络错误：使用本地存储
        const localData = loadLocalData();
        setDataMap(localData);
        setLoading(false);
      });

    // 检查 AI 是否已配置（仅登录用户）
    fetch('/api/ai-config', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const configured = typeof data.configured === 'boolean'
          ? data.configured
          : Boolean(data.config?.ai_endpoint && data.config?.has_api_key);
        setAiConfigured(!!configured);
      })
      .catch(() => {
        // 忽略错误（可能是表还未创建或未登录）
      });
  }, [isLocalMode, router]);

  // 离线状态管理
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // 在线后请求同步
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'MANUAL_SYNC' });
        setIsSyncing(true);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // 监听 Service Worker 消息
    const handleSWMessage = (event: MessageEvent) => {
      const { data } = event;

      if (data.type === 'OFFLINE_SAVED') {
        setPendingSyncCount(prev => prev + 1);
      }

      if (data.type === 'SYNC_COMPLETE' || data.type === 'MANUAL_SYNC_COMPLETE') {
        setPendingSyncCount(data.remaining || 0);
        setIsSyncing(false);
        // 同步完成后刷新数据
        if (data.synced > 0) {
          fetch('/api')
            .then(res => res.json())
            .then(json => {
              if (json.data) setDataMap(json.data);
            });
        }
      }

      if (data.type === 'PENDING_COUNT') {
        setPendingSyncCount(data.count);
      }
    };

    // 获取初始待同步数量
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'GET_PENDING_COUNT' });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }, []);

  // 手动同步函数
  const handleManualSync = useCallback(() => {
    if (navigator.serviceWorker.controller && isOnline) {
      navigator.serviceWorker.controller.postMessage({ type: 'MANUAL_SYNC' });
      setIsSyncing(true);
    }
  }, [isOnline]);

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

    // 未登录时：只保存到本地
    if (isAuthenticated === false) {
      saveLocalData(newData);
      return;
    }

    // 已登录时：保存到云端
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

  // 计算2026年已过天数（过期无数据的也算0，计入统计）
  const getPassedDays = () => {
    if (!todayKey) return 0;
    // 解析日期字符串，避免时区问题
    const [y, m, d] = todayKey.split('-').map(Number);
    if (y < year) return 0;
    if (y > year) return 365;
    // 使用本地时间创建日期对象
    const today = new Date(y, m - 1, d);
    const startOfYear = new Date(year, 0, 1);
    return Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };
  const recordedDays = getPassedDays(); // 到今天为止的天数都视为有记录（无数据=0）

  const successRate = recordedDays > 0 ? ((successDays / recordedDays) * 100).toFixed(1) : '0';
  const avgPerDay = recordedDays > 0 ? (totalCount / recordedDays).toFixed(2) : '0';

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
      {/* 用户信息栏 */}
      <div className="w-full max-w-6xl flex justify-end items-center gap-4 mb-4 min-h-[24px]">
        {isAuthenticated === null && loading ? (
          <UserBarSkeleton />
        ) : isAuthenticated === false ? (
          // 未登录：本地模式
          <>
            <span className="text-sm text-orange-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              本地模式
            </span>
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              登录同步
            </Link>
            <InstallPrompt />
          </>
        ) : currentUser ? (
          // 已登录
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
            <InstallPrompt />
          </>
        ) : null}
      </div>

      <h1 className="text-2xl font-bold mb-4 text-gray-800">2026 起飞记录仪</h1>

      <div className="flex flex-wrap items-center justify-center gap-4 mb-8 bg-white p-3 rounded-xl shadow-sm px-6">
        <div className="flex gap-4 text-sm font-medium border-r pr-4 mr-2">
            <span className="text-green-600">起飞天数: {successDays}天 / {recordedDays}天 - {successRate}%</span>
            <span className="text-blue-600">起飞次数: {totalCount}</span>
            <span className="text-purple-600">平均每天: {avgPerDay}次</span>
        </div>
        
        {/* 导出按钮 */}
        <button
            onClick={downloadCSV}
            className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white text-xs rounded-full transition-all font-medium flex items-center gap-1 btn-press"
        >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            导出 CSV
        </button>

        {/* AI 报告按钮 */}
        {aiConfigured && (
          <button
              onClick={() => setShowReportModal(true)}
              className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white text-xs rounded-full transition-all font-medium flex items-center gap-1 btn-press"
          >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              AI 报告
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
      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* 离线状态指示器 */}
      <OfflineIndicator
        isOnline={isOnline}
        pendingCount={pendingSyncCount}
        isSyncing={isSyncing}
        onManualSync={handleManualSync}
        isAuthenticated={isAuthenticated}
      />
    </main>
  );
}

// 加载骨架屏
function HomeLoading() {
  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl flex justify-end items-center gap-4 mb-4 min-h-[24px]">
        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
      </div>
      <h1 className="text-2xl font-bold mb-4 text-gray-800">2026 起飞记录仪</h1>
      <div className="flex flex-wrap items-center justify-center gap-4 mb-8 bg-white p-3 rounded-xl shadow-sm px-6">
        <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
      </div>
      <CalendarSkeleton />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}

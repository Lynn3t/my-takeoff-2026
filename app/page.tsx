'use client';
import { useState, useEffect } from 'react';

// 定义数据类型：key是日期字符串，value是数字状态
type DataMap = Record<string, number>;

export default function Home() {
  const [dataMap, setDataMap] = useState<DataMap>({});
  const [loading, setLoading] = useState(true);
  const year = 2026;

  const getTodayString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset); 
    return local.toISOString().split('T')[0];
  };

  const todayKey = getTodayString();

  useEffect(() => {
    fetch('/api')
      .then(res => res.json())
      .then(json => {
        if (json.data) setDataMap(json.data);
        setLoading(false);
      });
  }, []);

  const toggleDay = async (dateKey: string) => {
    const currentStatus = dataMap[dateKey]; 
    let nextStatus: number | null;
    
    // 逻辑: undefined -> 1 -> 2 -> 3 -> 4 -> 5 -> 0(红) -> undefined
    if (currentStatus === undefined || currentStatus === null) {
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

  const renderCalendar = () => {
    const months = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    
    return months.map((name, index) => {
      const daysInMonth = new Date(year, index + 1, 0).getDate();
      const firstDay = new Date(year, index, 1).getDay();
      
      return (
        <div key={name} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-center font-bold mb-2 border-b pb-2 text-gray-700">{name}</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
            <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const dateKey = `${year}-${String(index + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              
              const { text, className } = getDayStatus(dateKey);

              return (
                <div 
                  key={dateKey}
                  onClick={() => toggleDay(dateKey)}
                  className={`aspect-square flex items-center justify-center text-sm rounded cursor-pointer transition-all hover:scale-105 select-none ${className}`}
                >
                  {text || d}
                </div>
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
  const recordedFails = dbValues.filter(v => v === 0).length;

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">2026 起飞记录仪 🚀</h1>
      
      <div className="flex flex-wrap items-center justify-center gap-4 mb-8 bg-white p-3 rounded-xl shadow-sm px-6">
        <div className="flex gap-4 text-sm font-medium border-r pr-4 mr-2">
            <span className="text-green-600">总起飞: {totalCount} 次</span>
            <span className="text-green-600">天数: {successDays}</span>
            <span className="text-red-500">归零: {recordedFails}</span>
        </div>
        
        {/* 导出按钮 */}
        <button 
            onClick={downloadCSV}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-full transition-colors font-medium flex items-center gap-1"
        >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            导出 CSV
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 animate-pulse">数据加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl">
          {renderCalendar()}
        </div>
      )}
    </main>
  );
}
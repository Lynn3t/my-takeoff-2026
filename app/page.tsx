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

  // 这里加上了 : string 类型注解
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

  const getDisplayInfo = (dateKey: string) => {
    const dbValue = dataMap[dateKey];
    
    if (dbValue !== undefined && dbValue !== null) {
      if (dbValue === 0) return { text: "0", className: "bg-red-500 text-white" }; 
      return { text: dbValue, className: "bg-green-500 text-white font-bold" };
    }

    if (dateKey < todayKey) {
      return { text: "0", className: "bg-red-500 text-white opacity-60" };
    }

    return { text: "", className: "bg-gray-200" };
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
              
              // @ts-ignore
              const { text, className } = getDisplayInfo(dateKey);

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
      
      <div className="flex gap-4 mb-8 text-sm font-medium bg-white p-3 rounded-full shadow-sm px-6">
        <span className="text-green-600">总起飞: {totalCount} 次</span>
        <span className="text-green-600">起飞天数: {successDays}</span>
        <span className="text-red-500">归零天数: {recordedFails} (记录)</span>
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
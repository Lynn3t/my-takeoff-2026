'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [dataMap, setDataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const year = 2026;

  // 获取今天的日期字符串 (用于判断是否过期)
  const getTodayString = () => {
    const d = new Date();
    // 调整为中国时区或其他你需要的逻辑
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset); 
    return local.toISOString().split('T')[0];
  };

  const todayKey = getTodayString();

  // 初始化加载数据
  useEffect(() => {
    fetch('/api')
      .then(res => res.json())
      .then(json => {
        if (json.data) setDataMap(json.data);
        setLoading(false);
      });
  }, []);

  // 点击切换状态逻辑
  const toggleDay = async (dateKey) => {
    // 获取当前数据库里的真实状态（不包含自动补零的视觉状态）
    const currentStatus = dataMap[dateKey]; 

    let nextStatus;
    
    // 逻辑: undefined(空) -> 1 -> 2 -> 3 -> 4 -> 5 -> 0(红) -> undefined(重置)
    if (currentStatus === undefined || currentStatus === null) {
      nextStatus = 1;
    } else if (currentStatus >= 1 && currentStatus < 5) {
      nextStatus = currentStatus + 1;
    } else if (currentStatus === 5) {
      nextStatus = 0; // 封顶后变红
    } else {
      nextStatus = null; // 0 之后重置为空，方便纠错
    }

    // 1. 乐观更新 UI
    const newData = { ...dataMap };
    if (nextStatus === null) {
      delete newData[dateKey]; // 删除数据
    } else {
      newData[dateKey] = nextStatus;
    }
    setDataMap(newData);

    // 2. 后台保存
    try {
      await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date: dateKey, 
          status: nextStatus, // 发送 null 会触发 API 删除或置空逻辑
          isDelete: nextStatus === null 
        })
      });
    } catch (e) {
      console.error("保存失败", e);
      // 可以在这里加个 toast 提示
    }
  };

  // 计算某个日期的显示状态（含自动补零逻辑）
  const getDisplayInfo = (dateKey) => {
    const dbValue = dataMap[dateKey];
    
    // 1. 如果数据库有记录 (0-5)，直接用
    if (dbValue !== undefined && dbValue !== null) {
      if (dbValue === 0) return { text: "0", className: "bg-red-500 text-white" }; // 失败
      return { text: dbValue, className: "bg-green-500 text-white font-bold" };   // 起飞 N 次
    }

    // 2. 如果数据库没记录，但日期已过 (自动变红 0)
    if (dateKey < todayKey) {
      return { text: "0", className: "bg-red-500 text-white opacity-60" }; // 过期自动变红(稍微淡一点区分)
    }

    // 3. 未来或今天，且没记录 (灰色待定)
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

  // 统计逻辑
  let totalCount = 0; // 总起飞次数
  let failDays = 0;   // 0次的天数（含自动补齐）
  let successDays = 0; // 有起飞的天数

  // 遍历每一天来统计（因为涉及到自动补零，不能只遍历 database）
  // 简单起见，我们这里只统计数据库里的，或者你可以写个循环遍历到今天
  // 这里展示：仅统计数据库已有记录 + 过期未记录的算作失败
  // 简易版统计（只统计显性数据）：
  const dbValues = Object.values(dataMap);
  totalCount = dbValues.reduce((acc, v) => (v > 0 ? acc + v : acc), 0);
  successDays = dbValues.filter(v => v > 0).length;
  // 失败天数 = 数据库里的0 + (今天之前的总天数 - 数据库里有记录的天数)
  // 这个计算比较繁琐，暂且只显示数据库记录的 0
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
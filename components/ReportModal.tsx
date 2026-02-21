'use client';

import { useState, useEffect, ReactElement, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

type ReportType = 'week' | 'month' | 'quarter' | 'year';

interface ReportModalProps {
  onClose: () => void;
  refreshKey: number;
}

interface ReportStats {
  avgPerDay: number;
  totalDays: number;
  recordedDays: number;
  totalCount: number;
  successDays: number;
  zeroDays: number;
  maxCount: number;
  maxCountDate: string;
  streakDays: number;
  dayOfWeekStats: Record<string, { count: number; days: number }>;
}

interface ReportDebugInfo {
  type?: ReportType;
  period?: string;
  periodKey?: string;
  periodOffset?: number;
  targetDate?: string;
  actualEndDate?: string;
  isPartialPeriod?: boolean;
  refreshToken?: string;
  aiModel?: string;
  userPrompt?: string;
  analysis?: string;
  stats?: ReportStats;
  previousPeriods?: Array<{
    label: string;
    totalCount: number;
    avgPerDay: number;
    successDays: number;
    zeroDays: number;
  }>;
}

const reportTypes: { type: ReportType; label: string }[] = [
  { type: 'week', label: '周报' },
  { type: 'month', label: '月报' },
  { type: 'quarter', label: '季报' },
  { type: 'year', label: '年报' }
];

// 获取 UTC+8 今天的日期
function getUtc8Today(): Date {
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth(), utc8.getUTCDate()));
}

// 根据类型和偏移量计算周期标签（与后端逻辑一致）
function getPeriodLabel(type: ReportType, offset: number): string {
  const date = getUtc8Today();

  switch (type) {
    case 'week': {
      date.setUTCDate(date.getUTCDate() + offset * 7);
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getUTCFullYear()}年第${week}周`;
    }
    case 'month': {
      date.setUTCMonth(date.getUTCMonth() + offset);
      return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
    }
    case 'quarter': {
      date.setUTCMonth(date.getUTCMonth() + offset * 3);
      const q = Math.floor(date.getUTCMonth() / 3) + 1;
      return `${date.getUTCFullYear()}年Q${q}`;
    }
    case 'year': {
      date.setUTCFullYear(date.getUTCFullYear() + offset);
      return `${date.getUTCFullYear()}年`;
    }
  }
}

// 生成周期下拉选项列表
function getPeriodOptions(type: ReportType): { offset: number; label: string }[] {
  const counts: Record<ReportType, number> = { week: 12, month: 12, quarter: 8, year: 3 };
  const count = counts[type];
  const options: { offset: number; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    options.push({ offset: -i, label: getPeriodLabel(type, -i) });
  }
  return options;
}

// 根据日均次数获取音乐配置
function getMusicConfig(avgPerDay: number): { file: string; startTime: number } {
  if (avgPerDay < 0.3) {
    return { file: '/110.mp3', startTime: 70 }; // 1:10
  } else if (avgPerDay <= 0.7) {
    return { file: '/010.mp3', startTime: 10 }; // 0:10
  } else {
    return { file: '/008.mp3', startTime: 8 }; // 0:08
  }
}

export default function ReportModal({ onClose, refreshKey }: ReportModalProps) {
  const searchParams = useSearchParams();
  const isDebug = searchParams.get('debug') === 'true';
  const [selectedType, setSelectedType] = useState<ReportType>('week');
  const [periodOffset, setPeriodOffset] = useState(0); // 0=当前周期，-1=上一周期
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState<ReportDebugInfo | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectedTypeRef = useRef<ReportType>('week');
  const periodOffsetRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  // 播放音乐
  const playMusic = useCallback((avgPerDay: number) => {
    // 停止当前播放的音乐
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const config = getMusicConfig(avgPerDay);
    const audio = new Audio(config.file);
    audio.currentTime = config.startTime;
    audio.loop = true;
    audio.volume = 0.5;
    audio.play().catch(() => {
      // 忽略自动播放被阻止的错误
    });
    audioRef.current = audio;
  }, []);

  // 停止音乐
  const stopMusic = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  // 组件卸载时停止音乐
  useEffect(() => {
    return () => {
      stopMusic();
    };
  }, [stopMusic]);

  // 关闭时停止音乐
  const handleClose = useCallback(() => {
    stopMusic();
    onClose();
  }, [stopMusic, onClose]);

  const loadReport = useCallback(async (type: ReportType, offset: number = 0, updateSelection: boolean = true) => {
    const requestId = ++requestIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);

    setLoading(true);
    setError('');
    setDebugInfo(null);
    if (updateSelection) {
      setSelectedType(type);
      setPeriodOffset(offset);
      selectedTypeRef.current = type;
      periodOffsetRef.current = offset;
    }
    setReport(''); // 清空旧报告
    stopMusic(); // 加载新报告时停止音乐

    try {
      const debugQuery = isDebug ? '?debug=true' : '';
      const res = await fetch(`/api/ai-report${debugQuery}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, markViewed: true, forceRefresh: true, periodOffset: offset }),
        signal: controller.signal
      });

      if (requestId !== requestIdRef.current) return;

      if (!res.ok) {
        let message = `AI 请求失败（${res.status}）`;
        try {
          const errJson = await res.json();
          if (errJson?.error) message = errJson.error;
        } catch {
          const text = await res.text();
          if (text) message = text.slice(0, 200);
        }
        setError(message);
        return;
      }

      const data = (await res.json()) as { report?: string; stats?: ReportStats; error?: string; debug?: ReportDebugInfo };
      if (requestId !== requestIdRef.current) return;

      if (data.error) {
        setError(data.error);
      } else {
        setReport(data.report ?? '');
        if (data.stats) {
          // 报告加载成功后播放音乐
          playMusic(data.stats.avgPerDay);
        }
        if (data.debug) {
          setDebugInfo(data.debug as ReportDebugInfo);
        }
      }
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        return;
      }
      if (requestId !== requestIdRef.current) return;
      setError('加载报告失败');
    } finally {
      window.clearTimeout(timeoutId);
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [stopMusic, playMusic, isDebug]);

  useEffect(() => {
    selectedTypeRef.current = selectedType;
    periodOffsetRef.current = periodOffset;
  }, [selectedType, periodOffset]);

  useEffect(() => {
    loadReport(selectedTypeRef.current, periodOffsetRef.current, false);
  }, [refreshKey, loadReport]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // 简单的 Markdown 渲染（支持基本语法）
  function renderMarkdown(text: string) {
    if (!text) return null;

    const lines = text.split('\n');
    const elements: ReactElement[] = [];
    let key = 0;
    let listBuffer: ReactElement[] = [];

    const flushList = () => {
      if (listBuffer.length === 0) return;
      elements.push(
        <ul key={`list-${key++}`} className="list-disc list-inside text-gray-300 space-y-1 ml-1">
          {listBuffer}
        </ul>
      );
      listBuffer = [];
    };

    for (const line of lines) {
      if (line.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={key++} className="text-xl font-bold mt-4 mb-2 text-white">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={key++} className="text-lg font-semibold mt-3 mb-1 text-gray-200">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith('- ')) {
        listBuffer.push(
          <li key={key++} className="ml-4 text-gray-300">
            {renderInline(line.slice(2))}
          </li>
        );
      } else if (line.trim() === '') {
        flushList();
        elements.push(<br key={key++} />);
      } else {
        flushList();
        elements.push(
          <p key={key++} className="text-gray-300 my-1">
            {renderInline(line)}
          </p>
        );
      }
    }

    flushList();
    return elements;
  }

  function renderInline(text: string) {
    // 处理 **bold** 和 *italic*
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      } else if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn border border-white/20">
        {/* 头部 */}
        <div className="p-4 border-b border-white/20 flex justify-between items-center bg-gray-900/80">
          <h2 className="text-xl font-bold text-white">AI 起飞报告</h2>
          <button
            onClick={handleClose}
            className="text-gray-300 hover:text-white text-2xl leading-none transition-colors btn-press"
          >
            &times;
          </button>
        </div>

        {/* 报告类型选择 */}
        <div className="p-3 border-b border-white/20 flex gap-2 flex-wrap bg-gray-800/60 items-center">
          {reportTypes.map((rt) => (
            <button
              key={rt.type}
              onClick={() => loadReport(rt.type, 0)}
              disabled={loading}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all btn-press ${
                selectedType === rt.type
                  ? 'bg-white text-gray-900'
                  : 'bg-white/20 text-gray-200 hover:bg-white/30'
              } disabled:opacity-50`}
            >
              {rt.label}
            </button>
          ))}

          {/* 周期选择下拉框 */}
          <select
            value={periodOffset}
            onChange={(e) => loadReport(selectedType, Number(e.target.value))}
            disabled={loading}
            className="ml-2 px-3 py-1.5 rounded-lg text-sm bg-gray-800 text-gray-200 border border-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
          >
            {getPeriodOptions(selectedType).map((opt) => (
              <option key={opt.offset} value={opt.offset} className="bg-gray-800">
                {opt.label}
              </option>
            ))}
          </select>

          {/* 刷新按钮 */}
          <button
            onClick={() => loadReport(selectedType, periodOffset)}
            disabled={loading}
            className="ml-auto px-3 py-1.5 rounded-full text-sm font-medium bg-white/20 text-gray-200 hover:bg-white/30 transition-all btn-press disabled:opacity-50 flex items-center gap-1"
            title="重新生成报告"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>

        {/* 报告内容 */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-900/40">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-300">AI 正在分析你的起飞数据...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 text-5xl mb-4">!</div>
              <p className="text-red-300">{error}</p>
              <button
                onClick={() => loadReport(selectedType, periodOffset)}
                className="mt-4 px-4 py-2 bg-white/90 text-gray-900 rounded-lg hover:bg-white transition-all btn-press"
              >
                重试
              </button>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none">
              {renderMarkdown(report)}
            </div>
          )}
        </div>

        {isDebug && (
          <div className="max-h-64 overflow-y-auto bg-gray-900/60 border-t border-white/10 text-xs text-gray-200 font-mono p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Debug</span>
              <span>req#{requestIdRef.current} {loading ? '(loading)' : ''}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>type: {selectedTypeRef.current}</div>
              <div>offset: {periodOffsetRef.current}</div>
              <div>refreshKey: {refreshKey}</div>
              <div>error: {error || 'none'}</div>
              <div>reportLen: {report.length}</div>
            </div>
            {debugInfo && (
              <>
                <div className="border-t border-white/10 pt-2 space-y-1">
                  <div>period: {debugInfo.period} ({debugInfo.periodKey})</div>
                  <div>target: {debugInfo.targetDate} → {debugInfo.actualEndDate}</div>
                  <div>partial: {debugInfo.isPartialPeriod ? 'yes' : 'no'} | model: {debugInfo.aiModel}</div>
                  {debugInfo.refreshToken && <div>refreshToken: {debugInfo.refreshToken}</div>}
                </div>
                {debugInfo.stats && (
                  <div className="border-t border-white/10 pt-2 grid grid-cols-2 gap-2">
                    <div>recordedDays: {debugInfo.stats.recordedDays}</div>
                    <div>totalCount: {debugInfo.stats.totalCount}</div>
                    <div>successDays: {debugInfo.stats.successDays}</div>
                    <div>zeroDays: {debugInfo.stats.zeroDays}</div>
                    <div>avgPerDay: {debugInfo.stats.avgPerDay.toFixed(2)}</div>
                    <div>maxCount: {debugInfo.stats.maxCount ?? '-'}</div>
                    <div>streak: {debugInfo.stats.streakDays}</div>
                  </div>
                )}
                {debugInfo.previousPeriods && debugInfo.previousPeriods.length > 0 && (
                  <details className="border-t border-white/10 pt-2">
                    <summary className="cursor-pointer">Previous periods</summary>
                    <div className="space-y-1 mt-1">
                      {debugInfo.previousPeriods.map((p) => (
                        <div key={p.label} className="grid grid-cols-2 gap-1">
                          <div className="col-span-2 font-semibold text-gray-100">{p.label}</div>
                          <div>total: {p.totalCount}</div>
                          <div>avg/day: {p.avgPerDay.toFixed(2)}</div>
                          <div>success: {p.successDays}</div>
                          <div>zeros: {p.zeroDays}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {debugInfo.userPrompt && (
                  <details className="border-t border-white/10 pt-2">
                    <summary className="cursor-pointer">Prompt</summary>
                    <pre className="whitespace-pre-wrap text-gray-100">{debugInfo.userPrompt}</pre>
                  </details>
                )}
                {debugInfo.analysis && (
                  <details>
                    <summary className="cursor-pointer">Raw Analysis</summary>
                    <pre className="whitespace-pre-wrap text-gray-100">{debugInfo.analysis}</pre>
                  </details>
                )}
              </>
            )}
          </div>
        )}

        {/* 底部 */}
        <div className="p-4 border-t border-white/20 bg-gray-800/60 flex justify-between items-center">
          <p className="text-xs text-gray-400">
            由 AI 生成，仅供参考
          </p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all btn-press"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

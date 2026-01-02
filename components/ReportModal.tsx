'use client';

import { useState, useEffect, ReactElement, useCallback } from 'react';

type ReportType = 'week' | 'month' | 'quarter' | 'year';

interface ReportModalProps {
  onClose: () => void;
}

const reportTypes: { type: ReportType; label: string }[] = [
  { type: 'week', label: '周报' },
  { type: 'month', label: '月报' },
  { type: 'quarter', label: '季报' },
  { type: 'year', label: '年报' }
];

export default function ReportModal({ onClose }: ReportModalProps) {
  const [selectedType, setSelectedType] = useState<ReportType>('week');
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReport = useCallback(async (type: ReportType) => {
    setLoading(true);
    setError('');
    setSelectedType(type);
    setReport(''); // 清空旧报告

    try {
      const res = await fetch('/api/ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, markViewed: false, forceRefresh: true })
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setReport(data.report);
      }
    } catch {
      setError('加载报告失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport('week');
  }, [loadReport]);

  // 简单的 Markdown 渲染（支持基本语法）
  function renderMarkdown(text: string) {
    if (!text) return null;

    const lines = text.split('\n');
    const elements: ReactElement[] = [];
    let key = 0;

    for (const line of lines) {
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={key++} className="text-xl font-bold mt-4 mb-2 text-white">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={key++} className="text-lg font-semibold mt-3 mb-1 text-gray-200">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith('- ')) {
        elements.push(
          <li key={key++} className="ml-4 text-gray-300">
            {renderInline(line.slice(2))}
          </li>
        );
      } else if (line.trim() === '') {
        elements.push(<br key={key++} />);
      } else {
        elements.push(
          <p key={key++} className="text-gray-300 my-1">
            {renderInline(line)}
          </p>
        );
      }
    }

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
            onClick={onClose}
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
              onClick={() => loadReport(rt.type)}
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

          {/* 刷新按钮 */}
          <button
            onClick={() => loadReport(selectedType)}
            disabled={loading}
            className="ml-auto px-3 py-1.5 rounded-full text-sm font-medium bg-white/20 text-gray-200 hover:bg-white/30 transition-all btn-press disabled:opacity-50 flex items-center gap-1"
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
                onClick={() => loadReport(selectedType)}
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

        {/* 底部 */}
        <div className="p-4 border-t border-white/20 bg-gray-800/60 flex justify-between items-center">
          <p className="text-xs text-gray-400">
            由 AI 生成，仅供参考
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all btn-press"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, ReactElement } from 'react';

type ReportType = 'week' | 'month' | 'quarter' | 'year';

interface PendingReport {
  type: ReportType;
  periodKey: string;
  label: string;
}

interface ReportModalProps {
  pendingReports: PendingReport[];
  onClose: () => void;
}

const reportTypeNames: Record<ReportType, string> = {
  week: '周报',
  month: '月报',
  quarter: '季报',
  year: '年报'
};

export default function ReportModal({ pendingReports, onClose }: ReportModalProps) {
  const [selectedType, setSelectedType] = useState<ReportType>(pendingReports[0]?.type || 'week');
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (pendingReports.length > 0) {
      loadReport(pendingReports[0].type);
    }
  }, []);

  async function loadReport(type: ReportType) {
    setLoading(true);
    setError('');
    setSelectedType(type);

    try {
      const res = await fetch('/api/ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, markViewed: true })
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
  }

  // 简单的 Markdown 渲染（支持基本语法）
  function renderMarkdown(text: string) {
    if (!text) return null;

    const lines = text.split('\n');
    const elements: ReactElement[] = [];
    let key = 0;

    for (const line of lines) {
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={key++} className="text-xl font-bold mt-4 mb-2 text-purple-700 dark:text-purple-400">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={key++} className="text-lg font-semibold mt-3 mb-1 text-gray-800 dark:text-gray-200">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith('- ')) {
        elements.push(
          <li key={key++} className="ml-4 text-gray-700 dark:text-gray-300">
            {renderInline(line.slice(2))}
          </li>
        );
      } else if (line.trim() === '') {
        elements.push(<br key={key++} />);
      } else {
        elements.push(
          <p key={key++} className="text-gray-700 dark:text-gray-300 my-1">
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-purple-600 to-blue-600">
          <h2 className="text-xl font-bold text-white">AI 起飞报告</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* 报告类型选择 */}
        <div className="p-3 border-b dark:border-gray-700 flex gap-2 flex-wrap bg-gray-50 dark:bg-gray-900">
          {pendingReports.map((pr) => (
            <button
              key={pr.type}
              onClick={() => loadReport(pr.type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                selectedType === pr.type
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {reportTypeNames[pr.type]} · {pr.label}
            </button>
          ))}
        </div>

        {/* 报告内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">AI 正在分析你的起飞数据...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 text-5xl mb-4">!</div>
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={() => loadReport(selectedType)}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                重试
              </button>
            </div>
          ) : (
            <div className="prose dark:prose-invert max-w-none">
              {renderMarkdown(report)}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            由 AI 生成，仅供参考
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

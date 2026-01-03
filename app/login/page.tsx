'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CalendarBackground from '@/components/CalendarBackground';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsInit, setNeedsInit] = useState(false);
  const [initLogs, setInitLogs] = useState<string[]>([]);
  const [initializing, setInitializing] = useState(false);

  // 检查是否需要初始化
  useEffect(() => {
    checkInit();
  }, []);

  async function checkInit() {
    try {
      const res = await fetch('/api/init');
      const data = await res.json();
      setNeedsInit(data.needsInit);
    } catch {
      setNeedsInit(true);
    }
  }

  async function handleInit() {
    setInitializing(true);
    setInitLogs([]);
    setError('');

    try {
      const res = await fetch('/api/init', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setInitLogs(data.logs);
        setNeedsInit(false);
        if (data.adminPassword) {
          setUsername('Fimall');
        }
      } else {
        setError(data.error || '初始化失败');
        setInitLogs(data.logs || []);
      }
    } catch {
      setError('初始化失败，请检查网络连接');
    } finally {
      setInitializing(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (data.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || '登录失败');
      }
    } catch {
      setError('登录失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* 日历背景 */}
      <CalendarBackground />

      {/* 半透明遮罩 */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />

      {/* 登录卡片 */}
      <div className="bg-white/10 dark:bg-gray-800/80 backdrop-blur-md p-8 rounded-lg shadow-2xl w-full max-w-md animate-fadeInUp relative z-10 border border-white/20">
        <h1 className="text-2xl font-bold text-center mb-6 text-white">
          Flight Calendar 2026
        </h1>

        {needsInit ? (
          <div className="space-y-4">
            <p className="text-center text-gray-300">
              首次使用，需要初始化数据库
            </p>
            <button
              onClick={handleInit}
              disabled={initializing}
              className="w-full bg-white/90 hover:bg-white text-gray-900 py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 btn-press font-medium"
            >
              {initializing ? '初始化中...' : '初始化数据库'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/90 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent text-gray-900 placeholder-gray-500 input-focus"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/90 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent text-gray-900 placeholder-gray-500 input-focus"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white/90 hover:bg-white text-gray-900 py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 btn-press font-medium"
            >
              {loading ? '登录中...' : '登录'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/30"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-transparent text-gray-400">或</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/?local=true')}
              className="w-full bg-white/10 hover:bg-white/20 text-gray-200 py-2.5 px-4 rounded-lg transition-all btn-press font-medium border border-white/30"
            >
              使用本地模式
            </button>
          </form>
        )}

        {/* APK 下载入口 */}
        <div className="mt-6 pt-6 border-t border-white/20">
          <a
            href="/FC26.apk"
            download="FC26.apk"
            className="w-full flex items-center justify-center gap-2 bg-green-600/80 hover:bg-green-600 text-white py-2.5 px-4 rounded-lg transition-all btn-press font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载 Android 客户端
          </a>
          <p className="text-center text-gray-400 text-xs mt-2">
            安装后可离线使用，数据自动同步
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/20 text-red-200 rounded border border-red-500/30">
            {error}
          </div>
        )}

        {initLogs.length > 0 && (
          <div className="mt-4 p-3 bg-white/10 rounded text-sm border border-white/20">
            <p className="font-medium mb-2 text-white">初始化日志:</p>
            {initLogs.map((log, i) => (
              <p
                key={i}
                className={`font-mono text-xs ${
                  log.includes('[IMPORTANT]')
                    ? 'text-orange-400 font-bold'
                    : log.includes('[ERROR]')
                    ? 'text-red-400'
                    : 'text-gray-300'
                }`}
              >
                {log}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

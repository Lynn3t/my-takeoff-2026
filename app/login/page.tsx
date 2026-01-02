'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md animate-fadeInUp">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          Flight Calendar 2026
        </h1>

        {needsInit ? (
          <div className="space-y-4">
            <p className="text-center text-gray-600 dark:text-gray-300">
              首次使用，需要初始化数据库
            </p>
            <button
              onClick={handleInit}
              disabled={initializing}
              className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 btn-press font-medium"
            >
              {initializing ? '初始化中...' : '初始化数据库'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white input-focus"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white input-focus"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 btn-press font-medium"
            >
              {loading ? '登录中...' : '登录'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">或</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/?local=true')}
              className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-2.5 px-4 rounded-lg transition-all btn-press font-medium border border-gray-300 dark:border-gray-600"
            >
              使用本地模式
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded">
            {error}
          </div>
        )}

        {initLogs.length > 0 && (
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded text-sm">
            <p className="font-medium mb-2 text-gray-900 dark:text-white">初始化日志:</p>
            {initLogs.map((log, i) => (
              <p
                key={i}
                className={`font-mono text-xs ${
                  log.includes('[IMPORTANT]')
                    ? 'text-orange-600 dark:text-orange-400 font-bold'
                    : log.includes('[ERROR]')
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-300'
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

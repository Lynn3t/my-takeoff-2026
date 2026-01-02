'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
}

interface CurrentUser {
  id: number;
  username: string;
  is_admin: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 新用户表单
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  // 修改密码
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editPassword, setEditPassword] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.status === 403) {
        router.push('/');
        return;
      }
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch {
      setError('获取用户列表失败');
    }
  }, [router]);

  useEffect(() => {
    async function init() {
      // 获取当前用户
      const authRes = await fetch('/api/auth');
      const authData = await authRes.json();

      if (!authData.authenticated || !authData.user.is_admin) {
        router.push('/');
        return;
      }

      setCurrentUser(authData.user);
      await fetchUsers();
      setLoading(false);
    }
    init();
  }, [router, fetchUsers]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          is_admin: newIsAdmin
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`用户 ${newUsername} 创建成功`);
        setNewUsername('');
        setNewPassword('');
        setNewIsAdmin(false);
        await fetchUsers();
      } else {
        setError(data.error);
      }
    } catch {
      setError('创建用户失败');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteUser(userId: number, username: string) {
    if (!confirm(`确定要删除用户 ${username} 吗？`)) return;

    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        setSuccess(`用户 ${username} 已删除`);
        await fetchUsers();
      } else {
        setError(data.error);
      }
    } catch {
      setError('删除用户失败');
    }
  }

  async function handleChangePassword(userId: number) {
    if (!editPassword || editPassword.length < 6) {
      setError('密码长度至少 6 个字符');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword: editPassword })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('密码修改成功');
        setEditingUserId(null);
        setEditPassword('');
      } else {
        setError(data.error);
      }
    } catch {
      setError('修改密码失败');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-300">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">用户管理</h1>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            &larr; 返回首页
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded">
            {success}
          </div>
        )}

        {/* 新增用户表单 */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">新增用户</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  用户名
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  minLength={2}
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  密码
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={newIsAdmin}
                    onChange={(e) => setNewIsAdmin(e.target.checked)}
                    className="mr-2"
                  />
                  管理员权限
                </label>
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition disabled:opacity-50"
            >
              {creating ? '创建中...' : '创建用户'}
            </button>
          </form>
        </div>

        {/* 用户列表 */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">用户列表</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="pb-3 text-gray-700 dark:text-gray-300">ID</th>
                  <th className="pb-3 text-gray-700 dark:text-gray-300">用户名</th>
                  <th className="pb-3 text-gray-700 dark:text-gray-300">角色</th>
                  <th className="pb-3 text-gray-700 dark:text-gray-300">创建时间</th>
                  <th className="pb-3 text-gray-700 dark:text-gray-300">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b dark:border-gray-700">
                    <td className="py-3 text-gray-900 dark:text-white">{user.id}</td>
                    <td className="py-3 text-gray-900 dark:text-white">
                      {user.username}
                      {user.id === currentUser?.id && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(当前)</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          user.is_admin
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {user.is_admin ? '管理员' : '普通用户'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400 text-sm">
                      {new Date(user.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2 flex-wrap">
                        {editingUserId === user.id ? (
                          <>
                            <input
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="新密码"
                              className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <button
                              onClick={() => handleChangePassword(user.id)}
                              className="text-green-600 hover:text-green-700 text-sm"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => {
                                setEditingUserId(null);
                                setEditPassword('');
                              }}
                              className="text-gray-600 hover:text-gray-700 text-sm"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingUserId(user.id)}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              改密码
                            </button>
                            {user.id !== currentUser?.id && (
                              <button
                                onClick={() => handleDeleteUser(user.id, user.username)}
                                className="text-red-600 hover:text-red-700 text-sm"
                              >
                                删除
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

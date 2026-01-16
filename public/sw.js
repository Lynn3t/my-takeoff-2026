// sw.js - Service Worker with Offline Sync Support

const DB_NAME = 'TakeoffOfflineDB';
const STORE_NAME = 'pendingRequests';

// IndexedDB 操作封装
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function savePendingRequest(requestData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add({
      ...requestData,
      timestamp: Date.now()
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getPendingRequests() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deletePendingRequest(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 同步待处理的请求
async function syncPendingRequests() {
  const pending = await getPendingRequests();

  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  // 按时间戳排序，确保顺序正确
  pending.sort((a, b) => a.timestamp - b.timestamp);

  for (const item of pending) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
        credentials: 'include'
      });

      if (response.ok) {
        await deletePendingRequest(item.id);
        synced++;
      } else {
        // 如果是认证错误，保留请求等待重试
        if (response.status === 401) {
          failed++;
        } else {
          // 其他错误删除请求（可能是无效数据）
          await deletePendingRequest(item.id);
          failed++;
        }
      }
    } catch (error) {
      // 网络错误，保留请求
      failed++;
      console.error('[SW] Sync failed for request:', item.id, error);
    }
  }

  // 通知所有客户端同步结果
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      synced,
      failed,
      remaining: failed
    });
  });

  return { synced, failed };
}

// Install 事件
self.addEventListener('install', () => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// Activate 事件
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});

// Fetch 事件 - 拦截 API 请求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 只拦截 POST /api 请求（记录数据的请求）
  if (event.request.method === 'POST' && url.pathname === '/api') {
    event.respondWith(handleApiPost(event.request));
    return;
  }

  // 其他请求正常处理
  event.respondWith(fetch(event.request));
});

// 处理离线 POST 请求
async function handleApiPost(request) {
  try {
    // 尝试在线请求
    const response = await fetch(request.clone());
    return response;
  } catch {
    // 离线状态 - 保存请求到 IndexedDB
    console.log('[SW] Offline - saving request for later sync');

    const body = await request.clone().text();

    await savePendingRequest({
      url: request.url,
      method: request.method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: body
    });

    // 注册 Background Sync
    if (self.registration.sync) {
      try {
        await self.registration.sync.register('sync-takeoff');
        console.log('[SW] Background sync registered');
      } catch (e) {
        console.log('[SW] Background sync registration failed', e);
      }
    }

    // 通知客户端数据已离线保存
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'OFFLINE_SAVED',
        data: JSON.parse(body)
      });
    });

    // 返回一个成功响应，让前端继续工作
    return new Response(JSON.stringify({
      success: true,
      offline: true,
      message: '数据已离线保存，网络恢复后自动同步'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Background Sync 事件
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event fired:', event.tag);

  if (event.tag === 'sync-takeoff') {
    event.waitUntil(syncPendingRequests());
  }
});

// 手动触发同步（通过 message）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'MANUAL_SYNC') {
    console.log('[SW] Manual sync requested');
    syncPendingRequests().then(result => {
      event.source.postMessage({
        type: 'MANUAL_SYNC_COMPLETE',
        ...result
      });
    });
  }

  if (event.data && event.data.type === 'GET_PENDING_COUNT') {
    getPendingRequests().then(pending => {
      event.source.postMessage({
        type: 'PENDING_COUNT',
        count: pending.length
      });
    });
  }
});

// 在线状态恢复时尝试同步
self.addEventListener('online', () => {
  console.log('[SW] Online - attempting sync');
  syncPendingRequests();
});

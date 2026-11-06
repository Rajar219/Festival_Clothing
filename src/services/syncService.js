// FESTIVAL CLOTHING POS - Storage & Sync Status Service
// Local-First IndexedDB architecture with status reporting for central cloud synchronization
import { getDB, getAllBills } from './db';
import { getTerminalId, getTerminalType } from './terminal';

let isSyncInProgress = false;
let currentSyncStatus = 'unconfigured'; // 'unconfigured' | 'synced' | 'syncing' | 'offline' | 'pending'
let pendingCount = 0;
let lastSyncTimestamp = null;
let lastSyncMessage = 'Local-First Storage Active (Central Cloud Sync Not Configured)';

const statusListeners = new Set();

function notifyListeners() {
  const state = getSyncState();
  statusListeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.warn('Sync listener error:', e);
    }
  });
}

export function subscribeSyncStatus(callback) {
  statusListeners.add(callback);
  callback(getSyncState());
  return () => statusListeners.delete(callback);
}

export function getSyncState() {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  return {
    status: currentSyncStatus,
    pendingCount,
    lastSyncTimestamp,
    message: lastSyncMessage,
    isOnline,
    isCloudConfigured: false, // Cloud database (e.g. Firebase Firestore) is not configured
  };
}

/**
 * Checks local bills status in IndexedDB and updates pending count
 */
export async function refreshSyncQueueStatus() {
  try {
    const db = await getDB();
    const allBills = await db.getAll('bills');
    const localPending = allBills.filter((b) => b.syncStatus !== 'synced');
    pendingCount = localPending.length;
    currentSyncStatus = 'unconfigured';
    lastSyncMessage = `Operating Local-First (IndexedDB: ${allBills.length} total bills). Central Cloud DB is not configured.`;
    notifyListeners();
  } catch (err) {
    console.warn('Failed to inspect local bills queue:', err);
  }
}

/**
 * Manual sync trigger or retry
 */
export async function syncWithBackend() {
  await refreshSyncQueueStatus();
  return {
    success: false,
    status: 'unconfigured',
    message: 'Central Cloud Database (Firebase Firestore) is not configured. All bills are stored safely in your browser local IndexedDB.',
  };
}

export function startPeriodicSync() {
  refreshSyncQueueStatus();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', refreshSyncQueueStatus);
    window.addEventListener('offline', refreshSyncQueueStatus);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', refreshSyncQueueStatus);
      window.removeEventListener('offline', refreshSyncQueueStatus);
    }
  };
}

export function stopPeriodicSync() {
  // Clean teardown
}

export const startBackgroundSync = startPeriodicSync;
export const stopBackgroundSync = stopPeriodicSync;

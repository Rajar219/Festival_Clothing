// FESTIVAL CLOTHING POS - Storage & Sync Status Service
// Local-First IndexedDB architecture with status reporting for central cloud synchronization
import { getDB, getAllBills } from './db';
import { getTerminalId, getTerminalType } from './terminal';
import { isFirebaseConfigured, syncBillsWithFirestore, subscribeFirestoreBills } from './firebase';

export { subscribeFirestoreBills };

let isSyncInProgress = false;
let currentSyncStatus = 'unconfigured'; // 'unconfigured' | 'synced' | 'syncing' | 'offline' | 'pending'
let pendingCount = 0;
let lastSyncTimestamp = null;
let lastSyncMessage = 'Local-First Storage Active';

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
    isCloudConfigured: isFirebaseConfigured(),
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

    if (!isFirebaseConfigured()) {
      currentSyncStatus = 'unconfigured';
      lastSyncMessage = `Operating Local-First (IndexedDB: ${allBills.length} bills). Central Cloud Database is not yet connected in Vercel.`;
    } else if (pendingCount > 0) {
      currentSyncStatus = 'pending';
      lastSyncMessage = `${pendingCount} bill(s) pending sync to Central Cloud Database.`;
    } else {
      currentSyncStatus = 'synced';
      lastSyncMessage = 'All bills synchronised with Central Cloud Database.';
    }
    notifyListeners();
  } catch (err) {
    console.warn('Failed to inspect local bills queue:', err);
  }
}

/**
 * Manual sync trigger or retry
 */
export async function syncWithBackend() {
  if (!isFirebaseConfigured()) {
    await refreshSyncQueueStatus();
    return {
      success: false,
      status: 'unconfigured',
      message: 'Central database not yet connected in Vercel. Operating in local-first mode.',
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: false,
      status: 'offline',
      message: 'Device is offline. Pending bills will sync when reconnected.',
    };
  }

  isSyncInProgress = true;
  currentSyncStatus = 'syncing';
  notifyListeners();

  try {
    const db = await getDB();
    const localBills = await db.getAll('bills');
    const { syncedCount, remoteBills } = await syncBillsWithFirestore(localBills);

    // Merge remote bills from other devices into local IndexedDB
    for (const rb of remoteBills) {
      const exists = localBills.some((lb) => lb.billNumber === rb.billNumber || lb.id === rb.id);
      if (!exists) {
        const safeBill = {
          ...rb,
          id: rb.id || rb.billNumber,
          syncStatus: 'synced',
        };
        await db.put('bills', safeBill);
      }
    }

    // Mark all local bills as synced
    const tx = db.transaction('bills', 'readwrite');
    for (const b of localBills) {
      if (b.syncStatus !== 'synced') {
        await tx.store.put({ ...b, syncStatus: 'synced' });
      }
    }
    await tx.done;

    pendingCount = 0;
    currentSyncStatus = 'synced';
    lastSyncTimestamp = new Date().toISOString();
    lastSyncMessage = `Synchronised with Central Database! (${syncedCount} bills uploaded)`;
    notifyListeners();

    return {
      success: true,
      status: 'success',
      message: `Cross-device sync complete! (${syncedCount} uploaded)`,
    };
  } catch (err) {
    console.warn('Central sync error:', err);
    currentSyncStatus = 'pending';
    notifyListeners();
    return {
      success: false,
      status: 'error',
      message: 'Sync error: ' + err.message,
    };
  } finally {
    isSyncInProgress = false;
  }
}

export function startPeriodicSync(onSyncComplete) {
  if (isFirebaseConfigured()) {
    syncWithBackend().then(() => {
      if (onSyncComplete) onSyncComplete();
    }).catch(console.warn);
  } else {
    refreshSyncQueueStatus();
  }

  const handleOnline = () => {
    refreshSyncQueueStatus();
    if (isFirebaseConfigured()) {
      syncWithBackend().then(() => {
        if (onSyncComplete) onSyncComplete();
      }).catch(console.warn);
    }
  };

  const handleOffline = () => {
    refreshSyncQueueStatus();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  };
}

export function stopPeriodicSync() {
  // Clean teardown
}

export const startBackgroundSync = startPeriodicSync;
export const stopBackgroundSync = stopPeriodicSync;

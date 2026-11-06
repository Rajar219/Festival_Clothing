// ============================================================================
// WISDO TECH POS - Google Drive Cloud Document Storage
// FESTIVAL CLOTHING MENSWEAR (Diwali Edition)
// Powered by WISDO TECH
// ============================================================================
// Uses Google Identity Services (GIS) OAuth 2.0 with the restricted scope:
// 'https://www.googleapis.com/auth/drive.file'
// (Only accesses files and folders created or opened by this app)
// ============================================================================

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_STORAGE_KEY = 'wisdo_gdrive_auth_v1';
const FOLDER_CACHE_KEY = 'wisdo_gdrive_folders_v2';

// Primary Root Folder in Google Drive (User designated: 'FESTIVAL SALES BILL')
export const ROOT_DRIVE_FOLDER_NAME = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER || 'FESTIVAL SALES BILL';

// Default / fallback Google Client ID (configured for Festival Clothing)
const DEFAULT_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '1016904752396-hml53gmsol15v9rh6jes43sugq2n684p.apps.googleusercontent.com';

/**
 * Loads the official Google Identity Services script dynamically if not present
 */
export function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.google?.accounts?.oauth2) {
      return resolve(window.google.accounts.oauth2);
    }

    const existingScript = document.getElementById('google-gsi-client');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google.accounts.oauth2));
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.accounts.oauth2);
    script.onerror = (err) => reject(new Error('Failed to load Google Identity Services library.'));
    document.head.appendChild(script);
  });
}

/**
 * Gets currently saved auth token details from localStorage
 */
export function getSavedDriveAuth() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRIVE_STORAGE_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw);
    // Check if token has expired (expires_at is in milliseconds)
    if (auth.expires_at && Date.now() > auth.expires_at) {
      return { ...auth, isExpired: true };
    }
    return { ...auth, isExpired: false };
  } catch (e) {
    return null;
  }
}

/**
 * Checks if Google Drive is currently authorized and token is valid
 */
export function isGoogleDriveConnected() {
  const auth = getSavedDriveAuth();
  return Boolean(auth && auth.access_token && !auth.isExpired);
}

/**
 * Saves auth token to localStorage
 */
function saveDriveAuth(authData) {
  if (typeof window === 'undefined') return;
  const expiresAt = Date.now() + (parseInt(authData.expires_in, 10) || 3600) * 1000 - 60000; // 1 min buffer
  const payload = {
    access_token: authData.access_token,
    scope: authData.scope,
    token_type: authData.token_type,
    expires_at: expiresAt,
    connected_at: new Date().toISOString(),
  };
  localStorage.setItem(DRIVE_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Disconnects Google Drive and removes stored tokens & folder cache
 */
export function disconnectGoogleDrive() {
  if (typeof window === 'undefined') return;
  const auth = getSavedDriveAuth();
  if (auth && auth.access_token && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(auth.access_token, () => {});
    } catch (e) {
      console.warn('Token revocation note:', e);
    }
  }
  localStorage.removeItem(DRIVE_STORAGE_KEY);
  localStorage.removeItem(FOLDER_CACHE_KEY);
}

/**
 * Prompts user for Google Drive authorization via Google Identity Services
 */
export async function connectGoogleDrive(customClientId = null) {
  const clientId = customClientId || DEFAULT_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'Google Client ID is not configured. Please enter your OAuth 2.0 Web Client ID in Admin Settings or set VITE_GOOGLE_CLIENT_ID.'
    );
  }

  const oauth2 = await loadGoogleIdentityScript();
  if (!oauth2) {
    throw new Error('Google Identity Services library could not be loaded.');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_FILE_SCOPE,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(`Google Authorization Failed: ${tokenResponse.error}`));
            return;
          }
          saveDriveAuth(tokenResponse);
          try {
            // Immediately initialize required folder structure
            const folders = await ensureFolderStructure(tokenResponse.access_token);
            resolve({
              success: true,
              folders,
              accessToken: tokenResponse.access_token,
            });
          } catch (folderErr) {
            console.warn('Folder creation warning:', folderErr);
            resolve({
              success: true,
              accessToken: tokenResponse.access_token,
              folderWarning: folderErr.message,
            });
          }
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Internal helper to make authorized calls to Google Drive REST API v3
 */
async function driveApiRequest(endpoint, options = {}, tokenOverride = null) {
  let token = tokenOverride;
  if (!token) {
    const auth = getSavedDriveAuth();
    if (!auth || !auth.access_token || auth.isExpired) {
      throw new Error('Google Drive is not connected or authorization expired. Please reconnect in Settings.');
    }
    token = auth.access_token;
  }

  const url = endpoint.startsWith('https://') ? endpoint : `https://www.googleapis.com/drive/v3/${endpoint}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errBody = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(errBody);
    } catch (e) {}
    const msg = parsed?.error?.message || response.statusText || 'Google Drive API error';
    throw new Error(msg);
  }

  // Some endpoints return empty body on 204
  if (response.status === 204) return null;
  return response.json();
}

/**
 * Searches for or creates a folder inside a parent folder
 */
async function getOrCreateFolder(folderName, parentFolderId = null, token = null) {
  let query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchRes = await driveApiRequest(
    `files?q=${encodeURIComponent(query)}&fields=files(id, name)&spaces=drive`,
    { method: 'GET' },
    token
  );

  if (searchRes.files && searchRes.files.length > 0) {
    return searchRes.files[0].id;
  }

  // Create the folder
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentFolderId ? { parents: [parentFolderId] } : {}),
  };

  const createRes = await driveApiRequest(
    'files?fields=id, name',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    },
    token
  );

  return createRes.id;
}

/**
 * Creates or identifies the required folder structure in Google Drive:
 * FESTIVAL SALES BILL/
 *   PC BILLING/
 *   MOBILE BILLING/
 *   DAILY BACKUPS/
 *   SALES REPORTS/
 */
export async function ensureFolderStructure(tokenOverride = null, customRootName = null) {
  const targetRoot = customRootName || ROOT_DRIVE_FOLDER_NAME;

  // Check cached folder IDs in localStorage
  try {
    const cached = localStorage.getItem(FOLDER_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.rootName === targetRoot && parsed.root && parsed.pc && parsed.mobile && parsed.backups && parsed.reports) {
        return parsed;
      }
    }
  } catch (e) {}

  // 1. Root folder: Finds existing 'FESTIVAL SALES BILL' or creates if missing
  const rootId = await getOrCreateFolder(targetRoot, null, tokenOverride);

  // 2. Subfolders
  const [pcId, mobileId, backupsId, reportsId] = await Promise.all([
    getOrCreateFolder('PC BILLING', rootId, tokenOverride),
    getOrCreateFolder('MOBILE BILLING', rootId, tokenOverride),
    getOrCreateFolder('DAILY BACKUPS', rootId, tokenOverride),
    getOrCreateFolder('SALES REPORTS', rootId, tokenOverride),
  ]);

  const folderMap = {
    rootName: targetRoot,
    root: rootId,
    pc: pcId,
    mobile: mobileId,
    backups: backupsId,
    reports: reportsId,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(FOLDER_CACHE_KEY, JSON.stringify(folderMap));
  } catch (e) {}

  return folderMap;
}

/**
 * Uploads a file with multipart upload (metadata + blob) into a specific Google Drive folder
 */
async function uploadMultipartFile(folderId, fileName, mimeType, fileBlob, tokenOverride = null) {
  let token = tokenOverride;
  if (!token) {
    const auth = getSavedDriveAuth();
    if (!auth || !auth.access_token || auth.isExpired) {
      throw new Error('Google Drive authorization required.');
    }
    token = auth.access_token;
  }

  // 1. Check if file with exact same name already exists in target folder to prevent accidental duplicates
  const checkQuery = `name = '${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`;
  try {
    const existing = await driveApiRequest(
      `files?q=${encodeURIComponent(checkQuery)}&fields=files(id, name, webViewLink)&spaces=drive`,
      { method: 'GET' },
      token
    );
    if (existing.files && existing.files.length > 0) {
      return {
        fileId: existing.files[0].id,
        webViewLink: existing.files[0].webViewLink,
        isDuplicate: true,
      };
    }
  } catch (checkErr) {
    console.warn('Duplicate check warning:', checkErr);
  }

  // 2. Perform multipart upload
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: mimeType,
    description: 'FESTIVAL CLOTHING MENSWEAR POS — Powered by WISDO TECH',
  };

  const reader = new FileReader();
  const fileArrayBuffer = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(fileBlob);
  });

  const metadataBlob = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${mimeType}\r\n\r\n`,
  ]);

  const closeBlob = new Blob([closeDelimiter]);

  const multipartBlob = new Blob([metadataBlob, fileArrayBuffer, closeBlob], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBlob,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upload to Google Drive failed: ${response.statusText} (${errText})`);
  }

  const result = await response.json();
  return {
    fileId: result.id,
    webViewLink: result.webViewLink,
    isDuplicate: false,
  };
}

/**
 * Uploads a finalized PDF Invoice to the designated device folder
 * (PC BILLING/ for PC or MOBILE BILLING/ for Mobile)
 */
export async function uploadInvoicePDFToDrive(bill, pdfBlob, deviceType = 'PC') {
  if (!isGoogleDriveConnected()) {
    return { success: false, reason: 'DRIVE_NOT_CONNECTED' };
  }

  try {
    const folders = await ensureFolderStructure();
    const targetFolderId = deviceType === 'MOBILE' ? folders.mobile : folders.pc;
    const folderName = deviceType === 'MOBILE' ? 'MOBILE BILLING' : 'PC BILLING';

    const safeDate = (bill.createdAt ? new Date(bill.createdAt) : new Date())
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    const fileName = `${bill.billNumber}_${safeDate}_Invoice.pdf`;

    const uploadRes = await uploadMultipartFile(
      targetFolderId,
      fileName,
      'application/pdf',
      pdfBlob
    );

    return {
      success: true,
      fileId: uploadRes.fileId,
      webViewLink: uploadRes.webViewLink,
      folderName,
      fileName,
      isDuplicate: uploadRes.isDuplicate,
    };
  } catch (err) {
    console.error('Google Drive Invoice Upload Error:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Uploads daily JSON full database backup to DAILY BACKUPS/ folder
 */
export async function uploadBackupToDrive(jsonBackupString) {
  if (!isGoogleDriveConnected()) {
    throw new Error('Google Drive is not connected.');
  }

  const folders = await ensureFolderStructure();
  const todayStr = new Date().toISOString().slice(0, 10);
  const fileName = `FestivalClothing_Backup_${todayStr}.json`;

  const blob = new Blob([jsonBackupString], { type: 'application/json' });
  const result = await uploadMultipartFile(folders.backups, fileName, 'application/json', blob);

  return {
    success: true,
    fileId: result.fileId,
    webViewLink: result.webViewLink,
    fileName,
    folderName: 'DAILY BACKUPS',
  };
}

/**
 * Uploads CSV sales reports to SALES REPORTS/ folder
 */
export async function uploadCSVReportToDrive(csvString, reportType = 'BillsSummary') {
  if (!isGoogleDriveConnected()) {
    throw new Error('Google Drive is not connected.');
  }

  const folders = await ensureFolderStructure();
  const todayStr = new Date().toISOString().slice(0, 10);
  const fileName = `FestivalClothing_${reportType}_${todayStr}.csv`;

  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const result = await uploadMultipartFile(folders.reports, fileName, 'text/csv', blob);

  return {
    success: true,
    fileId: result.fileId,
    webViewLink: result.webViewLink,
    fileName,
    folderName: 'SALES REPORTS',
  };
}


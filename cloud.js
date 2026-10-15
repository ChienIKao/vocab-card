import { firebaseConfig } from './firebase-config.js';
import { connectGoogle, registerAccessRequest } from './firebase-client.js';
import { deckChanges, mergeDeck, normalizeDeck } from './sync-model.mjs';

const app = window.vocabApp;
const status = document.getElementById('cloudStatus');
const account = document.getElementById('cloudAccount');
const login = document.getElementById('googleLoginBtn');
const logout = document.getElementById('googleLogoutBtn');
let session = null;
window.vocabNormalizeDeck = normalizeDeck;

function showStatus(message) { status.textContent = message; }
function report(error) {
  const messages = {
    'auth/unauthorized-domain': '此網址尚未啟用 Google 登入。',
    'auth/popup-blocked': '請允許登入視窗，然後再試一次。',
    'auth/popup-closed-by-user': '登入視窗已關閉，卡片仍保存在本機。',
    'auth/network-request-failed': '登入服務暫時無法連線，請稍後再試。',
    'permission-denied': '目前無法存取雲端詞庫，請重新登入或聯絡管理者。',
    'unavailable': '目前無法連線，變更已保留在本機，稍後再同步。'
  };
  showStatus(messages[error.code] || '雲端同步暫時無法完成，卡片已保留在本機。');
  console.error('Cloud sync:', error.code || error.message);
}

window.addEventListener('deckchange', event => session?.enqueue(event.detail));

if (!firebaseConfig) {
  showStatus('目前使用本機詞庫 · 雲端同步尚未啟用');
  login.disabled = true;
} else {
  start().catch(report);
}

async function start() {
  await connectGoogle({ login, logout, onError: report, onUser(user, { db, store }) {
    session?.stop();
    session = null;
    login.classList.toggle('hidden', !!user);
    logout.classList.toggle('hidden', !user);
    account.textContent = user?.displayName || '';
    document.getElementById('adminLink').classList.add('hidden');
    document.getElementById('storageNote').textContent = user
      ? '變更自動儲存並同步至雲端；同步狀態顯示於頁面上方'
      : '所有變更會自動儲存在您的裝置中';
    const seed = app.getCards();
    app.switchAccount(user?.uid);
    if (!user) {
      app.setEditingEnabled(true);
      showStatus('本機詞庫 · 登入 Google 後可跨裝置同步');
      return;
    }
    showStatus('正在讀取雲端詞庫…');
    app.setEditingEnabled(false);
    session = createAccountSession(user, seed, db, store);
  } });
}

function createAccountSession(user, seed, db, store) {
  let deckSession = null;
  let stopped = false;
  let membershipKnown = false;
  let enabled = false;
  let requestFailed = false;
  let requestSent = false;
  let membershipExists = false;
  function pendingStatus() {
    if (stopped || !membershipKnown || enabled) return;
    showStatus(membershipExists ? '雲端詞庫權限已停用，請聯絡管理者。'
      : requestFailed ? '無法送出使用申請，請重新整理再試一次。'
      : requestSent ? '使用申請已送出，等待管理者核准。' : '正在送出使用申請…');
  }
  registerAccessRequest(user, db, store).then(() => {
    requestSent = true;
    pendingStatus();
  }).catch(error => {
    if (stopped) return;
    requestFailed = true;
    pendingStatus();
    console.error('Access request:', error.code || error.message);
  });
  const stopAdmin = store.onSnapshot(store.doc(db, 'admins', user.uid), snapshot => {
    if (!stopped) document.getElementById('adminLink').classList.toggle('hidden', snapshot.data()?.enabled !== true);
  }, () => { if (!stopped) document.getElementById('adminLink').classList.add('hidden'); });
  const stopMembership = store.onSnapshot(store.doc(db, 'members', user.uid), snapshot => {
    if (stopped) return;
    membershipKnown = true;
    membershipExists = snapshot.exists();
    enabled = snapshot.data()?.enabled === true;
    if (enabled) {
      if (!deckSession) {
        showStatus('正在讀取雲端詞庫…');
        deckSession = createSession(user.uid, seed, db, store);
      }
    } else {
      deckSession?.stop();
      deckSession = null;
      app.setEditingEnabled(false);
      pendingStatus();
    }
  }, error => { if (!stopped) report(error); });
  return {
    enqueue(change) { deckSession?.enqueue(change); },
    stop() {
      stopped = true;
      deckSession?.stop();
      stopAdmin();
      stopMembership();
    }
  };
}

function createSession(uid, seed, db, store) {
  const deckRef = store.doc(db, 'users', uid);
  const cardsRef = store.collection(deckRef, 'cards');
  const outboxKey = `vocab-card-outbox:${uid}`;
  let pending = new Map();
  let pendingOrder = null;
  let remote = [];
  let remoteOrder = [];
  let metadataReady = false;
  let cardsReady = false;
  let cardsServerReady = false;
  let metadataMissing = false;
  let initializing = false;
  let flushing = false;
  let stopped = false;
  let ready = false;
  let lastFailure = false;

  try {
    const saved = JSON.parse(localStorage.getItem(outboxKey) || 'null');
    if (saved) {
      pending = new Map(saved.changes);
      pendingOrder = saved.order;
    }
  } catch (error) { report(error); }

  function persist() {
    if (!pending.size && !pendingOrder) localStorage.removeItem(outboxKey);
    else localStorage.setItem(outboxKey, JSON.stringify({ changes: [...pending], order: pendingOrder }));
  }

  function render() {
    if (stopped || !metadataReady || !cardsReady) return;
    ready = true;
    app.applyCards(mergeDeck(remote, pendingOrder?.ids || remoteOrder, pending));
    app.setEditingEnabled(true);
    if (!lastFailure) {
      showStatus(pending.size || pendingOrder
        ? (navigator.onLine ? '正在同步…' : '離線中 · 變更已保存在本機')
        : '雲端詞庫已同步');
    }
    flush();
  }

  async function initialize() {
    if (initializing || stopped || !cardsServerReady || !metadataMissing) return;
    initializing = true;
    try {
      const initial = normalizeDeck(remote.length ? remote : seed);
      const revision = crypto.randomUUID();
      if (!remote.length) for (const card of initial) {
        if (!pending.has(card.id)) pending.set(card.id, { card, revision });
      }
      pendingOrder ||= { ids: initial.map(card => card.id), revision };
      persist();
      await store.setDoc(deckRef, { order: pendingOrder.ids });
    } catch (error) {
      if (!stopped) report(error);
      initializing = false;
    }
  }

  const unsubscribeMetadata = store.onSnapshot(deckRef, { includeMetadataChanges: true }, snapshot => {
    if (stopped) return;
    if (!snapshot.exists()) {
      if (!snapshot.metadata.fromCache) { metadataMissing = true; initialize(); }
      return;
    }
    metadataMissing = false;
    metadataReady = true;
    remoteOrder = Array.isArray(snapshot.data().order) ? snapshot.data().order : [];
    render();
  }, error => { if (!stopped) { lastFailure = true; report(error); } });

  const unsubscribeCards = store.onSnapshot(cardsRef, { includeMetadataChanges: true }, snapshot => {
    if (stopped) return;
    try {
      remote = normalizeDeck(snapshot.docs.map(document => ({ ...document.data(), id: document.id })));
      cardsReady = !snapshot.metadata.fromCache || snapshot.docs.length > 0;
      cardsServerReady ||= !snapshot.metadata.fromCache;
      if (metadataMissing) initialize();
      render();
    } catch (error) { lastFailure = true; report(error); }
  }, error => { if (!stopped) { lastFailure = true; report(error); } });

  async function flush() {
    if (stopped || !ready || flushing || lastFailure || (!pending.size && !pendingOrder)) return;
    flushing = true;
    lastFailure = false;
    try {
      while (!stopped && (pending.size || pendingOrder)) {
        const changes = [...pending].slice(0, 450);
        const order = pendingOrder;
        const batch = store.writeBatch(db);
        for (const [id, change] of changes) {
          const ref = store.doc(cardsRef, id);
          if (change.card === null) batch.delete(ref);
          else batch.set(ref, change.card);
        }
        if (order) batch.set(deckRef, { order: order.ids });
        await batch.commit();
        for (const [id, change] of changes) {
          if (pending.get(id)?.revision === change.revision) pending.delete(id);
        }
        if (pendingOrder?.revision === order?.revision) pendingOrder = null;
        persist();
      }
      if (!stopped) showStatus('雲端詞庫已同步');
    } catch (error) {
      lastFailure = true;
      if (!stopped) report(error);
    } finally { flushing = false; }
  }

  function retry() { if (!stopped) { lastFailure = false; flush(); } }
  function offline() { if (!stopped) showStatus('離線中 · 卡片與待同步變更已保存在本機'); }
  window.addEventListener('online', retry);
  window.addEventListener('offline', offline);
  return {
    enqueue({ before, cards }) {
      if (!ready || stopped) return;
      const delta = deckChanges(before, cards);
      const revision = crypto.randomUUID();
      for (const [id, card] of delta.changes) pending.set(id, { card, revision });
      if (delta.order) pendingOrder = { ids: delta.order, revision };
      persist();
      showStatus(navigator.onLine ? '正在同步…' : '離線中 · 變更已保存在本機');
      flush();
    },
    stop() {
      stopped = true;
      unsubscribeMetadata();
      unsubscribeCards();
      window.removeEventListener('online', retry);
      window.removeEventListener('offline', offline);
    }
  };
}

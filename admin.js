import { connectGoogle, registerAccessRequest } from './firebase-client.js';
import { memberRows, filterMembers } from './member-model.mjs';

const status = document.getElementById('adminStatus');
const management = document.getElementById('management');
const list = document.getElementById('memberList');
const feedback = document.getElementById('feedback');
let cleanup = () => {};
let currentUser = null;
let client = null;
let requests = [];
let memberships = [];
let filter = 'pending';
let ready = false;
let busy = false;

function report(error) {
  status.textContent = error.code === 'permission-denied'
    ? '此帳號沒有成員管理權限。'
    : '目前無法連線，請確認網路後重新整理。';
  console.error('Member management:', error.code || error.message);
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function render() {
  const rows = memberRows(requests, memberships, currentUser?.uid);
  for (const state of ['pending', 'active', 'disabled']) {
    document.getElementById(`${state}Count`).textContent = rows.filter(row => row.status === state).length;
  }
  const visible = filterMembers(rows, filter, document.getElementById('memberSearch').value);
  list.replaceChildren();
  for (const row of visible) {
    const item = element('li', '', 'member');
    const identity = element('div', '', 'identity');
    identity.append(element('div', row.displayName || (row.email ? 'Google 帳號' : '已開通帳號'), 'name'));
    identity.append(element('div', row.email || '下次登入單字卡後顯示帳號資料', 'email small'));
    if (row.self) identity.append(element('div', '你的帳號 · 管理者', 'small'));
    const actions = element('div', '', 'actions');
    const labels = { pending: '待核准', active: '已開通', disabled: '已停用' };
    actions.append(element('span', labels[row.status], `badge ${row.status}`));
    const button = element('button', row.status === 'active' ? '停用' : row.status === 'pending' ? '核准' : '重新啟用', row.status === 'active' ? 'secondary' : 'primary');
    button.type = 'button';
    button.disabled = busy || row.self;
    button.setAttribute('aria-label', `${button.textContent} ${row.email || row.displayName || '成員'}`);
    button.addEventListener('click', () => changeMembership(row));
    actions.append(button);
    item.append(identity, actions);
    list.append(item);
  }
  const empty = document.getElementById('emptyState');
  empty.classList.toggle('hidden', visible.length > 0 || !ready);
  empty.textContent = document.getElementById('memberSearch').value.trim() ? '找不到符合的成員。' : ({ pending: '目前沒有待核准的申請。', active: '目前沒有已開通的成員。', disabled: '目前沒有已停用的成員。' })[filter];
}

async function changeMembership(row) {
  if (busy || row.self || !ready) return;
  const user = currentUser;
  const connection = client;
  if (row.status === 'active') {
    const dialog = document.getElementById('disableDialog');
    dialog.returnValue = 'cancel';
    document.getElementById('disableIdentity').textContent = row.email || row.displayName || '此成員';
    const accepted = new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
    dialog.showModal();
    if (!await accepted) return;
  }
  if (currentUser !== user || !ready) return;
  busy = true;
  feedback.textContent = '正在更新權限…';
  render();
  try {
    await connection.store.setDoc(connection.store.doc(connection.db, 'members', row.uid), { enabled: row.status !== 'active' });
    if (currentUser === user) feedback.textContent = row.status === 'active' ? '已停用，對方的卡片仍會保留。' : '已開通，對方可開始使用自己的雲端詞庫。';
  } catch (error) {
    if (currentUser === user) {
      feedback.textContent = '更新未完成，請重新整理確認權限狀態後再試一次。';
      report(error);
    }
  } finally {
    if (currentUser === user) { busy = false; render(); }
  }
}

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  render();
}));
document.getElementById('memberSearch').addEventListener('input', render);

connectGoogle({
  login: document.getElementById('googleLoginBtn'),
  logout: document.getElementById('googleLogoutBtn'),
  onError: report,
  onUser(user, connection) {
    cleanup();
    currentUser = user;
    client = connection;
    requests = [];
    memberships = [];
    ready = false;
    busy = false;
    feedback.textContent = '';
    list.replaceChildren();
    document.getElementById('disableDialog').close('cancel');
    management.classList.add('hidden');
    document.getElementById('loginPanel').classList.toggle('hidden', !!user);
    document.getElementById('accountName').textContent = user?.displayName || '';
    if (!user) { status.textContent = '請使用管理者的 Google 帳號登入。'; cleanup = () => {}; return; }
    status.textContent = '正在確認管理權限…';
    const { db, store } = connection;
    let stopped = false;
    let stopRequests = null;
    let stopMembers = null;
    let requestsReady = false;
    let membersReady = false;
    function update() {
      if (stopped || currentUser !== user) return;
      ready = requestsReady && membersReady;
      status.textContent = ready ? '管理權限已確認，可核准或停用成員。' : '正在載入成員清單…';
      render();
    }
    function fail(error) {
      if (stopped || currentUser !== user) return;
      ready = false;
      management.classList.add('hidden');
      list.replaceChildren();
      report(error);
    }
    const stopAdmin = store.onSnapshot(store.doc(db, 'admins', user.uid), snapshot => {
      if (stopped) return;
      if (snapshot.data()?.enabled !== true) {
        stopRequests?.(); stopMembers?.();
        stopRequests = stopMembers = null;
        ready = false;
        requestsReady = membersReady = false;
        requests = []; memberships = [];
        management.classList.add('hidden');
        list.replaceChildren();
        status.textContent = '此帳號沒有成員管理權限。';
        return;
      }
      management.classList.remove('hidden');
      if (!stopRequests) {
        registerAccessRequest(user, db, store).catch(error => { if (!stopped) report(error); });
        stopRequests = store.onSnapshot(store.collection(db, 'accessRequests'), result => {
          if (stopped || currentUser !== user) return;
          requests = result.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
          requestsReady = true; update();
        }, fail);
        stopMembers = store.onSnapshot(store.collection(db, 'members'), result => {
          if (stopped || currentUser !== user) return;
          memberships = result.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
          membersReady = true; update();
        }, fail);
      }
    }, fail);
    cleanup = () => { stopped = true; stopAdmin(); stopRequests?.(); stopMembers?.(); };
  }
}).catch(report);

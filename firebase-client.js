import { firebaseConfig, googleClientId } from './firebase-config.js';

export async function connectGoogle({ login, logout, onUser, onError }) {
  const [core, authApi, store] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')
  ]);
  const firebaseApp = core.initializeApp(firebaseConfig);
  const auth = authApi.getAuth(firebaseApp);
  const db = store.getFirestore(firebaseApp);
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    script.onerror = () => reject(new Error('無法載入 Google 登入服務'));
    document.head.appendChild(script);
  });
  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: async response => {
      login.style.pointerEvents = 'none';
      try {
        await authApi.signInWithCredential(auth, authApi.GoogleAuthProvider.credential(response.credential));
      } catch (error) { onError(error); }
      finally { login.style.pointerEvents = ''; }
    }
  });
  login.replaceChildren();
  google.accounts.id.renderButton(login, { type: 'standard', theme: 'outline', size: 'medium', text: 'signin_with', shape: 'pill', locale: 'zh_TW' });
  logout.addEventListener('click', () => {
    google.accounts.id.disableAutoSelect();
    authApi.signOut(auth).catch(onError);
  });
  authApi.onAuthStateChanged(auth, user => {
    login.classList.toggle('hidden', !!user);
    logout.classList.toggle('hidden', !user);
    Promise.resolve(onUser(user, { auth, db, store })).catch(onError);
  });
}

export async function registerAccessRequest(user, db, store) {
  const ref = store.doc(db, 'accessRequests', user.uid);
  await store.runTransaction(db, async transaction => {
    const request = await transaction.get(ref);
    if (!request.exists()) transaction.set(ref, {
      email: user.email,
      displayName: (user.displayName || '').slice(0, 120),
      requestedAt: store.serverTimestamp()
    });
  });
}

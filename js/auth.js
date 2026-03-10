// 登录系统
const Auth = {
  currentUser: null,

  init() {
    document.getElementById('btn-login').addEventListener('click', () => this.emailLogin());
    document.getElementById('btn-register').addEventListener('click', () => this.emailRegister());
    document.getElementById('btn-google').addEventListener('click', () => this.googleLogin());
    document.getElementById('btn-logout').addEventListener('click', () => this.logout());

    // Enter key on password field
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.emailLogin();
    });

    // 处理 Google redirect 返回结果
    auth.getRedirectResult().catch(e => {
      if (e.code) {
        document.getElementById('login-error').textContent = this._errorMsg(e.code);
      }
    });

    // 监听认证状态
    auth.onAuthStateChanged(user => {
      this.currentUser = user;
      if (user) {
        document.getElementById('user-name').textContent = user.displayName || user.email;
        Utils.switchScreen('screen-lobby');
        Lobby.init();
      } else {
        Utils.switchScreen('screen-login');
      }
    });
  },

  async emailLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';

    if (!email || !password) {
      errEl.textContent = '请输入邮箱和密码';
      return;
    }

    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (e) {
      errEl.textContent = this._errorMsg(e.code);
    }
  },

  async emailRegister() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';

    if (!email || !password) {
      errEl.textContent = '请输入邮箱和密码';
      return;
    }
    if (password.length < 6) {
      errEl.textContent = '密码至少6位';
      return;
    }

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      // 设置显示名为邮箱前缀
      await cred.user.updateProfile({
        displayName: email.split('@')[0]
      });
    } catch (e) {
      errEl.textContent = this._errorMsg(e.code);
    }
  },

  async googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      // 手机端用 redirect 更可靠（popup 容易被拦截）
      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await auth.signInWithRedirect(provider);
      } else {
        await auth.signInWithPopup(provider);
      }
    } catch (e) {
      document.getElementById('login-error').textContent = this._errorMsg(e.code);
    }
  },

  async logout() {
    // 离开当前房间
    if (Lobby.currentRoomCode) {
      await Lobby.leaveRoom();
    }
    await auth.signOut();
  },

  _errorMsg(code) {
    const msgs = {
      'auth/user-not-found': '用户不存在',
      'auth/wrong-password': '密码错误',
      'auth/email-already-in-use': '该邮箱已注册',
      'auth/weak-password': '密码太弱',
      'auth/invalid-email': '邮箱格式不正确',
      'auth/too-many-requests': '请求太频繁，请稍后再试',
    };
    return msgs[code] || '登录失败，请重试';
  }
};

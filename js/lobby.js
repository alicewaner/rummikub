// 大厅系统
const Lobby = {
  currentRoomCode: null,
  _unsubRoom: null,
  _initialized: false,
  _pendingRoomCode: null, // URL 中的房间码，等登录后处理

  init() {
    // 只绑定一次事件
    if (!this._initialized) {
      this._initialized = true;
      document.getElementById('btn-create-room').addEventListener('click', () => this.createRoom());
      document.getElementById('btn-join-room').addEventListener('click', () => this.joinRoom());
      document.getElementById('btn-start-game').addEventListener('click', () => this.startGame());
      document.getElementById('btn-leave-room').addEventListener('click', () => this.leaveRoom());
      document.getElementById('btn-share-room').addEventListener('click', () => this.shareRoom());

      // 首次初始化时检查 URL 房间码
      const params = new URLSearchParams(location.search);
      const code = params.get('room');
      if (code) {
        this._pendingRoomCode = code.toUpperCase();
        history.replaceState(null, '', location.pathname);
      }
    }

    // 每次登录后，如果有待加入的房间码就自动加入
    if (this._pendingRoomCode) {
      const code = this._pendingRoomCode;
      this._pendingRoomCode = null;
      this.joinRoomByCode(code);
    }
  },

  async createRoom() {
    const errEl = document.getElementById('lobby-error');
    errEl.textContent = '';
    const user = Auth.currentUser;
    if (!user) return;

    const code = Utils.generateRoomCode();

    try {
      await db.collection('rooms').doc(code).set({
        hostUid: user.uid,
        status: 'waiting',
        players: [{
          uid: user.uid,
          displayName: user.displayName || user.email,
          order: 0,
          ready: false
        }],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      this.currentRoomCode = code;
      this._showRoomPanel(code, true);
      this._subscribeRoom(code);
    } catch (e) {
      errEl.textContent = '创建房间失败: ' + e.message;
    }
  },

  // 通过输入框加入
  async joinRoom() {
    const code = document.getElementById('input-room-code').value.trim().toUpperCase();
    if (!code) {
      document.getElementById('lobby-error').textContent = '请输入房间码';
      return;
    }
    await this.joinRoomByCode(code);
  },

  // 通过房间码加入（核心方法）
  async joinRoomByCode(code) {
    const errEl = document.getElementById('lobby-error');
    errEl.textContent = '';

    const user = Auth.currentUser;
    if (!user) {
      errEl.textContent = '请先登录';
      return;
    }

    const roomRef = db.collection('rooms').doc(code);

    try {
      const doc = await roomRef.get();
      if (!doc.exists) {
        errEl.textContent = '房间不存在';
        return;
      }

      const data = doc.data();
      if (data.status !== 'waiting') {
        errEl.textContent = '游戏已开始';
        return;
      }

      if (data.players.length >= 4) {
        errEl.textContent = '房间已满';
        return;
      }

      // 检查是否已在房间中
      if (data.players.some(p => p.uid === user.uid)) {
        this.currentRoomCode = code;
        this._showRoomPanel(code, data.hostUid === user.uid);
        this._subscribeRoom(code);
        Utils.showToast('已在房间中');
        return;
      }

      await roomRef.update({
        players: firebase.firestore.FieldValue.arrayUnion({
          uid: user.uid,
          displayName: user.displayName || user.email,
          order: data.players.length,
          ready: false
        })
      });

      this.currentRoomCode = code;
      this._showRoomPanel(code, false);
      this._subscribeRoom(code);
      Utils.showToast('已加入房间 ' + code);
    } catch (e) {
      errEl.textContent = '加入失败: ' + e.message;
    }
  },

  async leaveRoom() {
    if (!this.currentRoomCode) return;
    const user = Auth.currentUser;
    const roomRef = db.collection('rooms').doc(this.currentRoomCode);

    try {
      const doc = await roomRef.get();
      if (doc.exists) {
        const data = doc.data();
        const remaining = data.players.filter(p => p.uid !== user.uid);

        if (remaining.length === 0) {
          await roomRef.delete();
        } else {
          const update = { players: remaining };
          if (data.hostUid === user.uid) {
            update.hostUid = remaining[0].uid;
          }
          await roomRef.update(update);
        }
      }
    } catch (e) {
      console.error('Leave room error:', e);
    }

    this._cleanup();
  },

  async startGame() {
    if (!this.currentRoomCode) return;
    const roomRef = db.collection('rooms').doc(this.currentRoomCode);
    const doc = await roomRef.get();
    const data = doc.data();

    if (data.players.length < 2) {
      Utils.showToast('至少需要2名玩家');
      return;
    }

    const pool = Utils.shuffle(Tile.createPool());
    const players = Utils.shuffle(data.players).map((p, i) => ({
      ...p,
      order: i
    }));

    const batch = db.batch();

    for (const p of players) {
      const hand = pool.splice(0, 14);
      const handRef = roomRef.collection('hands').doc(p.uid);
      batch.set(handRef, { tiles: hand });
    }

    const initialMeldDone = {};
    players.forEach(p => initialMeldDone[p.uid] = false);

    batch.update(roomRef, {
      status: 'playing',
      players: players,
      tilePool: pool,
      currentTurnIndex: 0,
      turnStartedAt: firebase.firestore.FieldValue.serverTimestamp(),
      table: [],
      tableSnapshot: [],
      initialMeldDone: initialMeldDone
    });

    await batch.commit();
  },

  shareRoom() {
    if (!this.currentRoomCode) return;
    const url = `${location.origin}${location.pathname}?room=${this.currentRoomCode}`;

    if (navigator.share) {
      navigator.share({
        title: 'Rummikub 对战',
        text: `来玩 Rummikub！房间码: ${this.currentRoomCode}`,
        url: url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        Utils.showToast('链接已复制');
      }).catch(() => {
        Utils.showToast(url);
      });
    }
  },

  _showRoomPanel(code, isHost) {
    Utils.show('room-panel');
    document.getElementById('room-code-display').textContent = code;
    const startBtn = document.getElementById('btn-start-game');
    if (isHost) {
      Utils.show(startBtn);
    } else {
      Utils.hide(startBtn);
    }
  },

  _subscribeRoom(code) {
    if (this._unsubRoom) this._unsubRoom();

    this._unsubRoom = db.collection('rooms').doc(code).onSnapshot(snap => {
      if (!snap.exists) {
        Utils.showToast('房间已解散');
        this._cleanup();
        return;
      }

      const data = snap.data();

      // 确保房间面板可见
      Utils.show('room-panel');
      document.getElementById('room-code-display').textContent = code;

      // 更新玩家列表
      const list = document.getElementById('player-list');
      list.innerHTML = '';
      data.players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.displayName;
        if (p.uid === data.hostUid) {
          const badge = document.createElement('span');
          badge.className = 'player-host-badge';
          badge.textContent = '房主';
          li.appendChild(badge);
        }
        list.appendChild(li);
      });

      // 更新房主按钮
      const isHost = data.hostUid === Auth.currentUser?.uid;
      const startBtn = document.getElementById('btn-start-game');
      if (isHost && data.players.length >= 2) {
        Utils.show(startBtn);
      } else {
        Utils.hide(startBtn);
      }

      // 游戏开始 → 进入游戏
      if (data.status === 'playing') {
        Game.start(code, data);
      }
    });
  },

  _cleanup() {
    if (this._unsubRoom) {
      this._unsubRoom();
      this._unsubRoom = null;
    }
    this.currentRoomCode = null;
    Utils.hide('room-panel');
    document.getElementById('input-room-code').value = '';
  }
};

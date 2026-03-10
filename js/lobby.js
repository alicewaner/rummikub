// 大厅系统
const Lobby = {
  currentRoomCode: null,
  _unsubRoom: null,

  init() {
    document.getElementById('btn-create-room').addEventListener('click', () => this.createRoom());
    document.getElementById('btn-join-room').addEventListener('click', () => this.joinRoom());
    document.getElementById('btn-start-game').addEventListener('click', () => this.startGame());
    document.getElementById('btn-leave-room').addEventListener('click', () => this.leaveRoom());
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

  async joinRoom() {
    const errEl = document.getElementById('lobby-error');
    errEl.textContent = '';
    const code = document.getElementById('input-room-code').value.trim().toUpperCase();
    if (!code) {
      errEl.textContent = '请输入房间码';
      return;
    }

    const user = Auth.currentUser;
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
          // 如果房主离开，转移房主
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

    // 初始化游戏
    const pool = Utils.shuffle(Tile.createPool());
    const players = Utils.shuffle(data.players).map((p, i) => ({
      ...p,
      order: i
    }));

    // 发牌：每人14张
    const hands = {};
    const batch = db.batch();

    for (const p of players) {
      const hand = pool.splice(0, 14);
      hands[p.uid] = hand;
      const handRef = roomRef.collection('hands').doc(p.uid);
      batch.set(handRef, { tiles: hand });
    }

    // 初始化首次出牌状态
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

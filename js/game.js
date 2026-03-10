// 游戏主控制器
const Game = {
  roomCode: null,
  roomData: null,
  myUid: null,
  myPlayerIndex: -1,
  isMyTurn: false,
  tableSnapshot: [],    // 回合开始时的桌面快照
  handSnapshot: [],     // 回合开始时的手牌快照
  _timeoutFired: false,
  _active: false,       // 防止重复启动
  _dragInited: false,

  start(roomCode, initialData) {
    // 防止重复启动
    if (this._active && this.roomCode === roomCode) return;
    this._active = true;

    // 停止 Lobby 的监听器，由 Game 接管
    if (Lobby._unsubRoom) {
      Lobby._unsubRoom();
      Lobby._unsubRoom = null;
    }

    this.roomCode = roomCode;
    this.roomData = initialData;
    this.myUid = Auth.currentUser.uid;
    this.myPlayerIndex = initialData.players.findIndex(p => p.uid === this.myUid);
    this._timeoutFired = false;

    Utils.switchScreen('screen-game');

    if (!this._dragInited) {
      this._dragInited = true;
      Drag.init();
    }

    // 绑定按钮
    document.getElementById('btn-sort').onclick = () => Rack.toggleSort();
    document.getElementById('btn-undo').onclick = () => this.undoTurn();
    document.getElementById('btn-end-turn').onclick = () => this.endTurn();
    document.getElementById('btn-draw').onclick = () => this.drawTile();
    document.getElementById('btn-back-lobby').onclick = () => this.backToLobby();

    // 监听房间状态
    Sync.subscribeRoom(roomCode, data => this._onRoomUpdate(data));

    // 监听自己手牌
    Sync.subscribeHand(roomCode, this.myUid, tiles => {
      this.handSnapshot = [...tiles];
      // 只在非自己回合时同步手牌，避免覆盖本地拖拽操作
      if (!this.isMyTurn) {
        Rack.setTiles(tiles);
      } else if (Rack.tiles.length === 0) {
        Rack.setTiles(tiles);
      }
    });
  },

  _onRoomUpdate(data) {
    const prevTurnIndex = this.roomData?.currentTurnIndex;
    this.roomData = data;

    // 更新当前回合玩家
    const currentPlayer = data.players[data.currentTurnIndex];
    const isMyTurn = currentPlayer?.uid === this.myUid;
    const turnChanged = prevTurnIndex !== data.currentTurnIndex;
    this.isMyTurn = isMyTurn;

    document.getElementById('current-player-name').textContent = currentPlayer?.displayName || '?';

    // 更新对手信息栏
    this._renderOpponents(data);

    // 更新桌面（从 Firestore 格式还原嵌套数组）
    const serverTable = Sync._unpackTable(data.table);
    const serverSnapshot = Sync._unpackTable(data.tableSnapshot);
    this.tableSnapshot = serverSnapshot.map(g => [...g]);
    if (turnChanged || !isMyTurn) {
      // 回合切换或别人的回合：从服务器同步桌面
      Board.setGroups(serverTable);
      // 同时同步手牌
      Rack.setTiles(this.handSnapshot);
    }

    // 更新剩余牌数
    document.getElementById('tiles-remaining').textContent = `🂠 ${data.tilePool?.length || 0}`;

    // 控制按钮状态
    this._updateButtons();

    // 计时器
    this._timeoutFired = false;
    Timer.start(data.turnStartedAt, () => this._onTimeout());

    // 游戏结束
    if (data.status === 'finished') {
      this._onGameFinished(data);
    }
  },

  _renderOpponents(data) {
    const bar = document.getElementById('opponents-bar');
    bar.innerHTML = '';

    for (const p of data.players) {
      if (p.uid === this.myUid) continue;

      const chip = document.createElement('div');
      chip.className = 'opponent-chip';
      if (data.players[data.currentTurnIndex]?.uid === p.uid) {
        chip.classList.add('active-turn');
      }

      chip.innerHTML = `
        <span>${p.displayName}</span>
        <span class="opponent-tiles-count">?张</span>
      `;
      bar.appendChild(chip);
    }
  },

  _updateButtons() {
    const endBtn = document.getElementById('btn-end-turn');
    const drawBtn = document.getElementById('btn-draw');
    const undoBtn = document.getElementById('btn-undo');

    endBtn.disabled = !this.isMyTurn;
    drawBtn.disabled = !this.isMyTurn;
    undoBtn.disabled = !this.isMyTurn;
  },

  // === 牌移动操作 ===

  moveTileToTable(tileId, source, dropTarget) {
    if (!this.isMyTurn) {
      Utils.showToast('不是你的回合');
      this._cancelAndRerender(tileId, source);
      return;
    }

    // 从来源移除
    if (source === 'rack') {
      Rack.removeTile(tileId);
    } else if (source?.type === 'table') {
      Board.removeTile(tileId);
    }

    // 添加到桌面
    if (dropTarget && dropTarget.type === 'table-group') {
      Board.insertTile(dropTarget.groupIndex, dropTarget.insertIndex, tileId);
    } else {
      // 如果桌面上有未完成的组（<3张牌），自动加入最后一个
      const lastIncomplete = Board.groups.findIndex(g => g.length < 3);
      if (lastIncomplete !== -1) {
        Board.insertTile(lastIncomplete, Board.groups[lastIncomplete].length, tileId);
      } else {
        Board.addNewGroup(tileId);
      }
    }
  },

  moveTileToRack(tileId, source) {
    if (!this.isMyTurn) {
      Utils.showToast('不是你的回合');
      this._cancelAndRerender(tileId, source);
      return;
    }

    // 只能收回自己本回合打出的牌
    const snapshotTiles = new Set(this.tableSnapshot.flat());
    if (snapshotTiles.has(tileId)) {
      Utils.showToast('不能收回之前的牌');
      this._cancelAndRerender(tileId, source);
      return;
    }

    // 从桌面移除
    if (source?.type === 'table') {
      Board.removeTile(tileId);
    }

    Rack.addTile(tileId);
  },

  cancelMove(tileId, source) {
    this._cancelAndRerender(tileId, source);
  },

  _cancelAndRerender(tileId, source) {
    // 重新渲染
    if (source === 'rack') {
      Rack.render();
    } else if (source?.type === 'table') {
      Board.render();
    }
  },

  // === 回合操作 ===

  async endTurn() {
    if (!this.isMyTurn) {
      Utils.showToast('不是你的回合');
      return;
    }

    try {
      const table = Board.groups.map(g => [...g]);
      const hand = [...Rack.tiles];

      // 检查桌面是否有改变
      const tableChanged = JSON.stringify(table) !== JSON.stringify(this.tableSnapshot);

      if (!tableChanged) {
        Utils.showToast('请出牌或摸牌');
        return;
      }

      // 验证桌面所有组合
      if (!Validation.validateTable(table)) {
        Utils.showToast('桌面存在不合法的组合');
        return;
      }

      // 检查首次出牌
      const uid = this.myUid;
      const initialDone = this.roomData.initialMeldDone?.[uid];

      if (!initialDone) {
        if (!Validation.checkInitialMeld(table, this.tableSnapshot, hand)) {
          Utils.showToast('首次出牌需要 ≥30 分（仅用手牌）');
          return;
        }
        // 标记首次出牌完成
        await Sync.markInitialMeld(this.roomCode, uid);
      }

      // 计算下一个玩家
      const nextIndex = (this.roomData.currentTurnIndex + 1) % this.roomData.players.length;

      // 检查是否赢了
      if (hand.length === 0) {
        // 赢了！
        const scores = await Scoring.calculateScores(
          this.roomCode, this.roomData.players, uid
        );
        await Sync.endTurn(this.roomCode, uid, table, hand, nextIndex);
        await Sync.finishGame(this.roomCode, uid, scores);
        return;
      }

      await Sync.endTurn(this.roomCode, uid, table, hand, nextIndex);
      Utils.showToast('回合结束');
    } catch (err) {
      console.error('endTurn error:', err);
      Utils.showToast('操作失败: ' + err.message);
    }
  },

  async drawTile() {
    if (!this.isMyTurn) return;

    try {
      const pool = this.roomData.tilePool;
      if (!pool || pool.length === 0) {
        Utils.showToast('牌池已空');
        return;
      }

      const tileId = pool[0];
      const newPool = pool.slice(1);
      const nextIndex = (this.roomData.currentTurnIndex + 1) % this.roomData.players.length;

      await Sync.drawTile(
        this.roomCode, this.myUid, tileId, newPool,
        this.handSnapshot, nextIndex,
        this.roomData.table, this.tableSnapshot
      );

      Utils.showToast('摸了一张牌');
    } catch (err) {
      console.error('drawTile error:', err);
      Utils.showToast('摸牌失败: ' + err.message);
    }
  },

  undoTurn() {
    if (!this.isMyTurn) return;

    // 把本回合出到桌面的牌收回手牌
    const snapshotTileSet = new Set(this.tableSnapshot.flat());
    const currentTableTiles = Board.groups.flat();

    // 找出本回合新出的牌
    const newTiles = currentTableTiles.filter(id => !snapshotTileSet.has(id));

    // 还原桌面
    Board.setGroups(this.tableSnapshot);

    // 把新牌加回手牌
    const currentHand = [...Rack.tiles, ...newTiles];
    Rack.setTiles(currentHand);

    Utils.showToast('已撤销本回合操作');
  },

  _onTimeout() {
    if (this._timeoutFired) return;
    this._timeoutFired = true;

    if (this.isMyTurn) {
      Utils.showToast('时间到，自动摸牌');
      this.drawTile();
    }
  },

  async _onGameFinished(data) {
    Timer.stop();

    document.getElementById('game-over-title').textContent =
      data.winnerUid === this.myUid ? '你赢了！' : '游戏结束';

    if (data.scores) {
      Scoring.renderScores(data.scores, data.winnerUid);
    }

    Utils.show('game-over-modal');
  },

  backToLobby() {
    Sync.unsubscribeAll();
    Timer.stop();
    Utils.hide('game-over-modal');
    this.roomCode = null;
    this.roomData = null;
    this._active = false;
    Lobby.currentRoomCode = null;
    Lobby._cleanup();
    Utils.switchScreen('screen-lobby');
  }
};

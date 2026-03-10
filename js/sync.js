// Firestore 同步层
const Sync = {
  _unsubRoom: null,
  _unsubHand: null,

  // 监听房间文档变化
  subscribeRoom(roomCode, callback) {
    this.unsubscribeRoom();
    this._unsubRoom = db.collection('rooms').doc(roomCode).onSnapshot(snap => {
      if (!snap.exists) return;
      callback(snap.data());
    });
  },

  // 监听自己手牌变化
  subscribeHand(roomCode, uid, callback) {
    this.unsubscribeHand();
    this._unsubHand = db.collection('rooms').doc(roomCode)
      .collection('hands').doc(uid).onSnapshot(snap => {
        if (!snap.exists) return;
        callback(snap.data().tiles);
      });
  },

  // 结束回合 — 提交桌面和手牌
  async endTurn(roomCode, uid, table, hand, nextTurnIndex) {
    const roomRef = db.collection('rooms').doc(roomCode);
    const batch = db.batch();

    const tableCopy = table.map(g => [...g]);
    batch.update(roomRef, {
      table: tableCopy,
      tableSnapshot: tableCopy.map(g => [...g]),
      currentTurnIndex: nextTurnIndex,
      turnStartedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    batch.update(roomRef.collection('hands').doc(uid), {
      tiles: hand
    });

    await batch.commit();
  },

  // 标记首次出牌完成
  async markInitialMeld(roomCode, uid) {
    await db.collection('rooms').doc(roomCode).update({
      [`initialMeldDone.${uid}`]: true
    });
  },

  // 摸牌
  async drawTile(roomCode, uid, tileId, newPool, hand, nextTurnIndex, table, tableSnapshot) {
    const roomRef = db.collection('rooms').doc(roomCode);
    const batch = db.batch();

    const snapshotCopy = tableSnapshot.map(g => [...g]);
    batch.update(roomRef, {
      tilePool: newPool,
      table: snapshotCopy,
      tableSnapshot: snapshotCopy.map(g => [...g]), // 同步更新快照
      currentTurnIndex: nextTurnIndex,
      turnStartedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    batch.update(roomRef.collection('hands').doc(uid), {
      tiles: [...hand, tileId]
    });

    await batch.commit();
  },

  // 游戏结束
  async finishGame(roomCode, winnerUid, scores) {
    await db.collection('rooms').doc(roomCode).update({
      status: 'finished',
      winnerUid: winnerUid,
      scores: scores
    });
  },

  // 取消所有监听
  unsubscribeAll() {
    this.unsubscribeRoom();
    this.unsubscribeHand();
  },

  unsubscribeRoom() {
    if (this._unsubRoom) {
      this._unsubRoom();
      this._unsubRoom = null;
    }
  },

  unsubscribeHand() {
    if (this._unsubHand) {
      this._unsubHand();
      this._unsubHand = null;
    }
  }
};

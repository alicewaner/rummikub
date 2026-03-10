// 计分系统
const Scoring = {
  // 计算每个玩家的得分
  // 赢家 = 正分（其他人手牌总值之和）
  // 输家 = 负分（自己手牌总值的负数）
  async calculateScores(roomCode, players, winnerUid) {
    const scores = {};
    let winnerBonus = 0;

    for (const p of players) {
      if (p.uid === winnerUid) {
        scores[p.uid] = { name: p.displayName, score: 0, tiles: 0 };
        continue;
      }

      // 读取手牌
      try {
        const handDoc = await db.collection('rooms').doc(roomCode)
          .collection('hands').doc(p.uid).get();

        const tiles = handDoc.exists ? handDoc.data().tiles : [];
        const penalty = tiles.reduce((sum, id) => sum + Tile.getValue(id), 0);

        scores[p.uid] = {
          name: p.displayName,
          score: -penalty,
          tiles: tiles.length
        };
        winnerBonus += penalty;
      } catch (e) {
        scores[p.uid] = { name: p.displayName, score: 0, tiles: 0 };
      }
    }

    // 赢家得分 = 其他人扣分总和
    if (scores[winnerUid]) {
      scores[winnerUid].score = winnerBonus;
    }

    return scores;
  },

  // 渲染得分面板
  renderScores(scores, winnerUid) {
    const container = document.getElementById('game-over-scores');
    container.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'score-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>玩家</th><th>剩余牌</th><th>得分</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const sorted = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);

    for (const [uid, info] of sorted) {
      const tr = document.createElement('tr');
      if (uid === winnerUid) tr.className = 'winner';
      tr.innerHTML = `
        <td>${info.name}${uid === winnerUid ? ' 🏆' : ''}</td>
        <td>${info.tiles}</td>
        <td>${info.score > 0 ? '+' : ''}${info.score}</td>
      `;
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    container.appendChild(table);
  }
};

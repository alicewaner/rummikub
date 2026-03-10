// 规则验证
const Validation = {
  // 验证单个牌组是否合法
  isValidGroup(tileIds) {
    if (!tileIds || tileIds.length < 3) return false;

    // 分离百搭和普通牌
    const jokers = tileIds.filter(id => Tile.isJoker(id));
    const normals = tileIds.filter(id => !Tile.isJoker(id));

    // 尝试同数不同色组合
    if (this._isValidSet(normals, jokers.length, tileIds.length)) return true;

    // 尝试同色顺子
    if (this._isValidRun(normals, jokers.length, tileIds.length)) return true;

    return false;
  },

  // 同数不同色 (3-4张)
  _isValidSet(normals, jokerCount, total) {
    if (total < 3 || total > 4) return false;

    // 所有普通牌数字必须相同
    const numbers = normals.map(id => Tile.getNumber(id));
    if (new Set(numbers).size > 1) return false;

    // 颜色不能重复
    const colors = normals.map(id => Tile.getColorIndex(id));
    if (new Set(colors).size !== colors.length) return false;

    return true;
  },

  // 同色顺子 (3+张)
  _isValidRun(normals, jokerCount, total) {
    if (total < 3) return false;

    // 所有普通牌必须同色
    const colors = normals.map(id => Tile.getColorIndex(id));
    if (new Set(colors).size > 1) return false;

    // 获取数字并排序
    const numbers = normals.map(id => Tile.getNumber(id)).sort((a, b) => a - b);

    // 检查是否有重复数字
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] === numbers[i - 1]) return false;
    }

    // 计算需要多少百搭来填补间隔
    if (numbers.length === 0) {
      // 全百搭, 3张以上
      return jokerCount >= 3;
    }

    let jokersNeeded = 0;
    for (let i = 1; i < numbers.length; i++) {
      jokersNeeded += numbers[i] - numbers[i - 1] - 1;
    }

    // 检查是否有足够的百搭
    if (jokersNeeded > jokerCount) return false;

    // 总长度应该等于 max - min + 1 (如果百搭用来填中间的空)
    // 或者额外百搭放在两端
    const span = numbers[numbers.length - 1] - numbers[0] + 1;
    if (span > total) return false;

    // 检查范围不超过 1-13
    const extraJokers = jokerCount - jokersNeeded;
    // 可以往前或往后延伸
    const minPossible = numbers[0] - extraJokers;
    const maxPossible = numbers[numbers.length - 1] + extraJokers;

    // 只要整个顺子在 1-13 范围内即可
    if (numbers[0] - extraJokers < 1 && numbers[numbers.length - 1] + extraJokers > 13) {
      // 两端都超了，不行
      // 但只要 total <= 13 就行
    }

    // 简单检查：总数不超过13
    if (total > 13) return false;

    return true;
  },

  // 验证桌面上所有牌组
  validateTable(table) {
    if (table.length === 0) return true;
    return table.every(group => this.isValidGroup(group));
  },

  // 计算牌组的分值
  groupValue(tileIds) {
    // 对于首次出牌，只计算非百搭牌的面值
    // 百搭取代的牌算对应面值
    if (!this.isValidGroup(tileIds)) return 0;

    const jokers = tileIds.filter(id => Tile.isJoker(id));
    const normals = tileIds.filter(id => !Tile.isJoker(id));

    if (normals.length === 0) return 0; // 不能全百搭首次出牌

    // 同数组合
    const numbers = normals.map(id => Tile.getNumber(id));
    if (new Set(numbers).size === 1) {
      return numbers[0] * tileIds.length;
    }

    // 顺子
    const sorted = normals.map(id => Tile.getNumber(id)).sort((a, b) => a - b);
    // 填补空位后计算总和
    let sum = 0;
    let jokersLeft = jokers.length;
    let current = sorted[0];

    for (let i = 0; i < sorted.length; i++) {
      while (current < sorted[i]) {
        sum += current;
        jokersLeft--;
        current++;
      }
      sum += sorted[i];
      current = sorted[i] + 1;
    }
    // 剩余百搭放末尾
    while (jokersLeft > 0) {
      sum += current;
      current++;
      jokersLeft--;
    }

    return sum;
  },

  // 检查首次出牌是否 ≥30 分
  checkInitialMeld(table, tableSnapshot, hand) {
    // 找出新加到桌面上的牌（不在 tableSnapshot 中的）
    const snapshotTiles = new Set((tableSnapshot || []).flat());
    const handSet = new Set(hand);

    // 找出本回合从手牌打出的牌所在的新组合
    let totalValue = 0;
    const newGroups = [];

    for (const group of table) {
      // 这个组里有没有从手牌打出的牌？
      const hasNewTile = group.some(id => !snapshotTiles.has(id));
      if (hasNewTile) {
        // 只计算从手牌出的牌的分值不对 — 应该计算包含手牌的整组
        // 但首次出牌只能用手牌组成组合
        // 检查组里是否全是从手牌出的
        const allFromHand = group.every(id => !snapshotTiles.has(id));
        if (allFromHand) {
          newGroups.push(group);
          totalValue += this.groupValue(group);
        } else {
          // 首次出牌不能用桌面上已有的牌
          return false;
        }
      }
    }

    return totalValue >= 30;
  }
};

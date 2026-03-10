// 牌数据模型
// 牌ID编码: 0-103 = 四色数字牌, 104-105 = 百搭
// 0-12: 蓝色 1-13 (第1副)
// 13-25: 红色 1-13 (第1副)
// 26-38: 橙色 1-13 (第1副)
// 39-51: 黑色 1-13 (第1副)
// 52-103: 第2副 (同上)
// 104-105: 百搭

const COLORS = ['blue', 'red', 'orange', 'black'];
const COLOR_LABELS = { blue: '蓝', red: '红', orange: '橙', black: '黑' };
const TOTAL_TILES = 106;

const Tile = {
  // 生成完整牌池 (0-105)
  createPool() {
    return Array.from({ length: TOTAL_TILES }, (_, i) => i);
  },

  // 是否百搭
  isJoker(id) {
    return id >= 104;
  },

  // 获取颜色
  getColor(id) {
    if (id >= 104) return 'joker';
    return COLORS[(id % 52) % 4];
  },

  // 获取数字 (1-13)
  getNumber(id) {
    if (id >= 104) return 0;
    return Math.floor((id % 52) / 4) + 1;
  },

  // 获取颜色索引 (0-3)
  getColorIndex(id) {
    if (id >= 104) return -1;
    return (id % 52) % 4;
  },

  // 获取显示文本
  getLabel(id) {
    if (id >= 104) return 'J';
    return String(this.getNumber(id));
  },

  // 获取牌的分值（用于首次出牌计算和结算）
  getValue(id) {
    if (id >= 104) return 30; // 百搭 30 分
    return this.getNumber(id);
  },

  // 创建牌的 DOM 元素
  createElement(id) {
    const div = document.createElement('div');
    div.className = 'tile';
    div.dataset.tileId = id;

    if (this.isJoker(id)) {
      div.classList.add('tile-joker');
      div.textContent = '★';
    } else {
      const color = this.getColor(id);
      div.classList.add(`tile-${color}`);
      div.textContent = this.getNumber(id);
    }

    return div;
  },

  // 牌排序比较函数（先按颜色，再按数字）
  compare(a, b) {
    if (Tile.isJoker(a) && Tile.isJoker(b)) return a - b;
    if (Tile.isJoker(a)) return 1;
    if (Tile.isJoker(b)) return -1;
    const ca = Tile.getColorIndex(a);
    const cb = Tile.getColorIndex(b);
    if (ca !== cb) return ca - cb;
    return Tile.getNumber(a) - Tile.getNumber(b);
  },

  // 按数字排序（先按数字，再按颜色）
  compareByNumber(a, b) {
    if (Tile.isJoker(a) && Tile.isJoker(b)) return a - b;
    if (Tile.isJoker(a)) return 1;
    if (Tile.isJoker(b)) return -1;
    const na = Tile.getNumber(a);
    const nb = Tile.getNumber(b);
    if (na !== nb) return na - nb;
    return Tile.getColorIndex(a) - Tile.getColorIndex(b);
  }
};

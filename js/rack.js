// 手牌管理
const Rack = {
  tiles: [],         // 当前手牌 ID 数组
  _ghostId: null,    // 拖拽时的占位牌ID

  render() {
    const container = document.getElementById('rack-tiles');
    container.innerHTML = '';

    for (const id of this.tiles) {
      if (id === this._ghostId) {
        const ghost = document.createElement('div');
        ghost.className = 'tile-ghost';
        container.appendChild(ghost);
        continue;
      }

      const el = Tile.createElement(id);
      Drag.makeDraggable(el, 'rack');
      container.appendChild(el);
    }
  },

  setTiles(tileIds) {
    this.tiles = [...tileIds];
    this.render();
  },

  addTile(id) {
    this.tiles.push(id);
    this.render();
  },

  removeTile(id) {
    const idx = this.tiles.indexOf(id);
    if (idx !== -1) {
      this.tiles.splice(idx, 1);
    }
    this.render();
  },

  addGhost(tileId) {
    this._ghostId = tileId;
    this.render();
  },

  removeGhost() {
    this._ghostId = null;
    this.render();
  },

  // 按颜色排序
  sortByColor() {
    this.tiles.sort(Tile.compare);
    this.render();
  },

  // 按数字排序
  sortByNumber() {
    this.tiles.sort(Tile.compareByNumber);
    this.render();
  },

  // 交替排序方式
  _sortMode: 'color',
  toggleSort() {
    if (this._sortMode === 'color') {
      this.sortByNumber();
      this._sortMode = 'number';
    } else {
      this.sortByColor();
      this._sortMode = 'color';
    }
  }
};

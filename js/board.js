// 桌面渲染与交互
const Board = {
  groups: [],  // 二维数组 [[tileId, ...], ...]

  render() {
    const container = document.getElementById('table-groups');
    container.innerHTML = '';

    for (let gi = 0; gi < this.groups.length; gi++) {
      const group = this.groups[gi];
      const groupEl = document.createElement('div');
      groupEl.className = 'table-group';
      groupEl.dataset.groupIndex = gi;

      // 判断合法性
      if (group.length >= 3) {
        if (Validation.isValidGroup(group)) {
          groupEl.classList.add('valid');
        } else {
          groupEl.classList.add('invalid');
        }
      } else {
        groupEl.classList.add('invalid');
      }

      for (const id of group) {
        const el = Tile.createElement(id);
        Drag.makeDraggable(el, { type: 'table', groupIndex: gi });
        groupEl.appendChild(el);
      }

      container.appendChild(groupEl);
    }

    // 新组放置区
    const newZone = document.createElement('div');
    newZone.className = 'new-group-zone';
    newZone.textContent = '+';
    container.appendChild(newZone);
  },

  setGroups(table) {
    this.groups = table.map(g => [...g]);
    this.render();
  },

  // 添加牌到新组
  addNewGroup(tileId) {
    this.groups.push([tileId]);
    this.render();
  },

  // 插入牌到指定组的指定位置
  insertTile(groupIndex, insertIndex, tileId) {
    if (groupIndex >= 0 && groupIndex < this.groups.length) {
      this.groups[groupIndex].splice(insertIndex, 0, tileId);
    }
    this.render();
  },

  // 从组中移除牌
  removeTile(tileId) {
    for (let gi = 0; gi < this.groups.length; gi++) {
      const idx = this.groups[gi].indexOf(tileId);
      if (idx !== -1) {
        this.groups[gi].splice(idx, 1);
        // 清理空组
        if (this.groups[gi].length === 0) {
          this.groups.splice(gi, 1);
        }
        this.render();
        return;
      }
    }
  },

  // 获取插入位置索引
  getInsertIndex(groupIndex, clientX) {
    const groupEl = document.querySelectorAll('.table-group')[groupIndex];
    if (!groupEl) return 0;

    const tiles = groupEl.querySelectorAll('.tile');
    for (let i = 0; i < tiles.length; i++) {
      const rect = tiles[i].getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (clientX < midX) return i;
    }
    return tiles.length;
  },

  // 显示插入位置指示器
  showInsertIndicator(groupIndex, clientX) {
    const groupEl = document.querySelectorAll('.table-group')[groupIndex];
    if (!groupEl) return;

    const insertIdx = this.getInsertIndex(groupIndex, clientX);
    const tiles = groupEl.querySelectorAll('.tile');

    // 在对应位置插入指示器
    const indicator = document.createElement('div');
    indicator.className = 'tile-drop-indicator';

    if (insertIdx < tiles.length) {
      groupEl.insertBefore(indicator, tiles[insertIdx]);
    } else {
      groupEl.appendChild(indicator);
    }
  },

  clearInsertIndicators() {
    document.querySelectorAll('.tile-drop-indicator').forEach(el => el.remove());
  }
};

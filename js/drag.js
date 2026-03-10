// 触摸拖拽引擎 (Pointer Events)
const Drag = {
  _dragging: null,     // { el, tileId, source, startX, startY, offsetX, offsetY }
  _scrollLocked: false,

  init() {
    document.addEventListener('pointermove', e => this._onMove(e), { passive: false });
    document.addEventListener('pointerup', e => this._onEnd(e));
    document.addEventListener('pointercancel', e => this._onEnd(e));
  },

  // 为牌元素绑定拖拽
  makeDraggable(el, source) {
    el.addEventListener('pointerdown', e => this._onStart(e, el, source), { passive: false });
  },

  _onStart(e, el, source) {
    // 只接受主按键 / 单指触摸
    if (e.button !== 0) return;
    e.preventDefault();

    const rect = el.getBoundingClientRect();
    const tileId = parseInt(el.dataset.tileId);

    this._dragging = {
      el,
      tileId,
      source, // 'rack' | { type: 'table', groupIndex }
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
      origWidth: rect.width,
      origHeight: rect.height
    };

    el.setPointerCapture(e.pointerId);
  },

  _onMove(e) {
    if (!this._dragging) return;
    e.preventDefault();

    const d = this._dragging;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    // 判断是否真正在拖拽（防止误触）
    if (!d.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    if (!d.moved) {
      d.moved = true;
      d.el.classList.add('dragging');
      d.el.style.width = d.origWidth + 'px';
      d.el.style.height = d.origHeight + 'px';
      this._showDropZones(true);

      // 在原位放置占位符
      if (d.source === 'rack') {
        Rack.addGhost(d.tileId);
      }
    }

    d.el.style.left = (e.clientX - d.offsetX) + 'px';
    d.el.style.top = (e.clientY - d.offsetY) + 'px';

    // 检测悬停位置
    this._checkHover(e.clientX, e.clientY);
  },

  _onEnd(e) {
    if (!this._dragging) return;
    const d = this._dragging;
    this._dragging = null;

    if (!d.moved) {
      // 没有实际拖拽，视为点击
      return;
    }

    d.el.classList.remove('dragging');
    d.el.style.left = '';
    d.el.style.top = '';
    d.el.style.width = '';
    d.el.style.height = '';

    this._showDropZones(false);
    Board.clearInsertIndicators();

    // 确定放置位置
    const dropTarget = this._getDropTarget(e.clientX, e.clientY);

    if (dropTarget) {
      if (dropTarget.type === 'table-new') {
        // 新建一组
        Game.moveTileToTable(d.tileId, d.source, null);
      } else if (dropTarget.type === 'table-group') {
        // 插入到现有组
        Game.moveTileToTable(d.tileId, d.source, dropTarget);
      } else if (dropTarget.type === 'rack') {
        // 放回手牌
        Game.moveTileToRack(d.tileId, d.source);
      }
    } else {
      // 没有有效目标，还原
      Game.cancelMove(d.tileId, d.source);
    }

    Rack.removeGhost();
  },

  _showDropZones(show) {
    const tableDropZone = document.getElementById('table-drop-zone');
    if (show) {
      tableDropZone.classList.remove('hidden');
    } else {
      tableDropZone.classList.add('hidden');
    }
  },

  _checkHover(x, y) {
    Board.clearInsertIndicators();

    // 检查是否在桌面上某个组中
    const groups = document.querySelectorAll('.table-group');
    for (let i = 0; i < groups.length; i++) {
      const rect = groups[i].getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        // 找到在组内的插入位置
        Board.showInsertIndicator(i, x);
        return;
      }
    }
  },

  _getDropTarget(x, y) {
    // 检查是否在手牌区
    const rackRect = document.getElementById('rack-area').getBoundingClientRect();
    if (y >= rackRect.top) {
      return { type: 'rack' };
    }

    // 检查是否在桌面区域
    const tableRect = document.getElementById('table-area').getBoundingClientRect();
    if (y >= tableRect.top && y <= tableRect.bottom) {
      // 检查是否在某个组上
      const groups = document.querySelectorAll('.table-group');
      for (let i = 0; i < groups.length; i++) {
        const rect = groups[i].getBoundingClientRect();
        if (x >= rect.left - 20 && x <= rect.right + 20 &&
            y >= rect.top - 10 && y <= rect.bottom + 10) {
          const insertIdx = Board.getInsertIndex(i, x);
          return { type: 'table-group', groupIndex: i, insertIndex: insertIdx };
        }
      }
      // 不在任何组上 — 新建组
      return { type: 'table-new' };
    }

    return null;
  }
};

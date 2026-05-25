/**
 * LogSystem.js
 * 负责人：成员B
 * 功能：统一日志收集、过滤、展示、导出
 */

const LogSystem = (() => {
  // -------- 内部状态 --------
  const _logs = [];           // 全量日志记录
  let _currentFilter = 'ALL'; // 当前过滤等级

  // -------- 私有方法 --------

  /** 获取格式化时间字符串 HH:MM:SS.mmm */
  function _timestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}`;
  }

  /** 创建单条日志DOM元素 */
  function _createLogLine(entry) {
    const div = document.createElement('div');
    div.className = `log-line log-${entry.level}`;
    div.dataset.level = entry.level;
    div.innerHTML = `
      <span class="log-time">${entry.time}</span>
      <span class="log-level">${entry.level}</span>
      <span class="log-msg">${entry.msg}</span>
    `;
    return div;
  }

  /** 向DOM追加一条日志并滚动到底部 */
  function _append(entry) {
    const area = document.getElementById('log-area');
    if (!area) return;

    // 根据当前过滤决定是否显示
    if (_currentFilter !== 'ALL' && entry.level !== _currentFilter) {
      return;
    }

    const line = _createLogLine(entry);
    area.appendChild(line);

    // 限制DOM节点数量，防止内存溢出
    while (area.children.length > 500) {
      area.removeChild(area.firstChild);
    }

    // 自动滚动到最新
    area.scrollTop = area.scrollHeight;
  }

  // -------- 公开API --------

  /**
   * 添加日志
   * @param {'INFO'|'WARN'|'ERROR'} level
   * @param {string} msg
   */
  function log(level, msg) {
    const entry = {
      level: level,
      msg: msg,
      time: _timestamp(),
      timestamp: Date.now()
    };
    _logs.push(entry);
    _append(entry);
  }

  // 快捷方法
  const info  = (msg) => log('INFO',  msg);
  const warn  = (msg) => log('WARN',  msg);
  const error = (msg) => log('ERROR', msg);

  /**
   * 切换过滤等级并重新渲染
   * @param {'ALL'|'INFO'|'WARN'|'ERROR'} level
   */
  function filter(level) {
    _currentFilter = level;

    // 更新按钮高亮
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === level);
    });

    // 重新渲染日志区域
    const area = document.getElementById('log-area');
    if (!area) return;
    area.innerHTML = '';

    const filtered = level === 'ALL'
      ? _logs
      : _logs.filter(e => e.level === level);

    // 只显示最近500条
    filtered.slice(-500).forEach(entry => {
      area.appendChild(_createLogLine(entry));
    });
    area.scrollTop = area.scrollHeight;
  }

  /** 清空日志 */
  function clear() {
    _logs.length = 0;
    const area = document.getElementById('log-area');
    if (area) area.innerHTML = '';
    info('日志已清空');
  }

  /**
   * 导出日志为TXT文件
   */
  function exportLog() {
    const lines = _logs.map(e => `[${e.time}] [${e.level}] ${e.msg}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `robot_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    info('日志已导出');
  }

  return { log, info, warn, error, filter, clear, export: exportLog };
})();

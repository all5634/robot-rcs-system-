/**
 * ControlPanel.js
 * 负责人：成员B
 * 功能：管理控制按钮状态、构建动作指令、对接任务调度与通信层
 *
 * 与成员A（任务规划）约定的动作枚举：
 *   walk / turn_left / turn_right / wave / squat / avoid / stop
 *
 * 与成员C（通信）约定的指令格式：
 *   { type:"command", action:"walk", params:{ speed:0.8 }, seq: 1001 }
 */

const ControlPanel = (() => {
  // -------- 内部状态 --------
  let _currentAction = null;   // 当前正在执行的动作ID
  let _actionSeq     = 1000;   // 指令序列号（单调递增）
  let _actionCount   = 0;      // 累计执行动作数
  let _taskStartTime = null;   // 当前任务开始时间
  let _taskTimer     = null;   // 任务时长计时器
  let _taskProgress  = 0;      // 任务进度 0-100

  // 指令发送回调（由Dashboard注入）
  let _sendFn = null;

  // 动作配置表
  const _actionConfig = {
    walk: {
      label:    '直线行走',
      speed:    0.8,
      duration: 5000,        // ms，仿真持续时长
      badgeTxt: 'WALKING',
      badgeCls: 'badge-info'
    },
    turn_left: {
      label:    '左转',
      speed:    0.1,
      duration: 1500,
      badgeTxt: 'TURNING-L',
      badgeCls: 'badge-info'
    },
    turn_right: {
      label:    '右转',
      speed:    0.1,
      duration: 1500,
      badgeTxt: 'TURNING-R',
      badgeCls: 'badge-info'
    },
    
    avoid: {
      label:    '视觉避障',
      speed:    0.8,
      duration: -1,          // -1 = 持续运行，由避障模块控制
      badgeTxt: 'AVOIDING',
      badgeCls: 'badge-warn'
    }
  };

  // -------- 私有方法 --------

  /** 高亮当前激活按钮 */
  function _setActiveBtn(actionId) {
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.action === actionId);
    });
  }

  /** 更新任务面板 */
  function _updateTaskPanel(cfg, status) {
    const nameEl  = document.getElementById('task-name');
    const badgeEl = document.getElementById('task-badge');
    const countEl = document.getElementById('action-count');
    if (nameEl)  nameEl.textContent  = cfg ? cfg.label + '执行中' : '待机中';
    if (badgeEl) {
      badgeEl.textContent = status || 'IDLE';
      badgeEl.className   = 'badge ' + (cfg ? cfg.badgeCls : '');
      if (!cfg) { badgeEl.style.background = 'var(--c-bg2)'; badgeEl.style.color = 'var(--c-text2)'; }
    }
    if (countEl) countEl.textContent = _actionCount;
  }

  /** 启动任务进度条 */
  function _startProgress(duration) {
    const bar = document.getElementById('task-bar');
    _taskProgress = 0;
    if (bar) bar.style.width = '0%';

    if (duration <= 0) {
      // 持续模式：进度条来回跑
      let dir = 1;
      _taskTimer = setInterval(() => {
        _taskProgress += dir * 2;
        if (_taskProgress >= 95) dir = -1;
        if (_taskProgress <= 5)  dir = 1;
        if (bar) bar.style.width = _taskProgress + '%';
      }, 60);
      return;
    }

    const step = 100 / (duration / 50);
    _taskTimer = setInterval(() => {
      _taskProgress = Math.min(100, _taskProgress + step);
      if (bar) bar.style.width = _taskProgress + '%';
      if (_taskProgress >= 100) clearInterval(_taskTimer);
    }, 50);
  }

  /** 任务时长计时 */
  function _startDurationTimer() {
    _taskStartTime = Date.now();
    const el = document.getElementById('task-duration');
    const iv = setInterval(() => {
      if (!_currentAction) { clearInterval(iv); return; }
      const sec = Math.floor((Date.now() - _taskStartTime) / 1000);
      if (el) el.textContent = sec + 's';
    }, 1000);
  }

  /** 重置任务UI */
  function _resetTask() {
    clearInterval(_taskTimer);
    _currentAction = null;
    StatusManager.setSpeed(0);
    _setActiveBtn(null);
    _updateTaskPanel(null, null);
    const bar = document.getElementById('task-bar');
    if (bar) { bar.style.width = '0%'; }
    const el = document.getElementById('task-duration');
    if (el) el.textContent = '0s';
  }

  // -------- 公开API --------

  /**
   * 初始化控制面板
   * @param {function} sendFn - 实际发送指令的函数（由Dashboard注入）
   */
  function init(sendFn) {
    _sendFn = sendFn;
    LogSystem.info('控制面板初始化完成');
  }

  /**
   * 执行动作（按钮点击触发）
   * @param {string} actionId
   */
  function executeAction(actionId) {
    const cfg = _actionConfig[actionId];
    if (!cfg) { LogSystem.error(`未知动作: ${actionId}`); return; }

    // 避障动作特殊处理
    if (actionId === 'avoid') {
      if (ObstacleAvoidance.isActive()) {
        LogSystem.warn('视觉避障已在运行中');
        return;
      }
      _currentAction = actionId;
      _actionCount++;
      _setActiveBtn(actionId);
      _updateTaskPanel(cfg, cfg.badgeTxt);
      _startProgress(-1);
      _startDurationTimer();
      StatusManager.setSpeed(cfg.speed);
      ObstacleAvoidance.start();

      // 构建并发送指令
      const cmd = {
        type:   'command',
        action: 'avoid_start',
        params: { mode: 'visual', camera: 'front' },
        seq:    ++_actionSeq
      };
      LogSystem.info(`发送指令 [seq:${cmd.seq}] action=avoid_start`);
      if (_sendFn) _sendFn(cmd);
      return;
    }

    // 普通动作
    if (_currentAction) {
      _finishAction(_currentAction, false);
    }

    _currentAction = actionId;
    _actionCount++;
    _setActiveBtn(actionId);
    _updateTaskPanel(cfg, cfg.badgeTxt);
    _startProgress(cfg.duration);
    _startDurationTimer();
    StatusManager.setSpeed(cfg.speed);

    // 构建指令
    const cmd = {
      type:   'command',
      action: actionId,
      params: { speed: cfg.speed, duration: cfg.duration / 1000 },
      seq:    ++_actionSeq
    };
    LogSystem.info(`发送指令 [seq:${cmd.seq}] action=${actionId} speed=${cfg.speed}`);
    if (_sendFn) _sendFn(cmd);

    // 仿真：duration结束后自动完成
    if (cfg.duration > 0) {
      setTimeout(() => {
        if (_currentAction === actionId) {
          _finishAction(actionId, true);
        }
      }, cfg.duration);
    }
  }

  /**
   * 动作完成回调（内部调用）
   */
  function _finishAction(actionId, success) {
    const cfg = _actionConfig[actionId];
    LogSystem.info(`${cfg ? cfg.label : actionId} 执行${success ? '完成' : '中断'}`);
    _resetTask();
  }

  /**
   * 紧急停止
   */
  function emergencyStop() {
    clearInterval(_taskTimer);

    // 停止避障
    if (ObstacleAvoidance.isActive()) {
      ObstacleAvoidance.stop();
    }

    const prev = _currentAction;
    _currentAction = null;
    StatusManager.setSpeed(0);
    StatusManager.setObstacleDist(null);
    _setActiveBtn(null);
    _updateTaskPanel(null, null);

    const bar = document.getElementById('task-bar');
    if (bar) bar.style.width = '0%';

    // 发送停止指令
    const cmd = { type: 'command', action: 'stop', params: {}, seq: ++_actionSeq, priority: 'HIGH' };
    LogSystem.warn(`紧急停止! [seq:${cmd.seq}] 中止: ${prev || '无'}`);
    if (_sendFn) _sendFn(cmd);
  }

  /**
   * 处理来自避障模块的内部指令（由ObstacleAvoidance回调）
   */
  function sendAvoidCmd(cmd) {
    cmd.seq = ++_actionSeq;
    LogSystem.info(`避障子指令 [seq:${cmd.seq}] action=${cmd.action}`);
    if (_sendFn) _sendFn(cmd);
  }

  return { init, executeAction, emergencyStop, sendAvoidCmd };
})();

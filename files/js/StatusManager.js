/**
 * StatusManager.js
 * 负责人：成员B
 * 功能：维护机器人全局状态，接收WebSocket数据并更新界面
 *
 * 与成员C约定的状态消息格式：
 * {
 *   type: "status",
 *   battery: 87,          // 电量 0-100
 *   cpu: 45,              // CPU负载 0-100
 *   speed: 0.8,           // 行走速度 m/s
 *   distance: 12.5,       // 行走里程 m
 *   obstacle_dist: 1.5,   // 前方障碍距离 m（null=无障碍）
 *   joints: {
 *     left_knee: "ok",    // "ok"|"warn"|"error"
 *     right_knee: "ok",
 *     hip: "warn",
 *     left_shoulder: "ok",
 *     right_shoulder: "ok",
 *     neck: "ok"
 *   },
 *   timestamp: 1715300000
 * }
 */

const StatusManager = (() => {
  // -------- 内部状态对象 --------
  const _state = {
    connected: false,
    battery: 87,
    cpu: 42,
    speed: 0.0,
    distance: 0.0,
    obstacleDistance: null,  // null 表示无障碍
    joints: {
      left_knee:      'ok',
      right_knee:     'ok',
      hip:            'warn',
      left_shoulder:  'ok',
      right_shoulder: 'ok',
      neck:           'ok'
    },
    lastUpdate: null
  };

  // 速度历史（用于图表）
  const _speedHistory    = new Array(30).fill(0);
  const _batteryHistory  = new Array(30).fill(87);

  // 关节中文名映射
  const _jointNames = {
    left_knee:      '左膝关节',
    right_knee:     '右膝关节',
    hip:            '髋关节',
    left_shoulder:  '左肩关节',
    right_shoulder: '右肩关节',
    neck:           '颈部舵机'
  };

  // -------- 私有更新方法 --------

  /** 更新连接状态显示 */
  function _updateConnectionUI(connected) {
    const dot   = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    if (!dot || !label) return;

    if (connected) {
      dot.className   = 'conn-dot online';
      label.textContent = '已连接 ws://192.168.1.100:8765';
    } else {
      dot.className   = 'conn-dot offline';
      label.textContent = '连接断开';
    }
  }

  /** 更新电量显示 */
  function _updateBattery(value) {
    const el  = document.getElementById('m-battery');
    const bar = document.getElementById('bar-battery');
    if (el)  el.textContent = Math.round(value);
    if (bar) {
      bar.style.width = value + '%';
      // 低电量变红
      bar.style.background = value < 20 ? '#ef4444' : value < 40 ? '#f59e0b' : '#3b82f6';
    }
  }

  /** 更新CPU显示 */
  function _updateCPU(value) {
    const el  = document.getElementById('m-cpu');
    const bar = document.getElementById('bar-cpu');
    if (el)  el.textContent = Math.round(value);
    if (bar) {
      bar.style.width = value + '%';
      bar.style.background = value > 80 ? '#ef4444' : value > 60 ? '#f59e0b' : '#22c55e';
    }
  }

  /** 更新速度和里程显示 */
  function _updateMotion(speed, distance) {
    const es = document.getElementById('m-speed');
    const ed = document.getElementById('m-distance');
    if (es) es.textContent = speed.toFixed(1);
    if (ed) ed.textContent = distance.toFixed(1);
  }

  /** 更新关节状态显示 */
  function _updateJoints(joints) {
    const container = document.getElementById('joint-list');
    if (!container) return;

    container.innerHTML = '';
    for (const [key, status] of Object.entries(joints)) {
      const name    = _jointNames[key] || key;
      const badgeCls = status === 'ok' ? 'badge-ok' : status === 'warn' ? 'badge-warn' : 'badge-err';
      const badgeTxt = status === 'ok' ? '正常' : status === 'warn' ? '微热' : '故障';
      const div = document.createElement('div');
      div.className = 'joint-row';
      div.innerHTML = `<span>${name}</span><span class="badge ${badgeCls}">${badgeTxt}</span>`;
      container.appendChild(div);
    }
  }

  /** 更新障碍物距离显示 */
  function _updateObstacleUI(dist) {
    const fill = document.getElementById('distance-fill');
    const val  = document.getElementById('distance-val');
    if (!fill || !val) return;

    if (dist === null || dist === undefined) {
      fill.style.width = '100%';
      fill.style.background = '#22c55e';
      val.textContent = '安全';
    } else {
      // 最大检测距离 3m，距离越小越危险
      const maxDist = 3.0;
      const pct = Math.min(dist / maxDist, 1) * 100;
      fill.style.width = pct + '%';
      fill.style.background = dist < 0.5 ? '#ef4444' : dist < 1.2 ? '#f59e0b' : '#22c55e';
      val.textContent = dist.toFixed(2) + 'm';
    }
  }

  // -------- 公开API --------

  /**
   * 处理来自WebSocket的状态消息（由RobotDashboard调用）
   * @param {object} data - 解析后的JSON状态对象
   */
  function onStatusMessage(data) {
    if (data.type !== 'status') return;

    // 更新内部状态
    _state.battery          = data.battery          ?? _state.battery;
    _state.cpu              = data.cpu              ?? _state.cpu;
    _state.speed            = data.speed            ?? _state.speed;
    _state.distance         = data.distance         ?? _state.distance;
    _state.obstacleDistance = data.obstacle_dist    !== undefined ? data.obstacle_dist : _state.obstacleDistance;
    _state.joints           = data.joints           ?? _state.joints;
    _state.lastUpdate       = Date.now();

    // 历史记录（滑动窗口）
    _speedHistory.push(_state.speed);
    _speedHistory.shift();
    _batteryHistory.push(_state.battery);
    _batteryHistory.shift();

    // 刷新所有UI
    _updateBattery(_state.battery);
    _updateCPU(_state.cpu);
    _updateMotion(_state.speed, _state.distance);
    _updateJoints(_state.joints);
    _updateObstacleUI(_state.obstacleDistance);
  }

  /**
   * 设置连接状态
   * @param {boolean} connected
   */
  function setConnected(connected) {
    _state.connected = connected;
    _updateConnectionUI(connected);
  }

  /**
   * 模拟更新（联调前使用）
   * 模拟随机波动数据，方便界面开发时测试
   */
  function simulateUpdate() {
    // 模拟电量缓慢下降
    _state.battery = Math.max(0, _state.battery - 0.05);
    // 模拟CPU随机波动
    _state.cpu = 30 + Math.random() * 40;
    // 模拟速度
    // (由ControlPanel驱动，这里不覆盖)

    const fakeData = {
      type:          'status',
      battery:       _state.battery,
      cpu:           _state.cpu,
      speed:         _state.speed,
      distance:      _state.distance,
      obstacle_dist: _state.obstacleDistance,
      joints:        _state.joints
    };
    onStatusMessage(fakeData);
  }

  /** 获取历史数据（供Chart.js使用） */
  function getHistory() {
    return {
      speed:   [..._speedHistory],
      battery: [..._batteryHistory]
    };
  }

  /** 获取当前速度（供外部模块读取） */
  function getSpeed()    { return _state.speed; }
  function setSpeed(v)   { _state.speed = v; }
  function getDistance() { return _state.distance; }
  function addDistance(d){ _state.distance += d; }

  /** 设置前方障碍距离 */
  function setObstacleDist(d) {
    _state.obstacleDistance = d;
    _updateObstacleUI(d);
  }

  return {
    onStatusMessage,
    setConnected,
    simulateUpdate,
    getHistory,
    getSpeed, setSpeed,
    getDistance, addDistance,
    setObstacleDist
  };
})();

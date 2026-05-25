/**
 * RobotDashboard.js
 * 负责人：成员B
 * 功能：主协调器——初始化所有模块、管理WebSocket连接、驱动图表、更新时钟
 *
 * 入口点：页面加载完成后自动运行 Dashboard.init()
 */

const Dashboard = (() => {

  // -------- WebSocket 配置 --------
  const WS_URL            = 'ws://192.168.1.100:8765';  // 与成员C约定的地址
  const WS_RECONNECT_MS   = 3000;   // 断线重连间隔
  const WS_HEARTBEAT_MS   = 5000;   // 心跳包发送间隔

  let _ws             = null;
  let _wsReconnectTimer   = null;
  let _wsHeartbeatTimer   = null;
  let _wsConnected        = false;
  let _usingMock          = false;  // 是否处于Mock模式（联调前）

  // -------- Chart.js 图表 --------
  let _chart = null;

  function _initChart() {
    const canvas = document.getElementById('chart-main');
    if (!canvas) return;

    const labels = Array.from({ length: 30 }, (_, i) => i === 29 ? 'now' : '');

    _chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label:           '速度 (m/s)',
            data:            new Array(30).fill(0),
            borderColor:     '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            borderWidth:     1.5,
            pointRadius:     0,
            tension:         0.4,
            fill:            true,
            yAxisID:         'y'
          },
          {
            label:           '电量 (%)',
            data:            new Array(30).fill(87),
            borderColor:     '#22c55e',
            backgroundColor: 'rgba(34,197,94,0.05)',
            borderWidth:     1.5,
            pointRadius:     0,
            tension:         0.4,
            fill:            true,
            yAxisID:         'y2'
          }
        ]
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        animation:           { duration: 200 },
        plugins: {
          legend: {
            labels: { color: '#7e8597', font: { size: 10 }, boxWidth: 12, padding: 10 }
          }
        },
        scales: {
          x: {
            ticks:  { color: '#4a5168', font: { size: 9 } },
            grid:   { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            type:     'linear',
            position: 'left',
            min:      0,
            max:      1.5,
            ticks:    { color: '#3b82f6', font: { size: 9 }, stepSize: 0.5 },
            grid:     { color: 'rgba(59,130,246,0.08)' },
            title:    { display: true, text: 'm/s', color: '#3b82f6', font: { size: 9 } }
          },
          y2: {
            type:     'linear',
            position: 'right',
            min:      0,
            max:      100,
            ticks:    { color: '#22c55e', font: { size: 9 }, stepSize: 25 },
            grid:     { drawOnChartArea: false },
            title:    { display: true, text: '%', color: '#22c55e', font: { size: 9 } }
          }
        }
      }
    });
  }

  /** 更新图表数据 */
  function _updateChart() {
    if (!_chart) return;
    const hist = StatusManager.getHistory();
    _chart.data.datasets[0].data = hist.speed;
    _chart.data.datasets[1].data = hist.battery;
    _chart.update('none');
  }

  // -------- 时钟 --------
  function _startClock() {
    function tick() {
      const now = new Date();
      const hh  = String(now.getHours()).padStart(2, '0');
      const mm  = String(now.getMinutes()).padStart(2, '0');
      const ss  = String(now.getSeconds()).padStart(2, '0');
      const el  = document.getElementById('topbar-time');
      if (el) el.textContent = `${hh}:${mm}:${ss}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  // -------- WebSocket --------

  function _connectWS() {
    const dot   = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    if (dot)   dot.className   = 'conn-dot connecting';
    if (label) label.textContent = '连接中...';

    try {
      _ws = new WebSocket(WS_URL);

      _ws.onopen = () => {
        _wsConnected = true;
        _usingMock   = false;
        StatusManager.setConnected(true);
        LogSystem.info(`WebSocket 连接成功: ${WS_URL}`);

        // 启动心跳包
        _wsHeartbeatTimer = setInterval(() => {
          if (_ws && _ws.readyState === WebSocket.OPEN) {
            _ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
          }
        }, WS_HEARTBEAT_MS);
      };

      _ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          _handleMessage(data);
        } catch (e) {
          LogSystem.warn('收到非JSON消息: ' + event.data);
        }
      };

      _ws.onerror = () => {
        LogSystem.warn('WebSocket 连接出错，切换到模拟模式');
        _startMockMode();
      };

      _ws.onclose = () => {
        _wsConnected = false;
        clearInterval(_wsHeartbeatTimer);
        StatusManager.setConnected(false);

        if (!_usingMock) {
          LogSystem.warn('WebSocket 断开，3秒后重连...');
          _wsReconnectTimer = setTimeout(_connectWS, WS_RECONNECT_MS);
        }
      };

    } catch (e) {
      LogSystem.warn('WebSocket 不可用，使用模拟模式');
      _startMockMode();
    }
  }

  /** 处理服务端消息分发 */
  function _handleMessage(data) {
    switch (data.type) {
      case 'status':
        StatusManager.onStatusMessage(data);
        break;
      case 'obstacle':
        LogSystem.warn(`收到障碍物上报: 距离${data.distance}m 方向${data.direction}`);
        StatusManager.setObstacleDist(data.distance);
        break;
      case 'ack':
        LogSystem.info(`指令确认 [seq:${data.seq}] 状态:${data.status}`);
        break;
      case 'heartbeat':
        // 心跳回复，不记日志
        break;
      default:
        LogSystem.info(`未知消息类型: ${data.type}`);
    }
  }

  /**
   * 发送指令（ControlPanel/ObstacleAvoidance的实际出口）
   * 真实连接时通过WebSocket，模拟模式时打印日志
   */
  function _sendCommand(cmd) {
    const json = JSON.stringify(cmd);
    if (_wsConnected && _ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(json);
    } else {
      // 模拟模式：只记日志
      LogSystem.info(`[MOCK] TX: ${json}`);
    }
  }

  // -------- Mock 模拟模式 --------

  let _mockTimer = null;

  function _startMockMode() {
    if (_usingMock) return;
    _usingMock = true;

    const dot   = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    if (dot)   dot.className   = 'conn-dot connecting';
    if (label) label.textContent = '模拟模式 (无WebSocket)';

    LogSystem.warn('已启动模拟模式 — 数据由前端模拟，不依赖底层连接');

    // 每秒推送一次模拟状态数据
    _mockTimer = setInterval(() => {
      StatusManager.simulateUpdate();
      _updateChart();
    }, 1000);
  }

  // -------- 公开API --------

  /**
   * 初始化整个系统
   */
  function init() {
    _startClock();
    _initChart();

    // 注入sendCommand到各模块
    ControlPanel.init(_sendCommand);
    ObstacleAvoidance.init(ControlPanel.sendAvoidCmd);

    // 尝试连接WebSocket，失败则自动降级到Mock
    LogSystem.info('系统启动中...');
    LogSystem.info(`尝试连接 ${WS_URL}`);
    _connectWS();

    LogSystem.info('所有模块初始化完成');
    LogSystem.info('支持动作: 直线行走 / 左转 / 右转 / 挥手 / 下蹲起立 / 视觉避障');
  }

  /**
   * 外部按钮点击入口（HTML onclick 调用）
   * @param {string} actionId
   */
  function sendAction(actionId) {
    ControlPanel.executeAction(actionId);
  }

  /**
   * 紧急停止入口
   */
  function emergencyStop() {
    ControlPanel.emergencyStop();
  }

  return { init, sendAction, emergencyStop };
})();

// -------- 页面就绪后启动 --------
document.addEventListener('DOMContentLoaded', () => {
  Dashboard.init();
});

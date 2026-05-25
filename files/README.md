# 人形机器人控制台 — 成员B 软件部分

## 项目结构

```
robot-dashboard/
├── index.html                  # 主界面入口
├── css/
│   └── style.css               # 工业风暗色主题样式
├── js/
│   ├── LogSystem.js            # 日志系统
│   ├── StatusManager.js        # 机器人状态管理
│   ├── ObstacleAvoidance.js    # 视觉避障模块（含摄像头仿真）
│   ├── ControlPanel.js         # 控制面板逻辑
│   └── RobotDashboard.js       # 主协调器（WebSocket + 图表 + 时钟）
└── ws-mock/
    └── mock-server.js          # 本地测试WebSocket模拟服务器（Node.js）
```

---

## 快速启动（两种方式）

### 方式一：纯前端模式（不需要Node）
直接用 VSCode 的 **Live Server** 插件打开 `index.html`，
系统检测不到WebSocket时会自动切换到**模拟模式**，所有数据在前端本地模拟。

### 方式二：Mock服务器模式（联调前测试）
```bash
# 安装依赖（只需一次）
npm install ws

# 启动模拟服务器
node ws-mock/mock-server.js

# 然后用 Live Server 打开 index.html
```

---

## 功能说明

### 五种动作控制
| 按钮 | action字符串 | 说明 |
|------|-------------|------|
| 直线行走 | `walk` | 速度0.8m/s，持续5秒 |
| 左转 | `turn_left` | 转向45°，速度0.1m/s |
| 右转 | `turn_right` | 转向45°，速度0.1m/s |
| 视觉避障 | `avoid` | 持续运行，见下方说明 |

### 视觉避障（ObstacleAvoidance.js）
状态机流程：
```
IDLE → DETECTING → PLANNING → AVOIDING → RESUMING → IDLE
```
每1.5秒扫描摄像头画面，检测到障碍后自动执行：
1. 规划路径（800ms）
2. 左转45°绕过（1.2s）
3. 直行2m（2.5s）
4. 右转45°对齐（1.2s）
5. 恢复直行（持续）

### WebSocket 消息格式

**接收（服务端→前端）**
```json
{ "type": "status", "battery": 87, "cpu": 45, "speed": 0.8, "distance": 12.5,
  "obstacle_dist": 1.2, "joints": {...}, "timestamp": 1715300000 }

{ "type": "obstacle", "distance": 0.8, "direction": "center", "confidence": 0.92 }

{ "type": "ack", "seq": 1001, "action": "walk", "status": "received" }
```

**发送（前端→服务端）**
```json
{ "type": "command", "action": "walk", "params": { "speed": 0.8, "duration": 5 }, "seq": 1001 }
{ "type": "command", "action": "turn_left", "params": { "angle": 45, "speed": 0.3 }, "seq": 1002 }
{ "type": "command", "action": "stop", "params": {}, "seq": 1003, "priority": "HIGH" }
{ "type": "heartbeat", "ts": 1715300000 }
```

---

## 与队友对接说明

### 与成员A（任务规划）
成员A定义动作枚举名称，本项目按钮的 `data-action` 属性与之保持一致：
`walk / turn_left / turn_right / wave / squat / avoid / stop`

### 与成员C（通信）
修改 `RobotDashboard.js` 顶部的 `WS_URL` 为实际IP和端口：
```js
const WS_URL = 'ws://192.168.1.100:8765';
```
消息格式见上方约定，若需调整请同步修改 `StatusManager.js` 的 `onStatusMessage()` 方法。

---

## 技术依赖
- Chart.js 4.4.0（CDN，无需安装）
- `ws` npm包（仅mock-server.js需要）
- 无其他框架依赖，原生HTML/CSS/JS

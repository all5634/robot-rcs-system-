// ========================
// 日志系统
// ========================

function addLog(message) {

  const logs = document.getElementById("logs");

  const time = new Date().toLocaleTimeString();

  logs.innerHTML += `
    <p>[${time}] ${message}</p>
  `;

  logs.scrollTop = logs.scrollHeight;
}

// ========================
// 发送控制指令
// ========================

function sendCommand(command) {

  addLog(`发送指令：${command}`);

  // 更新动作显示
  document.getElementById("action").innerText = command;

  // 更新机器人状态
  document.getElementById("robotState").innerText = command;

  // 后面这里可以接通信接口
  // fetch(...)
}

// ========================
// 模拟机器人状态机
// ========================

const states = [

  {
    robotState: "FORWARD",
    obstacle: "无",
    avoid: "正常前进",
    action: "直线行走"
  },

  {
    robotState: "TURN LEFT",
    obstacle: "检测到障碍物",
    avoid: "左转避障中",
    action: "左转"
  },

  {
    robotState: "AVOIDING",
    obstacle: "障碍物已绕过",
    avoid: "恢复前进",
    action: "继续前进"
  }

];

let currentIndex = 0;

// ========================
// 更新状态
// ========================

function updateStatus() {

  const state = states[currentIndex];

  // 当前动作
  document.getElementById("action").innerText =
    state.action;

  // 状态机状态
  document.getElementById("robotState").innerText =
    state.robotState;

  // 障碍物状态
  document.getElementById("obstacle").innerText =
    state.obstacle;

  // 避障状态
  document.getElementById("avoidState").innerText =
    state.avoid;

  // 模拟电量下降
  let battery =
    parseInt(
      document.getElementById("battery").innerText
    );

  battery--;

  if (battery < 60) {
    battery = 85;
  }

  document.getElementById("battery").innerText =
    battery + "%";

  // 日志输出
  addLog(`机器人状态：${state.robotState}`);

  // 下一状态
  currentIndex++;

  if (currentIndex >= states.length) {
    currentIndex = 0;
  }
}

// ========================
// 摄像头状态
// ========================

function updateCameraStatus() {

  document.getElementById("cameraStatus").innerText =
    "正常";
}

// ========================
// 初始化
// ========================

addLog("机器人系统启动");

updateCameraStatus();

// 每3秒刷新一次状态
setInterval(updateStatus, 3000);
# 🚀 快速开始指南

## 📋 当前状态

✅ 项目框架已搭建完成！

```
wealth-dashboard-v2/
├── ✅ backend-futu/       Python 富途微服务
├── ✅ backend/            NestJS 后端
├── ✅ frontend/           Next.js 前端
├── ✅ ecosystem.config.js PM2 配置
├── ✅ setup.sh            一键安装脚本
└── ✅ start-dev.sh        开发环境启动
```

---

## ⚡ 立即开始（3 步）

### 1️⃣ 安装依赖（首次运行）

```bash
cd ~/.openclaw/workspace/wealth-dashboard-v2
./setup.sh
```

这会自动安装：
- Python 虚拟环境 + 依赖
- Node 后端依赖
- Next.js 前端依赖

### 2️⃣ 配置 API Keys

```bash
nano config/secrets.json
```

填入你的配置（暂时可以先跳过，使用富途需要配置）

### 3️⃣ 启动服务

**开发模式（推荐）：**
```bash
./start-dev.sh
```

**或者使用 PM2（生产模式）：**
```bash
# 构建
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..

# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status
```

---

## 🌐 访问地址

启动后访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| 🎨 **前端** | http://localhost:3000 | 财富仪表盘 |
| ⚙️ **API** | http://localhost:3001 | NestJS 后端 |
| 📦 **富途服务** | http://localhost:8000/docs | FastAPI 文档 |

---

## 🧪 测试 API

### 健康检查

```bash
# NestJS 后端
curl http://localhost:3001

# 富途服务
curl http://localhost:8000

# 资产快照
curl http://localhost:3001/api/assets/snapshot
```

### 预期响应

```json
{
  "timestamp": 1707561600000,
  "date": "2024-02-10T14:00:00.000Z",
  "stocks": {
    "positions": [...],
    "totalValue": 100000
  },
  "funds": {
    "cash": 50000,
    "fundAssets": 30000
  },
  "total": 180000
}
```

---

## 📊 开发工作流

### 方式 1：分别启动（推荐调试时）

```bash
# 终端 1: Python 微服务
cd backend-futu
source venv/bin/activate
uvicorn main:app --reload

# 终端 2: NestJS 后端
cd backend
npm run start:dev

# 终端 3: Next.js 前端
cd frontend
npm run dev
```

### 方式 2：一键启动

```bash
./start-dev.sh
```

### 方式 3：PM2 管理

```bash
pm2 start ecosystem.config.js
pm2 logs        # 查看日志
pm2 restart all # 重启
pm2 stop all    # 停止
```

---

## 🔧 故障排查

### 问题 1：富途服务连接失败

**症状**：`Futu service unavailable`

**解决**：
1. 确保富途 OpenD 已启动（端口 11111）
2. 检查配置：`cat backend-futu/.env`
3. 查看日志：`pm2 logs futu-service`

### 问题 2：端口被占用

**症状**：`EADDRINUSE: address already in use`

**解决**：
```bash
# 查找占用端口的进程
lsof -i :3000
lsof -i :3001
lsof -i :8000

# 杀掉进程
kill -9 <PID>
```

### 问题 3：前端无法连接后端

**症状**：前端显示 "Failed to fetch"

**解决**：
1. 确认后端已启动：`curl http://localhost:3001`
2. 检查 CORS 配置：`backend/src/main.ts`
3. 查看浏览器控制台错误

---

## 🎯 下一步

现在你已经有了一个可运行的框架！接下来可以：

1. **添加加密货币数据获取**
   - 复用现有的 `crypto_fetcher.py`
   - 在 NestJS 中添加 Crypto Module

2. **添加链上资产扫描**
   - 复用现有的 `chain_scanner.py`
   - 集成 Web3 服务

3. **完善前端 UI**
   - 添加图表（Chart.js）
   - 历史趋势分析
   - 实时 WebSocket 更新

4. **数据持久化**
   - 配置 SQLite
   - 定时保存快照

---

## 📝 常用命令

```bash
# PM2 管理
pm2 list           # 列出所有服务
pm2 logs           # 查看日志
pm2 restart all    # 重启所有
pm2 stop all       # 停止所有
pm2 delete all     # 删除所有

# 开机自启
pm2 startup        # 生成启动脚本
pm2 save           # 保存当前配置

# 更新代码后
cd backend && npm run build
cd frontend && npm run build
pm2 restart all
```

---

## 💡 小贴士

1. **开发时用 `./start-dev.sh`**（支持热重载）
2. **生产时用 PM2**（自动重启、日志管理）
3. **日志查看**：`pm2 logs` 或 `./logs/` 目录
4. **数据备份**：定期备份 `data/` 目录

---

## 🆘 需要帮助？

1. 查看日志：`pm2 logs <service-name>`
2. 查看 README：`cat README.md`
3. 查看具体模块文档：
   - `backend/README.md`
   - `backend-futu/README.md`

---

**🎉 祝你使用愉快！**

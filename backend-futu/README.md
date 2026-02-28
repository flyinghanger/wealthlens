# Futu API 微服务

极简 Python 微服务，只负责富途证券 API 调用。

## 安装依赖

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 运行

### 开发模式（热重载）
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 生产模式（PM2 管理）
见项目根目录的 `ecosystem.config.js`

## API 文档

启动后访问：http://127.0.0.1:8000/docs

### 端点

- `GET /` - 健康检查
- `GET /api/positions` - 获取股票持仓
- `GET /api/funds` - 获取账户资金

## 注意事项

1. 确保富途 OpenD 已启动（端口 11111）
2. 此服务仅监听 127.0.0.1（不对外开放）
3. 仅允许本地 Node 后端（3001 端口）访问

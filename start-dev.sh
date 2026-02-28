#!/bin/bash
# 开发模式启动脚本

echo "🚀 启动 Wealth Dashboard 开发环境..."
echo ""

# 检查依赖
check_deps() {
    if ! command -v python3 &> /dev/null; then
        echo "❌ Python3 未安装"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安装"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm 未安装"
        exit 1
    fi
    
    echo "✅ 环境检查通过"
}

check_deps

# 启动 Python 微服务
echo ""
echo "📦 启动 Python 富途微服务..."
cd backend-futu
if [ ! -d "venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

uvicorn main:app --reload --host 127.0.0.1 --port 8000 &
FUTU_PID=$!
echo "✅ Python 服务已启动 (PID: $FUTU_PID, Port: 8000)"
cd ..

sleep 2

# 启动 Node 后端
echo ""
echo "⚙️  启动 NestJS 后端..."
cd backend
npm run start:dev &
NEST_PID=$!
echo "✅ NestJS 后端已启动 (PID: $NEST_PID, Port: 3001)"
cd ..

sleep 3

# 启动前端
echo ""
echo "🎨 启动 Next.js 前端..."
cd frontend
npm run dev &
NEXT_PID=$!
echo "✅ Next.js 前端已启动 (PID: $NEXT_PID, Port: 3000)"
cd ..

echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "📊 访问地址："
echo "   - 前端: http://localhost:3000"
echo "   - API:  http://localhost:3001"
echo "   - Futu: http://localhost:8000/docs"
echo ""
echo "📝 进程 ID："
echo "   - Python: $FUTU_PID"
echo "   - NestJS: $NEST_PID"
echo "   - Next.js: $NEXT_PID"
echo ""
echo "⏹️  停止服务："
echo "   kill $FUTU_PID $NEST_PID $NEXT_PID"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待
wait

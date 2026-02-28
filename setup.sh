#!/bin/bash
# 一键安装所有依赖

echo "🔧 开始安装 Wealth Dashboard 依赖..."
echo ""

# 1. Python 微服务
echo "📦 安装 Python 微服务依赖..."
cd backend-futu
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
echo "✅ Python 依赖安装完成"
cd ..

# 2. Node 后端
echo ""
echo "⚙️  安装 NestJS 后端依赖..."
cd backend
npm install
echo "✅ NestJS 依赖安装完成"
cd ..

# 3. 前端
echo ""
echo "🎨 安装 Next.js 前端依赖..."
cd frontend
npm install
echo "✅ Next.js 依赖安装完成"
cd ..

# 4. 创建配置文件
echo ""
echo "📝 创建配置文件..."
if [ ! -f "config/secrets.json" ]; then
    cp config/secrets.example.json config/secrets.json
    echo "⚠️  请编辑 config/secrets.json 填入你的 API Keys"
else
    echo "配置文件已存在"
fi

echo ""
echo "✅ 所有依赖安装完成！"
echo ""
echo "📚 下一步："
echo "   1. 编辑配置: nano config/secrets.json"
echo "   2. 启动开发: ./start-dev.sh"
echo "   3. 或使用 PM2: pm2 start ecosystem.config.js"
echo ""

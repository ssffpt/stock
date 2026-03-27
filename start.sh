#!/bin/bash
# 启动股票管理系统前后端

# 终止占用端口的进程
kill -9 $(lsof -ti :8000) 2>/dev/null
kill -9 $(lsof -ti :3000) 2>/dev/null
sleep 1

# 启动后端
cd "$(dirname "$0")/stock-backend"
./.venv/bin/python -m uvicorn main:app --reload --port 8000 &
cd ../..

# 启动前端
cd "$(dirname "$0")/stock-web-next"
npm run dev &
cd ..

echo "后端: http://localhost:8000"
echo "前端: http://localhost:3000"

# 启动命令

## 一键启动

```bash
# 终止端口占用
kill -9 $(lsof -ti :8000) 2>/dev/null
kill -9 $(lsof -ti :3000) 2>/dev/null

# 后端
cd stock-backend && .venv/bin/python -m uvicorn main:app --reload --port 8000 &

# 前端
cd stock-web-next && npm run dev &
```

## 访问地址

- 前端: http://localhost:3000
- 后端: http://localhost:8000
- API文档: http://localhost:8000/docs

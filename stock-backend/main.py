from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter

from database import init_db
from routers import delivery, cleared_position, quotes

app = FastAPI(
    title="股票复盘系统",
    description="极简股票复盘系统 API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(delivery.router)
api_v1_router.include_router(cleared_position.router)
api_v1_router.include_router(quotes.router)

app.include_router(api_v1_router)


@app.on_event("startup")
def startup_event():
    """启动时初始化数据库"""
    init_db()


@app.get("/", tags=["健康检查"])
def health_check():
    """健康检查"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

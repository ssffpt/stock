# 股票复盘系统 - 后端

基于 FastAPI + SQLAlchemy + MySQL 的极简股票复盘系统后端。

## 项目结构

```
stock-backend/
├── main.py              # FastAPI 应用入口
├── config.py            # 配置文件
├── database.py          # 数据库连接
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 模型
├── crud.py              # 数据库增删改查操作
├── requirements.txt     # 依赖包
├── routers/
│   ├── __init__.py
│   └── review.py        # 复盘记录路由
└── README.md
```

## MySQL 配置

### 1. 创建数据库

```sql
CREATE DATABASE stock_review CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 修改配置

编辑 `config.py` 或创建 `.env` 文件：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=stock_review
```

## 安装依赖

```bash
pip install -r requirements.txt
```

## 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API 文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口

### 分页查询复盘记录
```
GET /reviews
```

参数：
- `page`: 页码（默认 1）
- `page_size`: 每页数量（默认 10）
- `stock_code`: 股票代码（模糊搜索）
- `stock_name`: 股票名称（模糊搜索）
- `buy_date_start`: 买入日期开始
- `buy_date_end`: 买入日期结束
- `sell_date_start`: 卖出日期开始
- `sell_date_end`: 卖出日期结束

### 获取单条记录
```
GET /reviews/{id}
```

### 新增记录
```
POST /reviews
```

### 更新记录
```
PUT /reviews/{id}
```

### 删除记录
```
DELETE /reviews/{id}
```

## 数据表结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键自增 |
| buy_date | date | 买入日期 |
| sell_date | date | 卖出日期 |
| stock_code | varchar(20) | 股票代码 |
| stock_name | varchar(50) | 股票名称 |
| buy_price | decimal(10,3) | 买入价格 |
| sell_price | decimal(10,3) | 卖出价格 |
| quantity | int | 数量 |
| total_profit | decimal(12,2) | 总盈亏 |
| profit_ratio | decimal(8,4) | 盈亏比 |
| remark | text | 备注 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

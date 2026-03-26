# 股票复盘系统

基于 FastAPI + Next.js 的股票交易复盘管理系统。

## 项目架构

```
stock/
├── stock-backend/          # 后端服务 (Python FastAPI)
└── stock-web-next/         # 前端应用 (Next.js 16 + React 19)
```

## 技术栈

### 后端
- **框架**: FastAPI 0.109.2
- **ORM**: SQLAlchemy 2.0.25
- **数据库**: MySQL (pymysql 1.1.0)
- **验证**: Pydantic 2.6.1
- **服务器**: uvicorn 0.27.1
- **测试**: pytest 8.0.0

### 前端
- **框架**: Next.js 16.2.1 (App Router)
- **UI**: React 19.2.4
- **样式**: Tailwind CSS 4
- **Excel处理**: xlsx 0.18.5
- **语言**: TypeScript 5

## 项目结构

### stock-backend/

```
stock-backend/
├── main.py              # FastAPI 应用入口
├── config.py            # 数据库配置 (pydantic-settings)
├── database.py          # SQLAlchemy 数据库连接
├── models.py            # 数据模型定义
├── schemas.py           # Pydantic 请求/响应模型
├── crud.py              # 数据库增删改查操作
├── requirements.txt     # 依赖包
├── routers/
│   ├── __init__.py
│   ├── delivery.py          # 原始交割单 API
│   ├── cleared_position.py   # 已清仓股票统计 API
│   └── quotes.py            # 行情数据同步 API
└── tests/
    └── test_delivery.py     # 单元测试
```

### stock-web-next/

```
stock-web-next/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # 根布局
│   │   ├── globals.css          # 全局样式
│   │   ├── page.tsx             # 已清仓股票统计页面
│   │   └── original-delivery/
│   │       └── page.tsx        # 原始交割单页面
│   ├── components/
│   │   └── Sidebar.tsx         # 侧边栏导航
│   └── lib/
│       └── api.ts              # API 调用封装
├── public/                     # 静态资源
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## 数据库表结构

### original_delivery (原始交割单表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键自增 |
| trade_date | DATE | 成交日期 |
| trade_time | TIME | 成交时间 |
| stock_code | VARCHAR(20) | 股票代码 |
| stock_name | VARCHAR(50) | 股票名称 |
| trade_type | VARCHAR(10) | 交易类别（买入/卖出） |
| quantity | INT | 成交数量 |
| trade_price | DECIMAL(10,3) | 成交价格 |
| occur_amount | DECIMAL(15,2) | 发生金额 |
| deal_amount | DECIMAL(15,2) | 成交金额 |
| fee | DECIMAL(10,2) | 手续费 |
| remark | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |

### stock_daily_quote (股票日行情表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键自增 |
| stock_code | VARCHAR(20) | 股票代码 |
| stock_name | VARCHAR(50) | 股票名称 |
| trade_date | DATE | 交易日期 |
| open_price | DECIMAL(10,3) | 开盘价 |
| close_price | DECIMAL(10,3) | 收盘价 |
| high_price | DECIMAL(10,3) | 最高价 |
| low_price | DECIMAL(10,3) | 最低价 |
| volume | BIGINT | 成交量 |
| created_at | DATETIME | 创建时间 |

## API 接口

### 基础信息
- API前缀: `/api/v1`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 原始交割单接口

#### GET /api/v1/deliveries
分页查询原始交割单

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码 (默认1) |
| page_size | int | 每页数量 (默认10) |
| stock_code | string | 股票代码 (模糊搜索) |
| stock_name | string | 股票名称 (模糊搜索) |
| trade_type | string | 交易类别 (买入/卖出) |
| trade_date_start | date | 成交日期开始 |
| trade_date_end | date | 成交日期结束 |

#### POST /api/v1/deliveries
创建原始交割单

#### POST /api/v1/deliveries/batch
批量导入原始交割单 (支持 Excel)

### 已清仓股票统计接口

#### GET /api/v1/cleared-positions
分页查询已清仓周期

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码 (默认1) |
| page_size | int | 每页条数 (默认20) |
| stock_code | string | 股票代码 (模糊搜索) |
| profit_filter | string | 盈亏筛选 (all/profit/loss) |
| start_date | date | 建仓日期起 |
| end_date | date | 建仓日期止 |
| order_by | string | 排序字段 |
| order_dir | string | 排序方向 (asc/desc) |

#### GET /api/v1/cleared-positions/{stock_code}/{cycle_index}
获取某只股票某周期的明细列表

### 行情数据接口

#### POST /api/v1/quotes/sync
同步所有股票的行情数据 (东方财富API)

| 参数 | 类型 | 说明 |
|------|------|------|
| force | bool | 是否强制更新已有数据 |

#### GET /api/v1/quotes/{stock_code}
获取单只股票的行情数据

## 核心业务逻辑

### 周期切割算法
系统将每只股票的所有交割记录按时间顺序切割成完整的买卖周期：
1. 买入时增加持仓数量
2. 卖出时减少持仓数量
3. 当持仓数量归零时，标志一个周期结束

### 统计指标计算
每个已清仓周期计算以下指标：
- 建仓日期、清仓日期、持仓天数
- 买入/卖出次数、买入/卖出均价
- 买入金额、卖出金额、总盈亏
- 收益率、成本偏差 (相对开盘/收盘价)

## 环境配置

### 后端配置 (.env)
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=stock_review
```

### 前端配置
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## 启动方式

### 后端
```bash
cd stock-backend
pip install -r requirements.txt
python main.py
# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 前端
```bash
cd stock-web-next
npm install
npm run dev
```

访问 http://localhost:3000 查看应用。

# 清仓数据预计算 API 设计

## 概述

本 API 用于管理 cleared_position 预计算表的清洗操作和状态查询。

---

## 1. 清洗操作 API

### POST /cleared-positions/clean

触发增量清洗，将符合条件的的数据写入 cleared_position 表。

#### Request

```json
{
  "start_date": "2026-01-01",    // 可选，筛选交割单的起始日期
  "end_date": "2026-03-27",      // 可选，筛选交割单的结束日期
  "stock_codes": ["600519", "000858"]  // 可选，指定股票代码列表，空表示所有
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start_date | string (date) | 否 | 交割单日期范围起始，不填则不限制 |
| end_date | string (date) | 否 | 交割单日期范围结束，不填则不限制 |
| stock_codes | string[] | 否 | 股票代码列表，空数组或不传表示所有股票 |

#### Response

```json
{
  "code": 200,
  "data": {
    "success": true,
    "cleaned_count": 120,
    "cycle_count": 365,
    "message": "清洗完成，共处理 120 支股票，365 个周期"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 清洗是否成功 |
| cleaned_count | number | 处理的股票数量 |
| cycle_count | number | 更新的周期数量 |
| message | string | 状态描述信息 |

#### Error Response (4xx/5xx)

```json
{
  "code": 400,
  "message": "清洗任务正在进行中，请稍后再试"
}
```

---

## 2. 状态查询 API

### GET /cleared-positions/status

查询预计算表的当前状态。

#### Request

无参数

#### Response

```json
{
  "code": 200,
  "data": {
    "last_clean_time": "2026-03-27T10:30:00Z",
    "total_cycles": 1520,
    "stocks": ["600519", "000858", "000001"],
    "total_stocks": 150
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| last_clean_time | string (datetime) | 最后清洗时间，ISO 8601 格式 |
| total_cycles | number | 预计算表中周期总数 |
| stocks | string[] | 有预计算数据的股票代码列表（最多返回100个） |
| total_stocks | number | 有预计算数据的股票总数 |

---

## 3. 清洗历史 API

### GET /cleared-positions/clean-history

查询清洗操作的历史记录。

#### Request

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页数量，默认 10 |

#### Response

```json
{
  "code": 200,
  "data": {
    "total": 25,
    "page": 1,
    "page_size": 10,
    "list": [
      {
        "id": 1,
        "clean_time": "2026-03-27T10:30:00Z",
        "start_date": "2026-01-01",
        "end_date": "2026-03-27",
        "stock_count": 120,
        "cycle_count": 365,
        "status": "success"
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 日志ID |
| clean_time | string | 清洗时间 |
| start_date | string | 清洗起始日期 |
| end_date | string | 清洗结束日期 |
| stock_count | number | 处理的股票数 |
| cycle_count | number | 更新的周期数 |
| status | string | 状态：success/failed/running |

---

## 4. 已清仓列表查询 API（改造）

### GET /cleared-positions

分页查询已清仓周期，预计算版本。

#### Request

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页数量，默认 20 |
| stock_code | string | 否 | 股票代码模糊搜索 |
| profit_filter | string | 否 | 盈亏筛选：all/profit/loss，默认 all |
| start_date | string | 否 | 建仓日期起 |
| end_date | string | 否 | 建仓日期止 |
| order_by | string | 否 | 排序字段，默认 close_date |
| order_dir | string | 否 | 排序方向，默认 desc |

#### Response

```json
{
  "code": 200,
  "data": {
    "total": 1520,
    "page": 1,
    "page_size": 20,
    "list": [
      {
        "stock_code": "600519",
        "stock_name": "贵州茅台",
        "cycle_index": 1,
        "open_date": "2026-01-05",
        "close_date": "2026-02-20",
        "hold_days": 46,
        "total_buy_amount": 100000.00,
        "total_sell_amount": 105000.00,
        "total_buy_qty": 1000,
        "profit_loss": 5000.00,
        "profit_rate": 5.00,
        "avg_buy_price": 100.00,
        "avg_sell_price": 105.00,
        "cost_vs_open": 1.50,
        "cost_vs_close": -0.80
      }
    ]
  }
}
```

---

## 5. 已清仓明细 API（改造）

### GET /cleared-positions/detail

根据股票代码、建仓日期、清仓日期查询已清仓周期明细。

#### Request

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| stock_code | string | 是 | 股票代码 |
| open_date | string | 是 | 建仓日期 |
| close_date | string | 是 | 清仓日期 |

#### Response

```json
{
  "code": 200,
  "data": {
    "summary": {
      "stock_code": "600519",
      "stock_name": "贵州茅台",
      "cycle_index": 1,
      "open_date": "2026-01-05",
      "close_date": "2026-02-20",
      "hold_days": 46,
      "total_buy_amount": 100000.00,
      "total_sell_amount": 105000.00,
      "total_buy_qty": 1000,
      "profit_loss": 5000.00,
      "profit_rate": 5.00,
      "avg_buy_price": 100.00,
      "avg_sell_price": 105.00
    },
    "records": [
      {
        "id": 12345,
        "trade_date": "2026-01-05",
        "trade_time": "09:30:00",
        "trade_type": "买入",
        "quantity": 1000,
        "trade_price": 100.00,
        "deal_amount": 100000.00,
        "occur_amount": -100000.00,
        "fee": 50.00,
        "remark": null
      }
    ]
  }
}
```

---

## 6. 周期笔记 API

### POST /cleared-positions/notes

为指定清仓周期保存笔记。

#### Request

```json
{
  "stock_code": "600519",
  "open_date": "2026-01-05",
  "close_date": "2026-02-20",
  "notes": "## 复盘总结\n\n本次操作盈利5%，主要原因是..."
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| stock_code | string | 是 | 股票代码 |
| open_date | string (date) | 是 | 建仓日期 |
| close_date | string (date) | 是 | 清仓日期 |
| notes | string | 是 | Markdown格式的笔记内容 |

#### Response

```json
{
  "code": 200,
  "data": {
    "success": true,
    "message": "笔记已保存"
  }
}
```

---

## 7. 数据库表结构

### cleared_position 表

```sql
CREATE TABLE cleared_position (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    stock_code VARCHAR(20) NOT NULL COMMENT '股票代码',
    stock_name VARCHAR(50) NOT NULL COMMENT '股票名称',
    cycle_index INT NOT NULL COMMENT '周期序号',
    open_date DATE NOT NULL COMMENT '建仓日期',
    close_date DATE NOT NULL COMMENT '清仓日期',
    hold_days INT NOT NULL DEFAULT 0 COMMENT '持仓天数',
    total_buy_amount DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '买入总金额',
    total_sell_amount DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '卖出总金额',
    total_buy_qty INT NOT NULL DEFAULT 0 COMMENT '买入总数量',
    profit_loss DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '盈亏金额',
    profit_rate DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '收益率(%)',
    avg_buy_price DECIMAL(10,3) NOT NULL DEFAULT 0 COMMENT '买入均价',
    avg_sell_price DECIMAL(10,3) NOT NULL DEFAULT 0 COMMENT '卖出均价',
    record_ids TEXT COMMENT '原始交割单ID列表，JSON格式',
    notes TEXT COMMENT 'Markdown格式的周期笔记',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_stock_cycle (stock_code, cycle_index),
    INDEX idx_close_date (close_date),
    INDEX idx_updated_at (updated_at)
) COMMENT='已清仓周期预计算表';
```

### clean_history 表（清洗日志）

```sql
CREATE TABLE clean_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    clean_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '清洗时间',
    start_date DATE COMMENT '清洗起始日期',
    end_date DATE COMMENT '清洗结束日期',
    stock_count INT DEFAULT 0 COMMENT '处理的股票数',
    cycle_count INT DEFAULT 0 COMMENT '更新的周期数',
    status VARCHAR(20) NOT NULL DEFAULT 'success' COMMENT '状态：success/failed/running',
    error_message TEXT COMMENT '错误信息',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) COMMENT='清洗历史记录表';
```

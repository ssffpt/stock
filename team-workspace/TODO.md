# 项目状态跟踪

## 当前阶段：功能迭代完成

## 本次迭代完成内容（2026-03-27）

| 功能 | 状态 | 说明 |
|------|------|------|
| 清洗UI优化 | ✅ 完成 | 清洗按钮改为小按钮+弹窗形式 |
| cycle_index评估 | ✅ 完成 | 评估结论：保留原设计 |
| Markdown笔记功能 | ✅ 完成 | 新增笔记功能，支持Markdown编辑 |

## 里程碑

## 里程碑

| 阶段 | 状态 | 完成时间 | 备注 |
|------|------|----------|------|
| PM需求分析 | ✅ 完成 | 2026-03-27 | PRD、API设计、前端设计文档已完成 |
| 表结构设计 | ✅ 完成 | 2026-03-27 | ClearedPosition模型已定义 |
| API接口设计 | ✅ 完成 | 2026-03-27 | API设计文档已完成 |
| 前端开发 | ✅ 完成 | 2026-03-27 | CleanControl组件已完成 |
| 后端开发 | ✅ 完成 | 2026-03-27 | POST /clean, GET /status 接口已完成 |
| 技术验收 | ✅ 完成 | 2026-03-27 | 发现2个严重问题，详见验收报告 |
| 缺陷修复 | ✅ 完成 | 2026-03-27 | 已修复全部问题 |

## 后端开发完成内容

### 模型 (models.py)
- `ClearedPosition` 模型，包含：stock_code, stock_name, cycle_index, open_date, close_date, hold_days, total_buy_amount, total_sell_amount, total_buy_qty, profit_loss, profit_rate, avg_buy_price, avg_sell_price, record_ids, updated_at

### Schema (schemas.py)
- `CleanRequest`: start_date, end_date, stock_codes(可选)
- `CleanResponse`: success, cleaned_count, message
- `ClearedPositionStatus`: last_clean_time, total_cycles, stocks[]

### CRUD (crud.py)
- `clean_cleared_positions()`: 支持全量清洗、指定股票清洗、时间段清洗
- `get_cleared_positions_from_table()`: 从预计算表查询
- `get_cleared_position_status()`: 获取清洗状态

### 路由 (routers/cleared_position.py)
- `POST /cleared-positions/clean` - 执行清洗
- `GET /cleared-positions/status` - 获取状态
- `GET /cleared-positions` - 已修改为从预计算表查询并返回last_clean_time

## 最新动态
- 2026-03-27: 修复 cleared_position 表 notes 字段缺失问题
  - schema.sql 缺少 notes 列定义
  - 已执行 ALTER TABLE 添加 notes 字段
- 2026-03-27: 功能迭代完成
  1. 清洗UI优化：小按钮+弹窗交互
  2. cycle_index评估结论：保留原设计不变
  3. 新增Markdown笔记功能
- 2026-03-27: 技术验收完成，发现以下严重问题需修复：
  1. cycle_index 递增逻辑错误（crud.py:707）- 会导致重复清洗时周期号不断增加
  2. avg_sell_price 缺失计算 - 导致卖出均价始终为0
  3. 字段类型不一致（stock_name长度、total_buy_qty类型、profit_rate精度）
  4. 前端默认日期未实现"本月"选中

## 待修复问题清单
- ✅ 修复 cycle_index 递增逻辑（crud.py clean_cleared_positions）
- ✅ 添加 avg_sell_price 计算（crud.py calculate_cycle_stats）
- ✅ 统一字段定义与PRD一致（models.py）
- ✅ 修复前端默认日期为"本月"（CleanControl.tsx）

## 笔记功能
- 前端组件：支持Markdown编辑和预览
- 存储位置：cleared_position表的notes字段
- API：POST /cleared-positions/notes

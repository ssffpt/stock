-- cleared_position 表结构迁移脚本
-- 执行前请备份数据！

-- 1. 查看当前表结构
DESC cleared_position;

-- 2. 修改字段（根据修复后的模型）
ALTER TABLE cleared_position
    MODIFY stock_name VARCHAR(50) NOT NULL COMMENT '股票名称',
    MODIFY total_buy_qty INT NOT NULL COMMENT '买入总数量',
    MODIFY profit_rate DECIMAL(10, 2) NOT NULL COMMENT '收益率';

-- 3. 验证修改后的结构
DESC cleared_position;

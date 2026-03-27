-- ============================================
-- Stock Backend 数据库表结构 DDL
-- 生成时间: 2026-03-27
-- ============================================

-- 1. 原始交割单表 (original_delivery)
CREATE TABLE IF NOT EXISTS `original_delivery` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `trade_date` DATE NOT NULL COMMENT '成交日期',
    `trade_time` TIME DEFAULT NULL COMMENT '成交时间',
    `stock_code` VARCHAR(20) NOT NULL COMMENT '代码',
    `stock_name` VARCHAR(50) NOT NULL COMMENT '名称',
    `trade_type` VARCHAR(10) NOT NULL COMMENT '交易类别（买入/卖出）',
    `quantity` INT NOT NULL COMMENT '成交数量',
    `trade_price` DECIMAL(10, 3) NOT NULL COMMENT '成交价格',
    `occur_amount` DECIMAL(15, 2) NOT NULL COMMENT '发生金额',
    `deal_amount` DECIMAL(15, 2) NOT NULL COMMENT '成交金额',
    `fee` DECIMAL(10, 2) DEFAULT 0 COMMENT '费用',
    `remark` TEXT DEFAULT NULL COMMENT '备注',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_stock_trade` (`stock_name`, `trade_date`, `trade_time`),
    INDEX `idx_trade_date` (`trade_date`),
    INDEX `idx_stock_code` (`stock_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='原始交割单表';


-- 2. 股票日行情表 (stock_daily_quote)
CREATE TABLE IF NOT EXISTS `stock_daily_quote` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `stock_code` VARCHAR(20) NOT NULL COMMENT '股票代码',
    `stock_name` VARCHAR(50) DEFAULT NULL COMMENT '股票名称',
    `trade_date` DATE NOT NULL COMMENT '交易日期',
    `open_price` DECIMAL(10, 3) DEFAULT NULL COMMENT '开盘价',
    `close_price` DECIMAL(10, 3) DEFAULT NULL COMMENT '收盘价',
    `high_price` DECIMAL(10, 3) DEFAULT NULL COMMENT '最高价',
    `low_price` DECIMAL(10, 3) DEFAULT NULL COMMENT '最低价',
    `volume` BIGINT DEFAULT NULL COMMENT '成交量',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    INDEX `idx_stock_code` (`stock_code`),
    INDEX `idx_trade_date` (`trade_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='股票日行情表';


-- 3. 已清仓周期预计算表 (cleared_position)
CREATE TABLE IF NOT EXISTS `cleared_position` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `stock_code` VARCHAR(20) NOT NULL COMMENT '股票代码',
    `stock_name` VARCHAR(100) NOT NULL COMMENT '股票名称',
    `cycle_index` INT NOT NULL COMMENT '第几轮周期',
    `open_date` DATE NOT NULL COMMENT '开仓日期',
    `close_date` DATE NOT NULL COMMENT '清仓日期',
    `hold_days` INT NOT NULL COMMENT '持有天数',
    `total_buy_amount` DECIMAL(15, 2) NOT NULL COMMENT '买入总金额',
    `total_sell_amount` DECIMAL(15, 2) NOT NULL COMMENT '卖出总金额',
    `total_buy_qty` DECIMAL(15, 2) NOT NULL COMMENT '买入总数量',
    `profit_loss` DECIMAL(15, 2) NOT NULL COMMENT '盈亏金额',
    `profit_rate` DECIMAL(10, 4) NOT NULL COMMENT '收益率',
    `avg_buy_price` DECIMAL(10, 3) NOT NULL COMMENT '买入均价',
    `avg_sell_price` DECIMAL(10, 3) NOT NULL COMMENT '卖出均价',
    `record_ids` TEXT DEFAULT NULL COMMENT '对应的原始交割单ID列表JSON数组',
    `notes` TEXT DEFAULT NULL COMMENT '交易笔记，Markdown格式',
    `updated_at` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '最后清洗时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_cleared_position_stock_cycle` (`stock_code`, `cycle_index`),
    INDEX `ix_cleared_position_stock_code` (`stock_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='已清仓周期预计算表';

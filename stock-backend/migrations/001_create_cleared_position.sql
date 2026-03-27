-- 如果 cleared_position 表不存在，使用以下脚本创建
CREATE TABLE IF NOT EXISTS cleared_position (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    stock_code VARCHAR(20) NOT NULL COMMENT '股票代码',
    stock_name VARCHAR(50) NOT NULL COMMENT '股票名称',
    cycle_index INT NOT NULL COMMENT '第几轮周期',
    open_date DATE NOT NULL COMMENT '开仓日期',
    close_date DATE NOT NULL COMMENT '清仓日期',
    hold_days INT NOT NULL COMMENT '持有天数',
    total_buy_amount DECIMAL(15, 2) NOT NULL COMMENT '买入总金额',
    total_sell_amount DECIMAL(15, 2) NOT NULL COMMENT '卖出总金额',
    total_buy_qty INT NOT NULL COMMENT '买入总数量',
    profit_loss DECIMAL(15, 2) NOT NULL COMMENT '盈亏金额',
    profit_rate DECIMAL(10, 2) NOT NULL COMMENT '收益率',
    avg_buy_price DECIMAL(10, 3) NOT NULL COMMENT '买入均价',
    avg_sell_price DECIMAL(10, 3) NOT NULL COMMENT '卖出均价',
    record_ids TEXT COMMENT '对应的原始交割单ID列表JSON数组',
    notes TEXT COMMENT '交易笔记，Markdown格式',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后清洗时间',

    UNIQUE KEY uk_stock_cycle (stock_code, cycle_index),
    INDEX idx_close_date (close_date),
    INDEX idx_stock_code (stock_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='已清仓周期预计算表';

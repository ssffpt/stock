from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import Column, BigInteger, Date, String, DECIMAL, Integer, Text, DateTime, Time, Index

from database import Base


class OriginalDelivery(Base):
    """原始交割单表"""
    __tablename__ = "original_delivery"
    __table_args__ = (
        Index('uk_stock_trade', 'stock_name', 'trade_date', 'trade_time', unique=True),
        {"comment": "原始交割单表"}
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    trade_date = Column(Date, nullable=False, index=True, comment="成交日期")
    trade_time = Column(Time, nullable=True, comment="成交时间")
    stock_code = Column(String(20), nullable=False, index=True, comment="代码")
    stock_name = Column(String(50), nullable=False, comment="名称")
    trade_type = Column(String(10), nullable=False, comment="交易类别（买入/卖出）")
    quantity = Column(Integer, nullable=False, comment="成交数量")
    trade_price = Column(DECIMAL(10, 3), nullable=False, comment="成交价格")
    occur_amount = Column(DECIMAL(15, 2), nullable=False, comment="发生金额")
    deal_amount = Column(DECIMAL(15, 2), nullable=False, comment="成交金额")
    fee = Column(DECIMAL(10, 2), default=0, comment="费用")
    remark = Column(Text, nullable=True, comment="备注")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")


class StockDailyQuote(Base):
    """股票日行情表"""
    __tablename__ = "stock_daily_quote"
    __table_args__ = {"comment": "股票日行情表"}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stock_code = Column(String(20), nullable=False, index=True, comment="股票代码")
    stock_name = Column(String(50), nullable=True, comment="股票名称")
    trade_date = Column(Date, nullable=False, index=True, comment="交易日期")
    open_price = Column(DECIMAL(10, 3), nullable=True, comment="开盘价")
    close_price = Column(DECIMAL(10, 3), nullable=True, comment="收盘价")
    high_price = Column(DECIMAL(10, 3), nullable=True, comment="最高价")
    low_price = Column(DECIMAL(10, 3), nullable=True, comment="最低价")
    volume = Column(BigInteger, nullable=True, comment="成交量")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")


class ClearedPosition(Base):
    """已清仓周期预计算表"""
    __tablename__ = "cleared_position"
    __table_args__ = (
        Index('uk_cleared_position_stock_cycle', 'stock_code', 'cycle_index', unique=True),
        {"comment": "已清仓周期预计算表"}
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stock_code = Column(String(20), nullable=False, index=True, comment="股票代码")
    stock_name = Column(String(50), nullable=False, comment="股票名称")
    cycle_index = Column(Integer, nullable=False, comment="第几轮周期")
    open_date = Column(Date, nullable=False, comment="开仓日期")
    close_date = Column(Date, nullable=False, comment="清仓日期")
    hold_days = Column(Integer, nullable=False, comment="持有天数")
    total_buy_amount = Column(DECIMAL(15, 2), nullable=False, comment="买入总金额")
    total_sell_amount = Column(DECIMAL(15, 2), nullable=False, comment="卖出总金额")
    total_buy_qty = Column(Integer, nullable=False, comment="买入总数量")
    profit_loss = Column(DECIMAL(15, 2), nullable=False, comment="盈亏金额")
    profit_rate = Column(DECIMAL(10, 2), nullable=False, comment="收益率")
    avg_buy_price = Column(DECIMAL(10, 3), nullable=False, comment="买入均价")
    avg_sell_price = Column(DECIMAL(10, 3), nullable=False, comment="卖出均价")
    record_ids = Column(Text, nullable=True, comment="对应的原始交割单ID列表JSON数组")
    notes = Column(Text, nullable=True, comment="交易笔记，Markdown格式")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="最后清洗时间")

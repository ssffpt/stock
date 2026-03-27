from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


# ============== 原始交割单 Schema ==============

class OriginalDeliveryBase(BaseModel):
    """原始交割单基础模型"""
    trade_date: date
    trade_time: Optional[time] = None
    stock_code: str
    stock_name: str
    trade_type: str
    quantity: int
    trade_price: Decimal
    occur_amount: Decimal
    deal_amount: Decimal
    fee: Optional[Decimal] = Decimal("0")
    remark: Optional[str] = None


class OriginalDeliveryCreate(OriginalDeliveryBase):
    """创建原始交割单"""
    pass


class OriginalDeliveryBatchCreate(BaseModel):
    """批量创建原始交割单"""
    items: List[OriginalDeliveryCreate]


class OriginalDeliveryResponse(OriginalDeliveryBase):
    """原始交割单响应模型"""
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OriginalDeliveryPaginatedResponse(BaseModel):
    """原始交割单分页响应"""
    total: int
    page: int
    page_size: int
    items: List[OriginalDeliveryResponse]


# ============== 已清仓股票统计 Schema ==============

class ClearedPositionBase(BaseModel):
    """已清仓周期基础模型"""
    stock_code: str
    stock_name: str
    cycle_index: int
    open_date: date
    close_date: date
    hold_days: int
    total_buy_amount: Decimal
    total_sell_amount: Decimal
    total_buy_qty: int
    profit_loss: Decimal
    profit_rate: Decimal
    avg_buy_price: Decimal
    cost_vs_open: Optional[Decimal] = None
    cost_vs_close: Optional[Decimal] = None


class ClearedPositionResponse(ClearedPositionBase):
    """已清仓周期响应模型"""
    model_config = ConfigDict(from_attributes=True)


class ClearedPositionPaginatedResponse(BaseModel):
    """已清仓周期分页响应"""
    total: int
    page: int
    page_size: int
    list: List[ClearedPositionResponse]


class ClearedPositionDetailRecord(BaseModel):
    """已清仓周期明细记录"""
    id: int
    trade_date: date
    trade_time: Optional[time] = None
    trade_type: str
    quantity: int
    trade_price: Decimal
    deal_amount: Decimal
    occur_amount: Decimal
    fee: Optional[Decimal] = None
    remark: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ClearedPositionDetailResponse(BaseModel):
    """已清仓周期明细响应"""
    summary: ClearedPositionBase
    records: List[ClearedPositionDetailRecord]


# ============== 清洗相关 Schema ==============

class CleanRequest(BaseModel):
    """清洗请求模型"""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    stock_codes: Optional[List[str]] = None


class CleanResponse(BaseModel):
    """清洗响应模型"""
    success: bool
    cleaned_count: int
    message: str


class ClearedPositionResponse(BaseModel):
    """已清仓周期响应模型（预计算表）"""
    id: int
    stock_code: str
    stock_name: str
    cycle_index: int
    open_date: date
    close_date: date
    hold_days: int
    total_buy_amount: Decimal
    total_sell_amount: Decimal
    total_buy_qty: int
    profit_loss: Decimal
    profit_rate: Decimal
    avg_buy_price: Decimal
    avg_sell_price: Decimal
    record_ids: Optional[str] = None
    notes: Optional[str] = None
    updated_at: datetime
    cost_vs_open: Optional[Decimal] = None
    cost_vs_close: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)


class ClearedPositionStatus(BaseModel):
    """已清仓周期状态模型"""
    last_clean_time: Optional[datetime] = None
    total_cycles: int


class UpdateNotesRequest(BaseModel):
    """更新笔记请求模型"""
    stock_code: str
    open_date: date
    close_date: date
    notes: Optional[str] = None


class UpdateNotesResponse(BaseModel):
    """更新笔记响应模型"""
    success: bool
    message: str


# ============== 股票日行情 Schema ==============

class StockDailyQuoteBase(BaseModel):
    """股票日行情基础模型"""
    stock_code: str
    stock_name: Optional[str] = None
    trade_date: date
    open_price: Optional[Decimal] = None
    close_price: Optional[Decimal] = None
    high_price: Optional[Decimal] = None
    low_price: Optional[Decimal] = None
    volume: Optional[int] = None


class StockDailyQuoteCreate(StockDailyQuoteBase):
    """创建股票日行情"""
    pass


class StockDailyQuoteResponse(StockDailyQuoteBase):
    """股票日行情响应模型"""
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

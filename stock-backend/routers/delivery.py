from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from schemas import (
    OriginalDeliveryCreate,
    OriginalDeliveryBatchCreate,
    OriginalDeliveryResponse,
    OriginalDeliveryPaginatedResponse,
)
import crud

router = APIRouter(prefix="/deliveries", tags=["原始交割单"])


@router.get("")
def get_deliveries(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    stock_code: Optional[str] = Query(None, description="股票代码"),
    stock_name: Optional[str] = Query(None, description="股票名称"),
    trade_type: Optional[str] = Query(None, description="交易类别（买入/卖出）"),
    trade_date_start: Optional[date] = Query(None, description="成交日期开始"),
    trade_date_end: Optional[date] = Query(None, description="成交日期结束"),
    db: Session = Depends(get_db),
):
    """分页查询原始交割单"""
    items, total = crud.get_deliveries(
        db=db,
        page=page,
        page_size=page_size,
        stock_code=stock_code,
        stock_name=stock_name,
        trade_type=trade_type,
        trade_date_start=trade_date_start,
        trade_date_end=trade_date_end,
    )

    return {
        "code": 200,
        "data": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": [
                {
                    "id": item.id,
                    "trade_date": item.trade_date.isoformat() if item.trade_date else None,
                    "trade_time": item.trade_time.isoformat() if item.trade_time else None,
                    "stock_code": item.stock_code,
                    "stock_name": item.stock_name,
                    "trade_type": item.trade_type,
                    "quantity": item.quantity,
                    "trade_price": str(item.trade_price) if item.trade_price else "0",
                    "occur_amount": str(item.occur_amount) if item.occur_amount else "0",
                    "deal_amount": str(item.deal_amount) if item.deal_amount else "0",
                    "fee": str(item.fee) if item.fee else "0",
                    "remark": item.remark,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                }
                for item in items
            ],
        }
    }


@router.post("", status_code=201)
def create_delivery(delivery: OriginalDeliveryCreate, db: Session = Depends(get_db)):
    """创建原始交割单"""
    item = crud.create_delivery(db, delivery)
    return {
        "code": 200,
        "data": {
            "id": item.id,
            "trade_date": item.trade_date.isoformat() if item.trade_date else None,
            "trade_time": item.trade_time.isoformat() if item.trade_time else None,
            "stock_code": item.stock_code,
            "stock_name": item.stock_name,
            "trade_type": item.trade_type,
            "quantity": item.quantity,
            "trade_price": str(item.trade_price) if item.trade_price else "0",
            "occur_amount": str(item.occur_amount) if item.occur_amount else "0",
            "deal_amount": str(item.deal_amount) if item.deal_amount else "0",
            "fee": str(item.fee) if item.fee else "0",
            "remark": item.remark,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
    }


@router.post("/batch", status_code=201)
def create_deliveries_batch(
    batch: OriginalDeliveryBatchCreate,
    db: Session = Depends(get_db)
):
    """批量导入原始交割单"""
    deliveries = crud.create_deliveries_batch(db, batch.items)
    return {
        "code": 200,
        "data": [
            {
                "id": item.id,
                "trade_date": item.trade_date.isoformat() if item.trade_date else None,
                "trade_time": item.trade_time.isoformat() if item.trade_time else None,
                "stock_code": item.stock_code,
                "stock_name": item.stock_name,
                "trade_type": item.trade_type,
                "quantity": item.quantity,
                "trade_price": str(item.trade_price) if item.trade_price else "0",
                "occur_amount": str(item.occur_amount) if item.occur_amount else "0",
                "deal_amount": str(item.deal_amount) if item.deal_amount else "0",
                "fee": str(item.fee) if item.fee else "0",
                "remark": item.remark,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in deliveries
        ],
    }

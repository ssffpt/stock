from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
import crud

router = APIRouter(prefix="/cleared-positions", tags=["已清仓股票统计"])


@router.get("")
def get_cleared_positions(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    stock_code: Optional[str] = Query(None, description="股票代码模糊搜索"),
    profit_filter: str = Query("all", description="盈亏筛选：all/profit/loss"),
    start_date: Optional[date] = Query(None, description="建仓日期起"),
    end_date: Optional[date] = Query(None, description="建仓日期止"),
    order_by: str = Query("close_date", description="排序字段"),
    order_dir: str = Query("desc", description="排序方向"),
    db: Session = Depends(get_db),
):
    """分页查询所有已清仓的买卖周期"""
    # 验证 profit_filter
    if profit_filter not in ("all", "profit", "loss"):
        raise HTTPException(status_code=400, detail="profit_filter 必须是 all/profit/loss 之一")

    # 验证 order_by
    valid_order_by = ("close_date", "profit_loss", "profit_rate", "hold_days", "open_date")
    if order_by not in valid_order_by:
        raise HTTPException(status_code=400, detail=f"order_by 必须是 {valid_order_by} 之一")

    # 验证 order_dir
    if order_dir not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="order_dir 必须是 asc 或 desc")

    items, total = crud.get_cleared_positions(
        db=db,
        page=page,
        page_size=page_size,
        stock_code=stock_code,
        profit_filter=profit_filter,
        start_date=start_date,
        end_date=end_date,
        order_by=order_by,
        order_dir=order_dir,
    )

    return {
        "code": 200,
        "data": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "list": items,
        }
    }


@router.get("/detail")
def get_cleared_position_detail(
    stock_code: str = Query(..., description="股票代码"),
    open_date: date = Query(..., description="建仓日期"),
    close_date: date = Query(..., description="清仓日期"),
    db: Session = Depends(get_db),
):
    """根据股票代码、建仓日期、清仓日期查询已清仓周期明细"""
    result = crud.get_cleared_position_by_dates(
        db=db,
        stock_code=stock_code,
        open_date=open_date,
        close_date=close_date,
    )

    if result is None:
        raise HTTPException(status_code=404, detail=f"股票 {stock_code} 在 {open_date} 到 {close_date} 之间的已清仓周期不存在")

    summary, records = result

    return {
        "code": 200,
        "data": {
            "summary": summary,
            "records": records,
        }
    }

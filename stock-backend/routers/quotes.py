import requests
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.dialects.mysql import insert
from sqlalchemy import func

from database import get_db
from models import OriginalDelivery, StockDailyQuote
from schemas import StockDailyQuoteCreate

router = APIRouter(prefix="/quotes", tags=["行情数据同步"])


def get_all_stock_codes_with_start_date(db: Session) -> List[Dict[str, Any]]:
    """获取所有出现过的股票代码及其最早交易日期"""
    result = db.query(
        OriginalDelivery.stock_code,
        OriginalDelivery.stock_name,
        func.min(OriginalDelivery.trade_date).label('start_date')
    ).group_by(
        OriginalDelivery.stock_code,
        OriginalDelivery.stock_name
    ).all()

    return [
        {
            'stock_code': r.stock_code,
            'stock_name': r.stock_name,
            'start_date': r.start_date
        }
        for r in result
    ]


def fetch_stock_daily_quote(stock_code: str, trade_date: date) -> Optional[Dict[str, Any]]:
    """
    从免费行情API获取单只股票单日行情数据
    使用东方财富API
    """
    try:
        # 东方财富行情接口
        url = "http://push2his.eastmoney.com/api/qt/stock/kline/get"
        params = {
            "secid": f"1.{stock_code}" if not stock_code.startswith('6') else f"1.{stock_code}",
            "fields1": "f1,f2,f3,f4,f5,f6",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
            "klt": "101",  # 日K线
            "fqt": "1",    # 前复权
            "beg": trade_date.strftime("%Y%m%d"),
            "end": trade_date.strftime("%Y%m%d"),
        }

        response = requests.get(url, params=params, timeout=10)
        if response.status_code != 200:
            return None

        data = response.json()
        if data.get('data') and data['data'].get('klines'):
            kline = data['data']['klines'][0].split(',')
            # kline格式: 日期,开盘,收盘,最高,最低,成交量,成交额,...
            return {
                'trade_date': datetime.strptime(kline[0], '%Y-%m-%d').date(),
                'open_price': kline[1],
                'close_price': kline[2],
                'high_price': kline[3],
                'low_price': kline[4],
                'volume': kline[5],
            }
    except Exception as e:
        print(f"获取股票 {stock_code} {trade_date} 行情失败: {e}")

    return None


def fetch_stock_ohlcv(stock_code: str, start_date: date, end_date: date) -> List[Dict[str, Any]]:
    """
    获取股票一段日期范围内的OHLCV数据
    """
    result = []
    current_date = start_date

    while current_date <= end_date:
        quote = fetch_stock_daily_quote(stock_code, current_date)
        if quote:
            result.append(quote)
        current_date += timedelta(days=1)

    return result


@router.post("/sync")
def sync_quotes(
    force: bool = Query(False, description="是否强制更新已有数据"),
    db: Session = Depends(get_db),
):
    """
    同步所有股票的行情数据
    从每只股票最早交易日期开始，抓取每日行情数据
    """
    # 获取所有股票代码及起始日期
    stocks = get_all_stock_codes_with_start_date(db)

    if not stocks:
        return {
            "code": 200,
            "data": {
                "message": "没有找到任何股票数据",
                "synced_count": 0,
            }
        }

    total_synced = 0
    end_date = date.today()

    for stock in stocks:
        stock_code = stock['stock_code']
        stock_name = stock['stock_name']
        start_date = stock['start_date']

        # 跳过已完全同步的股票
        existing_count = db.query(StockDailyQuote).filter(
            StockDailyQuote.stock_code == stock_code
        ).count()

        if not force and existing_count > 0:
            continue

        # 获取OHLCV数据
        quotes = fetch_stock_ohlcv(stock_code, start_date, end_date)

        # 批量插入/更新
        for quote in quotes:
            stmt = insert(StockDailyQuote).values(
                stock_code=stock_code,
                stock_name=stock_name,
                trade_date=quote['trade_date'],
                open_price=quote.get('open_price'),
                close_price=quote.get('close_price'),
                high_price=quote.get('high_price'),
                low_price=quote.get('low_price'),
                volume=quote.get('volume'),
            )

            if force:
                # ON DUPLICATE KEY UPDATE 更新所有字段
                stmt = stmt.values(
                    stock_code=stock_code,
                    stock_name=stock_name,
                    trade_date=quote['trade_date'],
                    open_price=quote.get('open_price'),
                    close_price=quote.get('close_price'),
                    high_price=quote.get('high_price'),
                    low_price=quote.get('low_price'),
                    volume=quote.get('volume'),
                ).prefix_with('IGNORE' if not force else '')

            try:
                db.execute(stmt)
            except Exception as e:
                print(f"插入股票 {stock_code} {quote['trade_date']} 行情失败: {e}")

        db.commit()
        total_synced += len(quotes)

    return {
        "code": 200,
        "data": {
            "message": "行情同步完成",
            "total_stocks": len(stocks),
            "synced_count": total_synced,
        }
    }

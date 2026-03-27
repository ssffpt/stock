from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Tuple, Dict, Any
import json

from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session

from models import OriginalDelivery, StockDailyQuote, ClearedPosition
from schemas import OriginalDeliveryCreate


# ============== 原始交割单 CRUD ==============

def create_delivery(db: Session, delivery: OriginalDeliveryCreate) -> OriginalDelivery:
    """创建原始交割单"""
    db_delivery = OriginalDelivery(
        trade_date=delivery.trade_date,
        trade_time=delivery.trade_time,
        stock_code=delivery.stock_code,
        stock_name=delivery.stock_name,
        trade_type=delivery.trade_type,
        quantity=delivery.quantity,
        trade_price=delivery.trade_price,
        occur_amount=delivery.occur_amount,
        deal_amount=delivery.deal_amount,
        fee=delivery.fee or Decimal("0"),
        remark=delivery.remark,
    )
    db.add(db_delivery)
    db.commit()
    db.refresh(db_delivery)
    return db_delivery


def create_deliveries_batch(db: Session, deliveries: List[OriginalDeliveryCreate]) -> List[OriginalDelivery]:
    """批量创建原始交割单（支持覆盖重复数据）"""
    result = []
    for delivery in deliveries:
        # 查询是否已存在相同 (stock_name, trade_date, trade_time) 的记录
        existing = db.query(OriginalDelivery).filter(
            OriginalDelivery.stock_name == delivery.stock_name,
            OriginalDelivery.trade_date == delivery.trade_date,
            OriginalDelivery.trade_time == delivery.trade_time
        ).first()

        if existing:
            # 覆盖更新
            existing.stock_code = delivery.stock_code
            existing.trade_type = delivery.trade_type
            existing.quantity = delivery.quantity
            existing.trade_price = delivery.trade_price
            existing.occur_amount = delivery.occur_amount
            existing.deal_amount = delivery.deal_amount
            existing.fee = delivery.fee or Decimal("0")
            existing.remark = delivery.remark
            db.flush()
            result.append(existing)
        else:
            # 新增
            db_delivery = OriginalDelivery(
                trade_date=delivery.trade_date,
                trade_time=delivery.trade_time,
                stock_code=delivery.stock_code,
                stock_name=delivery.stock_name,
                trade_type=delivery.trade_type,
                quantity=delivery.quantity,
                trade_price=delivery.trade_price,
                occur_amount=delivery.occur_amount,
                deal_amount=delivery.deal_amount,
                fee=delivery.fee or Decimal("0"),
                remark=delivery.remark,
            )
            db.add(db_delivery)
            db.flush()
            result.append(db_delivery)

    db.commit()
    for d in result:
        db.refresh(d)
    return result


def get_delivery(db: Session, delivery_id: int) -> Optional[OriginalDelivery]:
    """获取单条原始交割单"""
    return db.query(OriginalDelivery).filter(OriginalDelivery.id == delivery_id).first()


def get_deliveries(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    stock_code: Optional[str] = None,
    stock_name: Optional[str] = None,
    trade_type: Optional[str] = None,
    trade_date_start: Optional[date] = None,
    trade_date_end: Optional[date] = None,
) -> Tuple[List[OriginalDelivery], int]:
    """分页查询原始交割单"""
    query = db.query(OriginalDelivery)

    # 筛选条件
    filters = []
    if stock_code:
        filters.append(OriginalDelivery.stock_code.contains(stock_code))
    if stock_name:
        filters.append(OriginalDelivery.stock_name.contains(stock_name))
    if trade_type:
        filters.append(OriginalDelivery.trade_type == trade_type)
    if trade_date_start:
        filters.append(OriginalDelivery.trade_date >= trade_date_start)
    if trade_date_end:
        filters.append(OriginalDelivery.trade_date <= trade_date_end)

    if filters:
        query = query.filter(and_(*filters))

    # 总数
    total = query.count()

    # 分页
    items = query.order_by(OriginalDelivery.trade_date.desc(), OriginalDelivery.trade_time.desc()) \
        .offset((page - 1) * page_size) \
        .limit(page_size) \
        .all()

    return items, total


def delete_delivery(db: Session, delivery_id: int) -> bool:
    """删除原始交割单"""
    db_delivery = get_delivery(db, delivery_id)
    if not db_delivery:
        return False

    db.delete(db_delivery)
    db.commit()
    return True


def delete_all_deliveries(db: Session) -> bool:
    """清空所有原始交割单"""
    db.query(OriginalDelivery).delete()
    db.commit()
    return True


# ============== 已清仓股票统计 CRUD ==============

def split_into_cycles(records: list[Dict[str, Any]]) -> list[list[Dict[str, Any]]]:
    """
    周期切割算法：将某只股票的所有交割记录切割成完整的买卖周期

    records: 已按 trade_date, trade_time 排序的某只股票的所有记录
    返回: 切割好的周期列表，每个元素是该周期内所有记录的列表
    """
    cycles = []
    current_cycle = []
    holding_qty = 0

    for record in records:
        current_cycle.append(record)
        if record['trade_type'] == '买入':
            holding_qty += record['quantity']
        else:  # 卖出
            holding_qty -= record['quantity']

        if holding_qty == 0:  # 周期结束
            cycles.append(current_cycle)
            current_cycle = []

    # holding_qty != 0 的尾部记录属于当前持仓，忽略（已清仓统计不含）
    return cycles


def calculate_cycle_stats(cycle: list[Dict[str, Any]], cycle_index: int) -> Dict[str, Any]:
    """
    计算单个周期的统计指标
    """
    if not cycle:
        return {
            "stock_code": "",
            "stock_name": "",
            "open_date": None,
            "close_date": None,
            "hold_days": 0,
            "total_buy_amount": Decimal("0"),
            "total_sell_amount": Decimal("0"),
            "total_buy_qty": 0,
            "profit_loss": Decimal("0"),
            "profit_rate": Decimal("0"),
            "avg_buy_price": Decimal("0"),
            "avg_sell_price": Decimal("0"),
            "records": [],
        }

    # 基本信息
    stock_code = cycle[0]['stock_code']
    stock_name = cycle[0]['stock_name']

    # 筛选买卖记录
    buy_records = [r for r in cycle if r['trade_type'] == '买入']
    sell_records = [r for r in cycle if r['trade_type'] == '卖出']

    # 日期信息 - 只有买卖记录都存在时才计算
    if buy_records:
        open_date = min(r['trade_date'] for r in buy_records)
    else:
        open_date = None

    if sell_records:
        close_date = max(r['trade_date'] for r in sell_records)
    else:
        close_date = None

    hold_days = (close_date - open_date).days if open_date and close_date else 0

    # 金额信息
    total_buy_amount = Decimal(str(sum(r['deal_amount'] for r in buy_records)))
    total_sell_amount = Decimal(str(sum(r['deal_amount'] for r in sell_records)))
    total_buy_qty = sum(r['quantity'] for r in buy_records)

    # 盈亏计算
    profit_loss = sum(Decimal(str(r['occur_amount'])) for r in cycle)

    # 收益率
    if total_buy_amount > 0:
        profit_rate = (profit_loss / total_buy_amount * 100).quantize(Decimal("0.01"))
    else:
        profit_rate = Decimal("0")

    # 买入均价
    if total_buy_qty > 0:
        avg_buy_price = (total_buy_amount / total_buy_qty).quantize(Decimal("0.001"))
    else:
        avg_buy_price = Decimal("0")

    # 卖出均价
    total_sell_qty = sum(r['quantity'] for r in sell_records)
    if total_sell_qty > 0:
        avg_sell_price = (total_sell_amount / total_sell_qty).quantize(Decimal("0.001"))
    else:
        avg_sell_price = Decimal("0")

    return {
        'stock_code': stock_code,
        'stock_name': stock_name,
        'cycle_index': cycle_index,
        'open_date': open_date,
        'close_date': close_date,
        'hold_days': hold_days,
        'total_buy_amount': total_buy_amount.quantize(Decimal("0.01")),
        'total_sell_amount': total_sell_amount.quantize(Decimal("0.01")),
        'total_buy_qty': total_buy_qty,
        'profit_loss': profit_loss.quantize(Decimal("0.01")),
        'profit_rate': profit_rate,
        'avg_buy_price': avg_buy_price,
        'avg_sell_price': avg_sell_price,
        'cost_vs_open': None,
        'cost_vs_close': None,
    }


def get_all_cleared_positions(db: Session) -> List[Dict[str, Any]]:
    """
    获取所有已清仓周期（不分页，用于内存中计算）
    """
    # 查询全部交割记录，按 stock_code, trade_date, trade_time 排序
    records = db.query(OriginalDelivery).order_by(
        OriginalDelivery.stock_code,
        OriginalDelivery.trade_date,
        func.ifnull(OriginalDelivery.trade_time, '23:59:59')
    ).all()

    # 转换为字典
    records_dict = [{
        'id': r.id,
        'trade_date': r.trade_date,
        'trade_time': r.trade_time,
        'stock_code': r.stock_code,
        'stock_name': r.stock_name,
        'trade_type': r.trade_type,
        'quantity': r.quantity,
        'trade_price': r.trade_price,
        'deal_amount': r.deal_amount,
        'occur_amount': r.occur_amount,
        'fee': r.fee,
        'remark': r.remark,
    } for r in records]

    # 按 stock_code 分组
    from itertools import groupby
    from operator import itemgetter

    grouped = {}
    for stock_code, group in groupby(records_dict, key=itemgetter('stock_code')):
        grouped[stock_code] = list(group)

    # 切割周期
    all_cycles = []
    for stock_code, stock_records in grouped.items():
        cycles = split_into_cycles(stock_records)
        for idx, cycle in enumerate(cycles, start=1):
            stats = calculate_cycle_stats(cycle, idx)
            all_cycles.append(stats)

    return all_cycles


def enrich_with_quote_data(db: Session, cycles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    关联行情表，补充成本百分比数据
    """
    result = []
    for cycle in cycles:
        # 查询建仓日期的行情数据
        quote = db.query(StockDailyQuote).filter(
            StockDailyQuote.stock_code == cycle['stock_code'],
            StockDailyQuote.trade_date == cycle['open_date']
        ).first()

        if quote and quote.open_price and quote.close_price:
            avg_buy_price = cycle['avg_buy_price']
            open_price = Decimal(str(quote.open_price))
            close_price = Decimal(str(quote.close_price))

            if open_price > 0:
                cycle['cost_vs_open'] = ((avg_buy_price - open_price) / open_price * 100).quantize(Decimal("0.01"))
            if close_price > 0:
                cycle['cost_vs_close'] = ((avg_buy_price - close_price) / close_price * 100).quantize(Decimal("0.01"))

        result.append(cycle)

    return result


def get_cleared_positions(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    stock_code: Optional[str] = None,
    profit_filter: str = "all",
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    order_by: str = "close_date",
    order_dir: str = "desc",
) -> Tuple[List[Dict[str, Any]], int]:
    """
    分页查询已清仓周期
    """
    # 获取所有周期
    all_cycles = get_all_cleared_positions(db)

    # 关联行情数据
    all_cycles = enrich_with_quote_data(db, all_cycles)

    # 筛选
    filtered = all_cycles
    if stock_code:
        filtered = [c for c in filtered if stock_code.lower() in c['stock_code'].lower()]
    if profit_filter == "profit":
        filtered = [c for c in filtered if c['profit_loss'] > 0]
    elif profit_filter == "loss":
        filtered = [c for c in filtered if c['profit_loss'] < 0]
    if start_date:
        filtered = [c for c in filtered if c['open_date'] and c['open_date'] >= start_date]
    if end_date:
        filtered = [c for c in filtered if c['open_date'] and c['open_date'] <= end_date]

    # 排序
    order_field_map = {
        "close_date": "close_date",
        "profit_loss": "profit_loss",
        "profit_rate": "profit_rate",
        "hold_days": "hold_days",
        "open_date": "open_date",
    }
    order_field = order_field_map.get(order_by, "close_date")
    reverse = (order_dir == "desc")

    none_items = [c for c in filtered if c[order_field] is None]
    non_none_items = [c for c in filtered if c[order_field] is not None]

    non_none_items.sort(key=lambda x: x[order_field], reverse=reverse)

    filtered = non_none_items + none_items if reverse else none_items + non_none_items

    # 分页
    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    items = filtered[start:end]

    return items, total


def get_cleared_position_by_stock_and_cycle(
    db: Session,
    stock_code: str,
    cycle_index: int
) -> Optional[Tuple[Dict[str, Any], List[Dict[str, Any]]]]:
    """
    获取某只股票某周期的明细
    返回 (周期统计, 交割记录列表)
    """
    # 查询该股票的所有交割记录
    records = db.query(OriginalDelivery).filter(
        OriginalDelivery.stock_code == stock_code
    ).order_by(
        OriginalDelivery.trade_date,
        func.ifnull(OriginalDelivery.trade_time, '23:59:59')
    ).all()

    # 转换为字典
    records_dict = [{
        'id': r.id,
        'trade_date': r.trade_date,
        'trade_time': r.trade_time,
        'stock_code': r.stock_code,
        'stock_name': r.stock_name,
        'trade_type': r.trade_type,
        'quantity': r.quantity,
        'trade_price': r.trade_price,
        'deal_amount': r.deal_amount,
        'occur_amount': r.occur_amount,
        'fee': r.fee,
        'remark': r.remark,
    } for r in records]

    # 切割周期
    cycles = split_into_cycles(records_dict)

    # 检查是否存在指定的周期
    if cycle_index < 1 or cycle_index > len(cycles):
        return None

    # 获取指定周期
    target_cycle = cycles[cycle_index - 1]
    stats = calculate_cycle_stats(target_cycle, cycle_index)

    # 关联行情数据
    stats = enrich_with_quote_data(db, [stats])[0]

    # 转换为响应格式
    records_response = [{
        'id': r['id'],
        'trade_date': r['trade_date'],
        'trade_time': r['trade_time'],
        'trade_type': r['trade_type'],
        'quantity': r['quantity'],
        'trade_price': r['trade_price'],
        'deal_amount': r['deal_amount'],
        'occur_amount': r['occur_amount'],
        'fee': r['fee'],
        'remark': r['remark'],
    } for r in target_cycle]

    return stats, records_response


def get_cleared_position_by_dates(
    db: Session,
    stock_code: str,
    open_date: date,
    close_date: date
) -> Optional[Tuple[Dict[str, Any], List[Dict[str, Any]]]]:
    """
    根据股票代码、建仓日期、清仓日期获取已清仓周期明细
    """
    # 查询该股票的所有交割记录
    records = db.query(OriginalDelivery).filter(
        OriginalDelivery.stock_code == stock_code
    ).order_by(
        OriginalDelivery.trade_date,
        func.ifnull(OriginalDelivery.trade_time, '23:59:59')
    ).all()

    # 转换为字典
    records_dict = [{
        'id': r.id,
        'trade_date': r.trade_date,
        'trade_time': r.trade_time,
        'stock_code': r.stock_code,
        'stock_name': r.stock_name,
        'trade_type': r.trade_type,
        'quantity': r.quantity,
        'trade_price': r.trade_price,
        'deal_amount': r.deal_amount,
        'occur_amount': r.occur_amount,
        'fee': r.fee,
        'remark': r.remark,
    } for r in records]

    # 切割周期
    cycles = split_into_cycles(records_dict)

    # 找到匹配的周期
    target_cycle = None
    matched_index = None
    for idx, cycle in enumerate(cycles, start=1):
        if not cycle:
            continue
        buy_records = [r for r in cycle if r['trade_type'] == '买入']
        sell_records = [r for r in cycle if r['trade_type'] == '卖出']
        if not buy_records or not sell_records:
            continue

        cycle_open_date = min(r['trade_date'] for r in buy_records)
        cycle_close_date = max(r['trade_date'] for r in sell_records)

        if cycle_open_date == open_date and cycle_close_date == close_date:
            target_cycle = cycle
            matched_index = idx
            break

    if target_cycle is None:
        return None

    stats = calculate_cycle_stats(target_cycle, matched_index)

    # 关联行情数据
    stats = enrich_with_quote_data(db, [stats])[0]

    # 转换为响应格式
    records_response = [{
        'id': r['id'],
        'trade_date': r['trade_date'],
        'trade_time': r['trade_time'],
        'trade_type': r['trade_type'],
        'quantity': r['quantity'],
        'trade_price': r['trade_price'],
        'deal_amount': r['deal_amount'],
        'occur_amount': r['occur_amount'],
        'fee': r['fee'],
        'remark': r['remark'],
    } for r in target_cycle]

    return stats, records_response


# ============== 已清仓周期预计算表 CRUD ==============

def _get_stock_cycles_from_deliveries(
    db: Session,
    stock_code: str,
    cycle_index_start: int = 1
) -> list[Dict[str, Any]]:
    """
    从原始交割单计算某只股票的周期列表（内部使用）
    返回: 包含record_ids的周期统计列表
    """
    # 查询该股票的所有交割记录
    records = db.query(OriginalDelivery).filter(
        OriginalDelivery.stock_code == stock_code
    ).order_by(
        OriginalDelivery.trade_date,
        func.ifnull(OriginalDelivery.trade_time, '23:59:59')
    ).all()

    if not records:
        return []

    # 转换为字典
    records_dict = [{
        'id': r.id,
        'trade_date': r.trade_date,
        'trade_time': r.trade_time,
        'stock_code': r.stock_code,
        'stock_name': r.stock_name,
        'trade_type': r.trade_type,
        'quantity': r.quantity,
        'trade_price': r.trade_price,
        'deal_amount': r.deal_amount,
        'occur_amount': r.occur_amount,
        'fee': r.fee,
        'remark': r.remark,
    } for r in records]

    # 切割周期
    cycles = split_into_cycles(records_dict)

    # 计算每个周期的统计指标
    result = []
    for idx, cycle in enumerate(cycles, start=cycle_index_start):
        stats = calculate_cycle_stats(cycle, idx)
        # 添加record_ids
        stats['record_ids'] = json.dumps([r['id'] for r in cycle])
        result.append(stats)

    return result


def _upsert_cleared_positions(
    db: Session,
    cycles: List[Dict[str, Any]]
) -> int:
    """
    批量upsert已清仓周期数据到预计算表
    返回: 插入/更新的记录数
    """
    if not cycles:
        return 0

    from datetime import datetime
    now = datetime.now()
    count = 0

    for cycle in cycles:
        # 查询是否已存在
        existing = db.query(ClearedPosition).filter(
            ClearedPosition.stock_code == cycle['stock_code'],
            ClearedPosition.cycle_index == cycle['cycle_index']
        ).first()

        if existing:
            # 更新已存在的记录
            existing.stock_name = cycle['stock_name']
            existing.open_date = cycle['open_date']
            existing.close_date = cycle['close_date']
            existing.hold_days = cycle['hold_days']
            existing.total_buy_amount = cycle['total_buy_amount']
            existing.total_sell_amount = cycle['total_sell_amount']
            existing.total_buy_qty = cycle['total_buy_qty']
            existing.profit_loss = cycle['profit_loss']
            existing.profit_rate = cycle['profit_rate']
            existing.avg_buy_price = cycle['avg_buy_price']
            existing.avg_sell_price = cycle.get('avg_sell_price', Decimal("0"))
            existing.record_ids = cycle['record_ids']
            existing.updated_at = now
        else:
            # 插入新记录
            new_position = ClearedPosition(
                stock_code=cycle['stock_code'],
                stock_name=cycle['stock_name'],
                cycle_index=cycle['cycle_index'],
                open_date=cycle['open_date'],
                close_date=cycle['close_date'],
                hold_days=cycle['hold_days'],
                total_buy_amount=cycle['total_buy_amount'],
                total_sell_amount=cycle['total_sell_amount'],
                total_buy_qty=cycle['total_buy_qty'],
                profit_loss=cycle['profit_loss'],
                profit_rate=cycle['profit_rate'],
                avg_buy_price=cycle['avg_buy_price'],
                avg_sell_price=cycle.get('avg_sell_price', Decimal("0")),
                record_ids=cycle['record_ids'],
                updated_at=now,
            )
            db.add(new_position)

        count += 1

    db.commit()
    return count


def clean_cleared_positions(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    stock_codes: Optional[List[str]] = None,
) -> Tuple[int, str]:
    """
    清洗已清仓周期数据到预计算表

    参数:
    - start_date, end_date: 时间段筛选（可选）
    - stock_codes: 指定股票代码列表（可选）

    返回: (清洗的周期数量, 消息)
    """
    try:
        import json

        # 确定需要处理的股票列表
        if stock_codes:
            # 指定了股票代码，只处理这些股票
            target_stocks = stock_codes
        else:
            # 获取所有有交易的股票
            if start_date and end_date:
                # 时间段筛选：只处理该时间段内有变化的股票
                target_stocks = db.query(OriginalDelivery.stock_code).filter(
                    OriginalDelivery.trade_date >= start_date,
                    OriginalDelivery.trade_date <= end_date
                ).distinct().all()
                target_stocks = [s[0] for s in target_stocks]
            elif start_date:
                target_stocks = db.query(OriginalDelivery.stock_code).filter(
                    OriginalDelivery.trade_date >= start_date
                ).distinct().all()
                target_stocks = [s[0] for s in target_stocks]
            elif end_date:
                target_stocks = db.query(OriginalDelivery.stock_code).filter(
                    OriginalDelivery.trade_date <= end_date
                ).distinct().all()
                target_stocks = [s[0] for s in target_stocks]
            else:
                # 无参数：处理所有股票
                target_stocks = db.query(OriginalDelivery.stock_code).distinct().all()
                target_stocks = [s[0] for s in target_stocks]

        if not target_stocks:
            return 0, "没有需要处理的数据"

        total_cleaned = 0

        for stock_code in target_stocks:
            # 先删除该股票的旧记录（实现覆盖策略）
            db.query(ClearedPosition).filter(
                ClearedPosition.stock_code == stock_code
            ).delete()

            # 计算该股票的周期（从1开始）
            cycles = _get_stock_cycles_from_deliveries(db, stock_code, 1)

            if cycles:
                # upsert到预计算表
                cleaned = _upsert_cleared_positions(db, cycles)
                total_cleaned += cleaned

        return total_cleaned, f"成功清洗 {total_cleaned} 个周期"

    except Exception as e:
        db.rollback()
        return 0, f"清洗失败: {str(e)}"


def get_cleared_positions_from_table(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    stock_code: Optional[str] = None,
    profit_filter: str = "all",
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    order_by: str = "close_date",
    order_dir: str = "desc",
) -> Tuple[List[Dict[str, Any]], int, Optional[datetime]]:
    """
    从预计算表分页查询已清仓周期

    返回: (周期列表, 总数, 最后清洗时间)
    """
    query = db.query(ClearedPosition)

    # 筛选条件
    filters = []
    if stock_code:
        filters.append(ClearedPosition.stock_code.contains(stock_code))
    if profit_filter == "profit":
        filters.append(ClearedPosition.profit_loss > 0)
    elif profit_filter == "loss":
        filters.append(ClearedPosition.profit_loss < 0)
    if start_date:
        filters.append(ClearedPosition.open_date >= start_date)
    if end_date:
        filters.append(ClearedPosition.open_date <= end_date)

    if filters:
        query = query.filter(and_(*filters))

    # 获取最后清洗时间
    last_clean_record = db.query(ClearedPosition).order_by(
        ClearedPosition.updated_at.desc()
    ).first()
    last_clean_time = last_clean_record.updated_at if last_clean_record else None

    # 排序
    order_field_map = {
        "close_date": ClearedPosition.close_date,
        "profit_loss": ClearedPosition.profit_loss,
        "profit_rate": ClearedPosition.profit_rate,
        "hold_days": ClearedPosition.hold_days,
        "open_date": ClearedPosition.open_date,
    }
    order_field = order_field_map.get(order_by, ClearedPosition.close_date)
    if order_dir == "desc":
        query = query.order_by(order_field.desc())
    else:
        query = query.order_by(order_field.asc())

    # 总数
    total = query.count()

    # 分页
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    # 转换为字典
    result = []
    for item in items:
        record = {
            'id': item.id,
            'stock_code': item.stock_code,
            'stock_name': item.stock_name,
            'cycle_index': item.cycle_index,
            'open_date': item.open_date,
            'close_date': item.close_date,
            'hold_days': item.hold_days,
            'total_buy_amount': item.total_buy_amount,
            'total_sell_amount': item.total_sell_amount,
            'total_buy_qty': item.total_buy_qty,
            'profit_loss': item.profit_loss,
            'profit_rate': item.profit_rate,
            'avg_buy_price': item.avg_buy_price,
            'avg_sell_price': item.avg_sell_price,
            'record_ids': item.record_ids,
            'notes': item.notes,
            'updated_at': item.updated_at,
        }
        result.append(record)

    # 关联行情数据补充成本百分比
    result = enrich_with_quote_data(db, result)

    return result, total, last_clean_time


def get_cleared_position_status(db: Session) -> Dict[str, Any]:
    """
    获取已清仓周期预计算表的状态
    """
    # 获取最后清洗时间
    last_clean_record = db.query(ClearedPosition).order_by(
        ClearedPosition.updated_at.desc()
    ).first()
    last_clean_time = last_clean_record.updated_at if last_clean_record else None

    # 获取总周期数
    total_cycles = db.query(ClearedPosition).count()

    # 获取涉及的股票列表
    stocks = db.query(ClearedPosition.stock_code).distinct().all()
    stocks = [s[0] for s in stocks]

    return {
        'last_clean_time': last_clean_time,
        'total_cycles': total_cycles,
        'stocks': stocks,
    }


def update_cleared_position_notes(
    db: Session,
    stock_code: str,
    open_date: date,
    close_date: date,
    notes: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    更新已清仓周期的交易笔记
    """
    try:
        record = db.query(ClearedPosition).filter(
            ClearedPosition.stock_code == stock_code,
            ClearedPosition.open_date == open_date,
            ClearedPosition.close_date == close_date,
        ).first()

        if not record:
            return False, f"股票 {stock_code} 在 {open_date} 到 {close_date} 之间的记录不存在"

        record.notes = notes
        db.commit()
        return True, "笔记更新成功"

    except Exception as e:
        db.rollback()
        return False, f"更新失败: {str(e)}"

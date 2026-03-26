"""
原始交割单导入功能测试
使用独立的测试数据库配置
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 在导入任何项目模块之前设置测试配置
os.environ['DB_HOST'] = 'localhost'
os.environ['DB_PORT'] = '3306'
os.environ['DB_USER'] = 'root'
os.environ['DB_PASSWORD'] = '123456'
os.environ['DB_NAME'] = 'stock_test_db'

from datetime import date, time
from decimal import Decimal

# 重新加载配置
import importlib
import config
importlib.reload(config)

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# 创建测试数据库引擎 - 使用项目配置
from config import settings

# 强制使用 MySQL
test_db_url = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"

try:
    engine = create_engine(test_db_url, pool_pre_ping=True, pool_recycle=3600)
    # 测试连接
    with engine.connect() as conn:
        conn.execute("SELECT 1")
    print(f"✓ 连接测试数据库成功: {settings.DB_NAME}")
    USE_MYSQL = True
except Exception as e:
    print(f"⚠ MySQL 连接失败: {e}")
    print("⚠ 使用 SQLite 内存数据库进行测试（部分功能可能受限）")
    USE_MYSQL = False
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite 需要特殊处理 id 自增
    from sqlalchemy import Column, BigInteger, Date, String, DECIMAL, Integer, Text, DateTime, Time
    from sqlalchemy.orm import declarative_base

    TestBase = declarative_base()

    class _TestOriginalDelivery(TestBase):
        """测试用原始交割单模型"""
        __tablename__ = "original_delivery_test"
        __table_args__ = {"comment": "测试用原始交割单表"}

        id = Column(Integer, primary_key=True, autoincrement=True)
        trade_date = Column(Date, nullable=False, index=True, comment="成交日期")
        trade_time = Column(Time, nullable=True, comment="成交时间")
        stock_code = Column(String(20), nullable=False, index=True, comment="代码")
        stock_name = Column(String(50), nullable=False, comment="名称")
        trade_type = Column(String(10), nullable=False, comment="交易类别")
        quantity = Column(Integer, nullable=False, comment="成交数量")
        trade_price = Column(DECIMAL(10, 3), nullable=False, comment="成交价格")
        occur_amount = Column(DECIMAL(15, 2), nullable=False, comment="发生金额")
        deal_amount = Column(DECIMAL(15, 2), nullable=False, comment="成交金额")
        fee = Column(DECIMAL(10, 2), default=0, comment="费用")
        remark = Column(Text, nullable=True, comment="备注")
        created_at = Column(DateTime, nullable=True, comment="创建时间")

# 创建会话
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_module():
    """测试模块初始化"""
    if USE_MYSQL:
        from database import Base
        Base.metadata.create_all(bind=engine)
    else:
        TestBase.metadata.create_all(bind=engine)


def teardown_module():
    """测试模块清理"""
    if USE_MYSQL:
        from database import Base
        Base.metadata.drop_all(bind=engine)
    else:
        TestBase.metadata.drop_all(bind=engine)


def setup_function():
    """每个测试前清空表"""
    db = TestingSessionLocal()
    try:
        DeliveryModel = get_test_delivery_model()
        db.query(DeliveryModel).delete()
        db.commit()
    finally:
        db.close()


def get_test_delivery_model():
    """获取测试用的模型"""
    if USE_MYSQL:
        from models import OriginalDelivery
        return OriginalDelivery
    else:
        return _TestOriginalDelivery


def test_01_create_single_delivery():
    """测试1: 创建单条原始交割单"""
    db = TestingSessionLocal()
    try:
        DeliveryModel = get_test_delivery_model()

        delivery = DeliveryModel(
            trade_date=date(2024, 3, 20),
            trade_time=time(9, 30, 0),
            stock_code="600000",
            stock_name="浦发银行",
            trade_type="买入",
            quantity=100,
            trade_price=Decimal("10.50"),
            occur_amount=Decimal("1050.00"),
            deal_amount=Decimal("1050.00"),
            fee=Decimal("5.00"),
            remark="测试买入"
        )

        db.add(delivery)
        db.commit()
        db.refresh(delivery)

        assert delivery.id is not None
        assert delivery.stock_code == "600000"
        assert delivery.stock_name == "浦发银行"
        assert delivery.trade_type == "买入"
        assert delivery.quantity == 100
        assert delivery.trade_price == Decimal("10.50")
        print(f"✓ 创建单条原始交割单成功: ID={delivery.id}")
    finally:
        db.close()


def test_02_batch_insert():
    """测试2: 批量插入原始交割单"""
    db = TestingSessionLocal()
    try:
        DeliveryModel = get_test_delivery_model()

        deliveries = [
            DeliveryModel(
                trade_date=date(2024, 3, 20),
                trade_time=time(9, 30, 0),
                stock_code="600000",
                stock_name="浦发银行",
                trade_type="买入",
                quantity=100,
                trade_price=Decimal("10.50"),
                occur_amount=Decimal("1050.00"),
                deal_amount=Decimal("1050.00"),
                fee=Decimal("5.00")
            ),
            DeliveryModel(
                trade_date=date(2024, 3, 20),
                trade_time=time(10, 15, 0),
                stock_code="000001",
                stock_name="平安银行",
                trade_type="买入",
                quantity=200,
                trade_price=Decimal("12.30"),
                occur_amount=Decimal("2460.00"),
                deal_amount=Decimal("2460.00"),
                fee=Decimal("12.00")
            ),
            DeliveryModel(
                trade_date=date(2024, 3, 21),
                trade_time=time(14, 30, 0),
                stock_code="600000",
                stock_name="浦发银行",
                trade_type="卖出",
                quantity=100,
                trade_price=Decimal("10.80"),
                occur_amount=Decimal("-1080.00"),
                deal_amount=Decimal("1080.00"),
                fee=Decimal("5.00")
            )
        ]

        db.bulk_save_objects(deliveries)
        db.commit()

        # 验证插入
        count = db.query(DeliveryModel).count()
        assert count == 3

        all_deliveries = db.query(DeliveryModel).all()
        assert all_deliveries[0].stock_code == "600000"
        assert all_deliveries[1].stock_code == "000001"
        assert all_deliveries[2].trade_type == "卖出"

        print(f"✓ 批量插入成功: 共 {count} 条记录")
    finally:
        db.close()


def test_03_query_with_filters():
    """测试3: 条件查询"""
    db = TestingSessionLocal()
    try:
        DeliveryModel = get_test_delivery_model()

        # 插入测试数据
        deliveries = [
            DeliveryModel(
                trade_date=date(2024, 3, 20),
                stock_code="600000",
                stock_name="浦发银行",
                trade_type="买入",
                quantity=100,
                trade_price=Decimal("10.50"),
                occur_amount=Decimal("1050.00"),
                deal_amount=Decimal("1050.00")
            ),
            DeliveryModel(
                trade_date=date(2024, 3, 21),
                stock_code="000001",
                stock_name="平安银行",
                trade_type="买入",
                quantity=200,
                trade_price=Decimal("12.30"),
                occur_amount=Decimal("2460.00"),
                deal_amount=Decimal("2460.00")
            ),
            DeliveryModel(
                trade_date=date(2024, 3, 22),
                stock_code="600000",
                stock_name="浦发银行",
                trade_type="卖出",
                quantity=100,
                trade_price=Decimal("10.80"),
                occur_amount=Decimal("-1080.00"),
                deal_amount=Decimal("1080.00")
            )
        ]
        db.bulk_save_objects(deliveries)
        db.commit()

        # 按股票代码筛选
        results = db.query(DeliveryModel).filter(DeliveryModel.stock_code == "600000").all()
        assert len(results) == 2
        print(f"✓ 按股票代码筛选成功: 找到 {len(results)} 条")

        # 按交易类型筛选
        results = db.query(DeliveryModel).filter(DeliveryModel.trade_type == "卖出").all()
        assert len(results) == 1
        assert results[0].trade_type == "卖出"
        print(f"✓ 按交易类型筛选成功")

        # 按日期范围筛选
        results = db.query(DeliveryModel).filter(
            DeliveryModel.trade_date >= date(2024, 3, 21),
            DeliveryModel.trade_date <= date(2024, 3, 22)
        ).all()
        assert len(results) == 2
        print(f"✓ 按日期范围筛选成功")
    finally:
        db.close()


def test_04_update_delivery():
    """测试4: 更新记录"""
    db = TestingSessionLocal()
    try:
        DeliveryModel = get_test_delivery_model()

        # 创建记录
        delivery = DeliveryModel(
            trade_date=date(2024, 3, 20),
            stock_code="600000",
            stock_name="浦发银行",
            trade_type="买入",
            quantity=100,
            trade_price=Decimal("10.50"),
            occur_amount=Decimal("1050.00"),
            deal_amount=Decimal("1050.00"),
            remark="原始备注"
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)

        # 更新记录
        delivery.remark = "更新后的备注"
        delivery.quantity = 200
        db.commit()
        db.refresh(delivery)

        assert delivery.remark == "更新后的备注"
        assert delivery.quantity == 200
        print(f"✓ 更新记录成功")
    finally:
        db.close()


def test_06_pagination():
    """测试6: 分页查询"""
    db = TestingSessionLocal()
    try:
        DeliveryModel = get_test_delivery_model()

        # 批量插入
        deliveries = [
            DeliveryModel(
                trade_date=date(2024, 3, 20),
                stock_code=f"60000{i}",
                stock_name=f"股票{i}",
                trade_type="买入",
                quantity=100,
                trade_price=Decimal("10.50"),
                occur_amount=Decimal("1050.00"),
                deal_amount=Decimal("1050.00")
            )
            for i in range(15)
        ]
        db.bulk_save_objects(deliveries)
        db.commit()

        # 分页查询
        page1 = db.query(DeliveryModel).limit(10).offset(0).all()
        page2 = db.query(DeliveryModel).limit(10).offset(10).all()

        assert len(page1) == 10
        assert len(page2) == 5
        print(f"✓ 分页查询成功: 第1页{len(page1)}条, 第2页{len(page2)}条")
    finally:
        db.close()


def test_07_decimal_precision():
    """测试7: 金额精度"""
    db = TestingSessionLocal()
    try:
        DeliveryModel = get_test_delivery_model()

        delivery = DeliveryModel(
            trade_date=date(2024, 3, 20),
            stock_code="600000",
            stock_name="浦发银行",
            trade_type="买入",
            quantity=100,
            trade_price=Decimal("10.555"),  # 3位小数
            occur_amount=Decimal("1055.50"),  # 2位小数
            deal_amount=Decimal("1055.55"),  # 2位小数
            fee=Decimal("5.12")  # fee字段定义为DECIMAL(10,2)，最多2位小数
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)

        assert delivery.trade_price == Decimal("10.555")
        assert delivery.fee == Decimal("5.12")
        print(f"✓ 金额精度保存正确")
    finally:
        db.close()


def test_08_optional_fields():
    """测试8: 可选字段处理"""
    db = TestingSessionLocal()
    try:
        DeliveryModel = get_test_delivery_model()

        # 只有必填字段
        delivery = DeliveryModel(
            trade_date=date(2024, 3, 20),
            stock_code="600000",
            stock_name="浦发银行",
            trade_type="买入",
            quantity=100,
            trade_price=Decimal("10.50"),
            occur_amount=Decimal("1050.00"),
            deal_amount=Decimal("1050.00")
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)

        assert delivery.trade_time is None
        assert delivery.fee == Decimal("0")
        assert delivery.remark is None
        print(f"✓ 可选字段处理正确")
    finally:
        db.close()


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v", "--tb=short"])
"""
修复 quantity 字段为 0 的记录
根据 quantity = deal_amount / trade_price 计算
"""
from decimal import Decimal
from sqlalchemy import create_engine, text
from config import settings

def fix_quantity():
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # 查询需要修复的记录
        result = conn.execute(text("""
            SELECT id, deal_amount, trade_price 
            FROM original_delivery 
            WHERE quantity = 0 AND trade_price > 0
        """))
        
        records = result.fetchall()
        print(f"找到 {len(records)} 条需要修复的记录")
        
        if len(records) == 0:
            print("没有需要修复的记录")
            return
        
        # 批量更新
        updated = 0
        for record in records:
            record_id = record[0]
            deal_amount = Decimal(str(record[1]))
            trade_price = Decimal(str(record[2]))
            
            if trade_price > 0:
                quantity = int(deal_amount / trade_price)
                conn.execute(text("""
                    UPDATE original_delivery 
                    SET quantity = :quantity 
                    WHERE id = :id
                """), {"quantity": quantity, "id": record_id})
                updated += 1
                
                if updated % 100 == 0:
                    print(f"已更新 {updated} 条记录...")
        
        conn.commit()
        print(f"修复完成，共更新 {updated} 条记录")

if __name__ == "__main__":
    fix_quantity()

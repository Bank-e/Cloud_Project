import json
import boto3
from boto3.dynamodb.conditions import Key
from collections import defaultdict
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
ORDERS_TABLE = dynamodb.Table('Orders')
PRODUCTS_TABLE = dynamodb.Table('Products')

def lambda_handler(event, context):
    try:
        params = event.get('queryStringParameters')
        if not params or 'CustomerID' not in params:
             return {'statusCode': 400, 'body': json.dumps({'error': 'Missing CustomerID'}, ensure_ascii=False)}

        customer_id = params['CustomerID']
        
        # 1. QUERY: ดึงรายการสั่งซื้อทั้งหมด
        orders_response = ORDERS_TABLE.query(
            IndexName='CustomerID-OrderID-index',
            KeyConditionExpression=Key('CustomerID').eq(customer_id)
        )
        
        grouped_products = defaultdict(int)
        items = orders_response.get('Items', [])
        print(f"Found {len(items)} orders")

        # 2. GROUP & SUM
        for order in items:
            order_items = order.get('Items', []) 
            
            for product_item in order_items:
                product_id = product_item.get('ProductID')
                # ดึงจำนวนสินค้า (รองรับทั้ง QTY และ QTY_Product)
                qty_value = product_item.get('QTY', product_item.get('QTY_Product', 0))
                
                if product_id:
                    try:
                        grouped_products[product_id] += int(qty_value)
                    except ValueError:
                        pass # ข้ามถ้าจำนวนไม่ใช่ตัวเลข

        # 3. ENRICH & CALCULATE
        final_order_details = []
        
        for product_id, total_qty in grouped_products.items():
            if total_qty == 0: continue

            product_response = PRODUCTS_TABLE.get_item(Key={'ProductID': product_id})
            product_details = product_response.get('Item')

            if product_details:
                # ======================================================
                # 🔴 แก้ไขจุดที่ Error: บังคับแปลงเป็น float เสมอ
                # ======================================================
                raw_price = product_details.get('ProductPrice', 0)
                try:
                    # ไม่ว่าจะเป็น Decimal หรือ String ก็จะถูกแปลงเป็น float
                    unit_price = float(raw_price)
                except (ValueError, TypeError):
                    unit_price = 0.0
                
                final_order_details.append({
                    'ProductID': product_details['ProductID'],
                    'ProductName': product_details['ProductName'],
                    'ProductPrice': unit_price,
                    'QTY_Product': total_qty,   
                    'SubTotal': round(unit_price * total_qty, 2) # ตอนนี้จะคำนวณได้แล้ว
                })

        return {
            'statusCode': 200, 
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(final_order_details, ensure_ascii=False, default=str)
        }
    
    except Exception as e:
        print(f"Error in get_order_details: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
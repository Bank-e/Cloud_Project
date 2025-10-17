import json
import boto3
from boto3.dynamodb.conditions import Key
from collections import defaultdict
from decimal import Decimal # จำเป็นต้องใช้ Decimal เพื่อจัดการตัวเลขจาก DynamoDB

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
ORDERS_TABLE = dynamodb.Table('Orders')
PRODUCTS_TABLE = dynamodb.Table('Products')

def lambda_handler(event, context):
    try:
        customer_id = event['queryStringParameters']['CustomerID']
        
        # 1. QUERY: ดึงรายการสั่งซื้อทั้งหมดของลูกค้าจาก GSI
        orders_response = ORDERS_TABLE.query(
            IndexName='CustomerID-OrderID-index',
            KeyConditionExpression=Key('CustomerID').eq(customer_id)
        )
        
        # ใช้วัตถุเพื่อเก็บผลรวม: { 'ProductID': total_qty }
        grouped_products = defaultdict(int)
        
        # 2. GROUP & SUM: วนลูปเพื่อรวมปริมาณสินค้า (QTY_Product)
        for order in orders_response['Items']:
            # เนื่องจาก 'Products' ถูกเก็บเป็น List ในแต่ละ Order Item
            for product_item in order['Products']:
                product_id = product_item['ProductID']
                
                # แปลง QTY_Product จาก Decimal (ที่ได้จาก boto3.resource) เป็น int
                qty_value = product_item['QTY_Product']
                product_qty = int(qty_value)
                
                grouped_products[product_id] += product_qty

        # 3. ENRICH & CALCULATE: ดึงรายละเอียดสินค้าและคำนวณราคารวม
        final_order_details = []
        
        for product_id, total_qty in grouped_products.items():
            # ดึงรายละเอียดสินค้าจากตาราง Products
            product_response = PRODUCTS_TABLE.get_item(Key={'ProductID': product_id})
            product_details = product_response.get('Item')

            if product_details:
                # แปลง ProductPrice จาก Decimal เป็น float/int เพื่อคำนวณและแสดงผล
                price_decimal = product_details['ProductPrice']
                unit_price = float(price_decimal) if isinstance(price_decimal, Decimal) else price_decimal
                
                final_order_details.append({
                    'ProductID': product_details['ProductID'],
                    'ProductName': product_details['ProductName'],
                    'ProductPrice': unit_price, # ราคาต่อหน่วย
                    'QTY_Product': total_qty,   # ปริมาณรวมจากทุก Order
                    'SubTotal': round(unit_price * total_qty, 2) # ราคารวมของสินค้ารายการนี้
                })

        return {'statusCode': 200, 'body': json.dumps(final_order_details, ensure_ascii=False, default=str)}
    
    except Exception as e:
        print(f"Error in get_order_details: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
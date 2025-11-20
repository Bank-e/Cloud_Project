import json
import boto3
import uuid
import time
from decimal import Decimal
from boto3.dynamodb.conditions import Key

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table_orders = dynamodb.Table('Orders')
table_products = dynamodb.Table('Products')
table_reservations = dynamodb.Table('Reservations')

def lambda_handler(event, context):
    try:
        # 1. Parse Body
        body = json.loads(event['body'])
        customer_id = body.get('CustomerID')
        reservation_id = body.get('ReservationID')
        products_request = body.get('Products', []) # List of {ProductID, QTY_Product}

        if not customer_id or not reservation_id or not products_request:
            return response(400, {'error': 'Missing required fields (CustomerID, ReservationID, Products)'})

        # 2. Validate Reservation (ใช้ Query เพราะ Table มี Sort Key: Date)
        # เราต้องเช็คว่า Reservation นี้มีอยู่จริง และเป็นของ Customer นี้หรือไม่
        res_response = table_reservations.query(
            KeyConditionExpression=Key('ReservationID').eq(reservation_id)
        )
        
        reservations = res_response.get('Items', [])
        if not reservations:
            return response(404, {'error': 'Reservation ID not found'})
            
        reservation = reservations[0] # เอาอันแรกที่เจอ
        
        # เช็คว่าเป็นของลูกค้าคนเดียวกันไหม (Optional แต่แนะนำ)
        # หมายเหตุ: ใน DynamoDB ที่คุณส่งรูปมา field คือ CustomerID
        if reservation.get('CustomerID') != customer_id:
             return response(403, {'error': 'Reservation does not belong to this customer'})

        # เช็คสถานะการจอง (ถ้าจำเป็น)
        if reservation.get('Status') == 'Cancel':
            return response(403, {'error': 'This reservation has been cancelled'})

        # 3. Calculate Total Price & Prepare Items
        # ดึงราคาสินค้าจริงจาก Database เพื่อความปลอดภัย
        total_price = 0
        order_items = []

        for item in products_request:
            p_id = item['ProductID']
            qty = int(item['QTY_Product'])
            
            # ดึงข้อมูลสินค้า
            prod_resp = table_products.get_item(Key={'ProductID': p_id})
            product_db = prod_resp.get('Item')
            
            if not product_db:
                # ถ้าไม่เจอสินค้า ข้ามไป หรือจะ Error ก็ได้
                continue
                
            # แปลงราคาจาก DB (Decimal) เป็น float เพื่อคำนวณ
            price_per_unit = float(product_db.get('ProductPrice', 0))
            line_total = price_per_unit * qty
            total_price += line_total
            
            # เก็บข้อมูลสินค้าลง Order (Snapshot ราคา ณ ตอนซื้อ)
            order_items.append({
                'ProductID': p_id,
                'ProductName': product_db.get('ProductName'), # เก็บชื่อเผื่อสินค้าเปลี่ยนชื่อ
                'PricePerUnit': Decimal(str(price_per_unit)),
                'QTY': qty,
                'LineTotal': Decimal(str(line_total))
            })

        if not order_items:
            return response(400, {'error': 'No valid products found in order'})

        # 4. Generate OrderID & Save to DB
        order_id = f"ORD-{int(time.time())}-{uuid.uuid4().hex[:4].upper()}"
        timestamp = int(time.time())
        
        order_data = {
            'OrderID': order_id,
            'CustomerID': customer_id,
            'ReservationID': reservation_id,
            'Items': order_items,
            'TotalPrice': Decimal(str(total_price)),
            'Status': 'Pending', # Pending -> Paid -> Completed
            'CreatedAt': timestamp
        }
        
        table_orders.put_item(Item=order_data)

        # 5. Return Success
        return response(200, {
            'message': 'Order created successfully',
            'OrderID': order_id,
            'TotalPrice': total_price
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return response(500, {'error': str(e)})

def response(status_code, body):
    # Helper function สำหรับสร้าง Response และแก้ปัญหา Decimal JSON Serialize
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body, default=decimal_default, ensure_ascii=False)
    }

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError
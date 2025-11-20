import json
import boto3
import uuid
from datetime import datetime
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from decimal import Decimal

# ใช้ resource เพื่อความง่ายในการจัดการ (แปลง type อัตโนมัติ)
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
ORDERS_TABLE = dynamodb.Table('Orders')
SALES_TABLE = dynamodb.Table('Sales') # ใช้ resource table
RESERVATIONS_TABLE = dynamodb.Table('Reservations') # ใช้ resource table

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        customer_id = body.get('CustomerID')
        payment_type = body.get('PaymentType')
        
        # แปลง TotalAmount เป็น Decimal หรือ String ให้ถูกต้อง
        total_amount_val = body.get('TotalAmount', 0)
        total_amount = Decimal(str(total_amount_val))
        
        # 1. ดึงรายการสั่งซื้อทั้งหมด
        orders_response = ORDERS_TABLE.query(
            IndexName='CustomerID-OrderID-index',
            KeyConditionExpression=Key('CustomerID').eq(customer_id)
        )
        
        orders_items = orders_response.get('Items', [])
        if not orders_items:
             return {'statusCode': 400, 'body': json.dumps({'error': 'No active orders found.'}, ensure_ascii=False)}

        item_count = 0
        reservation_id_to_update = None
        
        for order in orders_items:
            # คำนวณ ItemCount (รองรับทั้ง key 'Items' และ 'Products' ตามเวอร์ชันเก่า/ใหม่)
            # และรองรับทั้ง QTY และ QTY_Product
            products_list = order.get('Items', order.get('Products', []))
            
            for product_item in products_list:
                qty = product_item.get('QTY', product_item.get('QTY_Product', 0))
                item_count += int(qty)
                
            # ดึง ReservationID
            if not reservation_id_to_update:
                reservation_id_to_update = order.get('ReservationID')

        # 2. ดึง CustomerCount จาก Reservations (แก้ไขใหม่: ใช้ Query)
        customer_count = 0
        reservation_date_key = None # ตัวแปรเก็บ Sort Key (Date)
        
        if reservation_id_to_update and reservation_id_to_update != 'N/A':
            # ⚠️ ต้องใช้ Query เพราะเราไม่รู้ Date (Sort Key)
            res_response = RESERVATIONS_TABLE.query(
                KeyConditionExpression=Key('ReservationID').eq(reservation_id_to_update)
            )
            
            if res_response.get('Items'):
                res_item = res_response['Items'][0]
                customer_count = int(res_item.get('NumberOfGuests', 0))
                reservation_date_key = res_item.get('Date') # เก็บ Date ไว้ใช้ตอน Update

        # 3. บันทึกยอดขายลง Sales Table
        sale_id = str(uuid.uuid4())
        sale_date = datetime.now().isoformat() + 'Z'

        SALES_TABLE.put_item(
            Item={
                'SaleID': sale_id,
                'Date': sale_date,
                'ItemCount': item_count, # Resource จะแปลง int เป็น N ให้เอง
                'CustomerCount': customer_count,
                'PaymentType': payment_type,
                'TotalAmount': total_amount # Resource จะแปลง Decimal เป็น N ให้เอง
            }
        )

        # 4. ลบรายการสั่งซื้อเก่าจาก Orders Table
        with ORDERS_TABLE.batch_writer() as batch:
            for item in orders_items:
                # ⚠️ แก้ไข: ใส่แค่ OrderID (Partition Key) 
                # (ถ้าตาราง Orders ของคุณมีแค่ OrderID เป็น PK)
                batch.delete_item(Key={'OrderID': item['OrderID']})

        # 5. อัปเดตสถานะการจองเป็น Complete
        if reservation_id_to_update and reservation_date_key:
            try:
                RESERVATIONS_TABLE.update_item(
                    Key={
                        'ReservationID': reservation_id_to_update,
                        'Date': reservation_date_key # ⚠️ ต้องใส่ Sort Key ด้วย
                    },
                    UpdateExpression='SET #status = :val',
                    ExpressionAttributeNames={'#status': 'Status'},
                    ExpressionAttributeValues={':val': 'Complete'}
                )
            except ClientError as e:
                print(f"Warning: Could not update reservation status: {e}")

        return {
            'statusCode': 200, 
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'SaleID': sale_id, 'Message': 'Checkout successful'}, ensure_ascii=False)
        }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
    
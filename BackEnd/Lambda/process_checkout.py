import json
import boto3
import uuid
from datetime import datetime
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
ORDERS_TABLE = dynamodb.Table('Orders')
SALES_TABLE = 'Sales'
RESERVATIONS_TABLE = 'Reservations'

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        customer_id = body.get('CustomerID')
        payment_type = body.get('PaymentType')
        total_amount = body.get('TotalAmount')
        
        # ส่วนที่ดึงรายการสั่งซื้อ
        orders_response = ORDERS_TABLE.query(
            IndexName='CustomerID-OrderID-index',
            KeyConditionExpression=Key('CustomerID').eq(customer_id)
        )
        
        item_count = 0
        for order in orders_response['Items']:
            for product_item in order.get('Products', []):
                item_count += int(product_item.get('QTY_Product', 0))

        # ส่วนที่ได้รับการแก้ไขสำหรับ CustomerCount
        reservation_response = dynamodb_client.query(
            TableName=RESERVATIONS_TABLE,
            IndexName='CustomerID-Date-index',
            KeyConditionExpression='CustomerID = :val',
            ExpressionAttributeValues={':val': {'S': customer_id}}
        )
        
        # ตรวจสอบว่ามีข้อมูลการจองหรือไม่
        if reservation_response['Items']:
            customer_count = int(reservation_response['Items'][0]['NumberOfGuests']['N'])
        else:
            customer_count = 0  # ตั้งค่าเป็น 0 หากไม่พบการจอง
        
        sale_id = str(uuid.uuid4())
        sale_date = datetime.now().isoformat() + 'Z'

        dynamodb_client.put_item(
            TableName=SALES_TABLE,
            Item={
                'SaleID': {'S': sale_id},
                'Date': {'S': sale_date},
                'ItemCount': {'N': str(item_count)},
                'CustomerCount': {'N': str(customer_count)},
                'PaymentType': {'S': payment_type},
                'TotalAmount': {'N': str(total_amount)}
            }
        )

        with ORDERS_TABLE.batch_writer() as batch:
            for item in orders_response['Items']:
                batch.delete_item(Key={'OrderID': item['OrderID'], 'CustomerID': item['CustomerID']})

        return {'statusCode': 200, 'body': json.dumps({'SaleID': sale_id}, ensure_ascii=False)}
    
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
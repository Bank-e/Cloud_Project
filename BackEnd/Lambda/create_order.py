import json
import boto3
import uuid

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
ORDERS_TABLE = 'Orders'
CUSTOMERS_TABLE = 'Customers' # เพิ่มการอ้างอิงตาราง Customers

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        customer_id = body.get('CustomerID')
        products = body.get('Products')

        # 1. ตรวจสอบ CustomerID ในตาราง Customers (ใช้ GSI: CustomerID-index)
        customer_check = dynamodb_client.query(
            TableName=CUSTOMERS_TABLE,
            IndexName='CustomerID-index', # สมมติว่ามี GSI นี้
            KeyConditionExpression='CustomerID = :cid',
            ExpressionAttributeValues={':cid': {'S': customer_id}}
        )
        if customer_check['Count'] == 0:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Customer ID not found in Customers table.'})
            }
        
        # สร้าง OrderID แบบ UUID
        order_id = str(uuid.uuid4())
        
        # สร้างโครงสร้างข้อมูลสำหรับ DynamoDB List
        items_list = []
        for product in products:
            items_list.append({
                'M': {
                    'ProductID': {'S': product['ProductID']},
                    'QTY_Product': {'N': str(product['QTY_Product'])}
                }
            })

        # บันทึกรายการสั่งซื้อทั้งหมดลงใน DynamoDB เพียงครั้งเดียว
        dynamodb_client.put_item(
            TableName=ORDERS_TABLE,
            Item={
                'OrderID': {'S': order_id}, 
                'CustomerID': {'S': customer_id}, 
                'Products': {'L': items_list} # บันทึก Products เป็น List
            }
        )

        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Order created successfully.', 'OrderID': order_id}, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }
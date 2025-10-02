import json
import boto3
import uuid # สำหรับสร้าง OrderID ที่ไม่ซ้ำกัน

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Orders')

def lambda_handler(event, context):
    try:
        # ดึงข้อมูลจาก body ของ request
        body = json.loads(event.get('body', '{}'))

        # ตรวจสอบข้อมูลที่จำเป็น
        required_fields = ['CustomerID', 'ProductID', 'QTY_Product']
        if not all(field in body for field in required_fields):
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'Missing required fields: CustomerID, ProductID, QTY_Product'})
            }

        # สร้าง OrderID ที่ไม่ซ้ำกัน
        order_id = str(uuid.uuid4())

        # เตรียมข้อมูลสำหรับบันทึกลง DynamoDB
        order_item = {
            'OrderID': order_id,
            'CustomerID': body['CustomerID'],
            'ProductID': body['ProductID'],
            'QTY_Product': int(body['QTY_Product'])
        }

        # บันทึกข้อมูล
        table.put_item(Item=order_item)

        return {
            'statusCode': 201, # 201 Created
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' # ตั้งค่า CORS
            },
            'body': json.dumps({
                'message': 'Order created successfully',
                'OrderID': order_id
            })
        }

    except Exception as e:
        print(e)
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Internal server error'})
        }
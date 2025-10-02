import json
import boto3
from decimal import Decimal

# Custom JSON Encoder เพื่อแปลง Decimal เป็น float
class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super(DecimalEncoder, self).default(o)

dynamodb = boto3.resource('dynamodb')


def lambda_handler(event, context):
    # เชื่อมต่อ DynamoDB tables
    table = dynamodb.Table('Products')
    
    try:
        # ตรวจสอบว่ามี ProductID ส่งมาใน path parameters หรือไม่
        path_params = event.get('pathParameters')
        if path_params and 'productID' in path_params:
            # --- ดึงสินค้าชิ้นเดียว ---
            product_id = path_params['productID']
            response = table.get_item(Key={'ProductID': product_id})
            item = response.get('Item')

            if not item:
                return {
                    'statusCode': 404,
                    'body': json.dumps({'message': 'Product not found'})
                }

            body = json.dumps(item, cls=DecimalEncoder)

        else:
            # --- ดึงสินค้าทั้งหมด ---
            response = table.scan()
            items = response.get('Items', [])
            body = json.dumps(items, cls=DecimalEncoder)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' # ตั้งค่า CORS
            },
            'body': body
        }

    except Exception as e:
        print(e)
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Internal server error'})
        }
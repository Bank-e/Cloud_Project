import json
import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

# --- Configuration ---
REGION_NAME = 'us-east-1'
CUSTOMERS_TABLE = 'Customers'
PHONE_INDEX_NAME = 'PhoneNumber-index' # GSI ที่ใช้ในการค้นหา

DYNAMODB_CLIENT = boto3.client('dynamodb', region_name=REGION_NAME)
CUSTOMERS_RESOURCE = boto3.resource('dynamodb', region_name=REGION_NAME).Table(CUSTOMERS_TABLE)

# --- Helper Function ---
def format_phone_number(phone_number):
    """แปลงเบอร์โทรศัพท์ (0xxxxxxxxx) ให้อยู่ในรูปแบบ E.164 (+66xxxxxxxxx)"""
    phone_number = phone_number.strip()
    # 1. 🟢 ตรวจสอบว่าอยู่ในรูปแบบ E.164 แล้วหรือไม่ (มีเครื่องหมาย +)
    if phone_number.startswith('+'):
        return phone_number
    
    # 2. 🟡 ตรวจสอบว่าเป็นเบอร์ท้องถิ่น (ขึ้นต้นด้วย '0' และยาว 10 หลัก)
    if phone_number.startswith('0') and len(phone_number) == 10:
        # แปลง 09xxxxxxxx เป็น +669xxxxxxxx
        return '+66' + phone_number[1:]

# -----------------------

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        raw_phone_number = body.get('PhoneNumber')
        
        if not raw_phone_number:
            return {'statusCode': 400, 'body': json.dumps({'error': 'PhoneNumber is required.'}, ensure_ascii=False)}

        formatted_phone = format_phone_number(raw_phone_number)
        
        # 1. Query GSI: ค้นหา Customer ด้วยเบอร์โทรศัพท์
        response = CUSTOMERS_RESOURCE.query(
            IndexName=PHONE_INDEX_NAME,
            KeyConditionExpression=Key('PhoneNumber').eq(formatted_phone)
        )
        
        items = response.get('Items')
        
        if not items:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Member not found or phone number is incorrect.'}, ensure_ascii=False)
            }
        
        customer_item = items[0]
        
        # 2. คืนข้อมูลลูกค้าที่สำคัญ
        return {
            'statusCode': 200,
            'body': json.dumps({
                'CustomerID': customer_item.get('CustomerID'),
                'Username': customer_item.get('Username'),
                'PhoneNumber': customer_item.get('PhoneNumber'),
                'Points': int(customer_item.get('Points', 0)),
                'message': 'Customer found successfully.'
            }, ensure_ascii=False, default=str) # ใช้ default=str เพื่อจัดการ Decimal
        }

    except ClientError as e:
        return {'statusCode': 500, 'body': json.dumps({'error': f'DynamoDB Error: {e.response["Error"]["Message"]}'}, ensure_ascii=False)}
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': f'Unexpected Error: {str(e)}'}, ensure_ascii=False)}
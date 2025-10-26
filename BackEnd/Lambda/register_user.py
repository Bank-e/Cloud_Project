import json
import boto3
import uuid
from botocore.exceptions import ClientError

# ตั้งค่า AWS Client และชื่อตาราง
# ตรวจสอบให้แน่ใจว่า 'us-east-1' ตรงกับ Region ที่คุณใช้งาน
dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
CUSTOMERS_TABLE = 'Customers'

def lambda_handler(event, context):
    """
    ฟังก์ชัน Lambda สำหรับการลงทะเบียนผู้ใช้ใหม่ 
    โดยใช้ PutItem พร้อม ConditionExpression เพื่อยืนยันความไม่ซ้ำกันของ Username
    """
    try:
        # 1. รับและแยกข้อมูลจาก Body ของ Request (จาก API Gateway)
        # ตรวจสอบให้แน่ใจว่า API Gateway ได้ตั้งค่าให้ส่ง Body เป็น JSON
        body = json.loads(event['body'])
        username = body.get('username')
        password = body.get('password')
        phone_number = body.get('phoneNumber')
        email = body.get('email')

        # ตรวจสอบข้อมูลพื้นฐาน
        if not username or not password:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'ต้องระบุชื่อผู้ใช้และรหัสผ่าน'}, ensure_ascii=False)
            }

        # 2. สร้าง CustomerID (ใช้ UUID เพื่อให้ไม่ซ้ำกัน)
        customer_id = str(uuid.uuid4())

        dynamodb_client.put_item(
            TableName=CUSTOMERS_TABLE,
            Item={
                # 'Username' คือ Partition Key ตามรูปภาพตาราง
                'Username': {'S': username}, 
                'CustomerID': {'S': customer_id},
                'Password': {'S': password},
                'PhoneNumber': {'S': phone_number},
                'Email': {'S': email},
                'Points': {'N': '0'}
            },
            ConditionExpression='attribute_not_exists(Username)' 
        )
        
        # 4. ส่งคำตอบเมื่อลงทะเบียนสำเร็จ
        return {
            'statusCode': 200, 
            'body': json.dumps({'message': 'ลงทะเบียนสำเร็จ!', 'customer_id': customer_id}, ensure_ascii=False)
        }
    
    except ClientError as e:
        # จัดการเฉพาะข้อผิดพลาดที่เกิดจากการตรวจสอบเงื่อนไขล้มเหลว
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return {
                'statusCode': 400, 
                'body': json.dumps({'error': 'ชื่อผู้ใช้ถูกใช้แล้ว'}, ensure_ascii=False)
            }
        
        # จัดการข้อผิดพลาดอื่นๆ ที่เกิดจาก AWS API
        return {
            'statusCode': 500, 
            'body': json.dumps({'error': f"AWS Error: {e.response['Error']['Message']}"}, ensure_ascii=False)
        }

    except Exception as e:
        # จัดการข้อผิดพลาดทั่วไป (เช่น JSON Parsing ล้มเหลว)
        return {
            'statusCode': 500, 
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }
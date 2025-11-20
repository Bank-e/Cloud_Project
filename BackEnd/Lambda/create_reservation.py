import json
import boto3
import random
from botocore.exceptions import ClientError # จำเป็นสำหรับการจัดการข้อผิดพลาด

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
RESERVATIONS_TABLE = 'Reservations'
CUSTOMERS_TABLE = 'Customers'
# CUSTOMER_ID_INDEX_NAME = 'CustomerID-index' # <-- ลบออก, เพราะเราใช้ PK ของตารางหลัก

def check_customer_exists(customer_id):
    """
    ตรวจสอบว่า CustomerID มีอยู่ในตาราง Customers หรือไม่ โดยใช้ GetItem (Primary Key)

    :param customer_id: CustomerID ที่ต้องการตรวจสอบ (String)
    :return: True หากพบลูกค้า, False หากไม่พบ
    """
    try:
        # เปลี่ยนจากการ Query GSI เป็น GetItem บนตารางหลัก
        response = dynamodb_client.get_item(
            TableName=CUSTOMERS_TABLE,
            Key={
                'CustomerID': {'S': customer_id}
            },
            ProjectionExpression='CustomerID' # ดึงเฉพาะ PK เพื่อประหยัด RCU
        )
        
        # ถ้ามี 'Item' กลับมา แสดงว่าพบลูกค้า
        return 'Item' in response

    except ClientError as e:
        print(f"Error checking CustomerID existence: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        customer_id = body.get('CustomerID')
        date = body.get('Date')
        time = body.get('Time')
        number_of_guests = body.get('NumberOfGuests')

        # ** ขั้นตอนการตรวจสอบ CustomerID **
        if not check_customer_exists(customer_id):
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'CustomerID ที่ระบุไม่พบในระบบ'})
            }
        
        reservation_number = random.randint(100000, 999999)
        reservation_id = f"RES{reservation_number:06d}"
        status = "Confirm"

        dynamodb_client.put_item(
            TableName=RESERVATIONS_TABLE,
            Item={
                'ReservationID': {'S': reservation_id},
                'CustomerID': {'S': customer_id},
                'Date': {'S': date},
                'Time': {'S': time},
                'NumberOfGuests': {'N': str(number_of_guests)},
                'Status': {'S': status}
            }
        )
        return {'statusCode': 200, 'body': json.dumps({'ReservationID': reservation_id}, ensure_ascii=False)}
    except Exception as e:
        # ใช้ str(e) เพื่อรวม ClientError (ถ้ามี) เข้ากับ Exception อื่นๆ
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
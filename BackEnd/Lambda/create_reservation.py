import json
import boto3
import random

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
RESERVATIONS_TABLE = 'Reservations'
CUSTOMERS_TABLE = 'Customers'
CUSTOMER_ID_INDEX_NAME = 'CustomerID-index' # ชื่อ GSI ที่คุณต้องสร้างบนตาราง Customers

def check_customer_exists(customer_id):
    """
    ตรวจสอบว่า CustomerID มีอยู่ในตาราง Customers หรือไม่ โดยใช้ GSI

    :param customer_id: CustomerID ที่ต้องการตรวจสอบ (String)
    :return: True หากพบลูกค้า, False หากไม่พบ
    """
    try:
        response = dynamodb_client.query(
            TableName=CUSTOMERS_TABLE,
            IndexName=CUSTOMER_ID_INDEX_NAME,
            KeyConditionExpression='CustomerID = :cid',
            ExpressionAttributeValues={
                ':cid': {'S': customer_id}
            },
            Select='COUNT' # ดึงแค่จำนวนรายการเพื่อประหยัด RCU
        )
        
        # ถ้า Count มากกว่า 0 แสดงว่าพบลูกค้า
        return response['Count'] > 0

    except ClientError as e:
        print(f"Error checking CustomerID existence: {e}")
        # หาก GSI ไม่มีอยู่จริง จะต้องมีการจัดการ Error นี้
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
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
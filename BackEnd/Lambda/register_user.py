import json
import boto3
import uuid

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
CUSTOMERS_TABLE = 'Customers'

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        username = body.get('username')
        password = body.get('password')
        phone_number = body.get('phoneNumber')
        email = body.get('email')

        # Check if the username already exists using the GSI
        response = dynamodb_client.query(
            TableName=CUSTOMERS_TABLE,
            IndexName='Username-index',  # ระบุชื่อ GSI ที่นี่
            KeyConditionExpression='Username = :uname',
            ExpressionAttributeValues={
                ':uname': {'S': username}
            }
        )
        if response['Count'] > 0:
            return {
                'statusCode': 400, 
                'body': json.dumps({'error': 'ชื่อผู้ใช้ถูกใช้แล้ว'}, ensure_ascii=False)
            }

        # Generate a unique CustomerID
        customer_id = str(uuid.uuid4())

        # Save new user to DynamoDB
        dynamodb_client.put_item(
            TableName=CUSTOMERS_TABLE,
            Item={
                'CustomerID': {'S': customer_id},
                'Username': {'S': username},
                'Password': {'S': password},
                'PhoneNumber': {'S': phone_number},
                'Email': {'S': email},
                'Points': {'N': '0'}
            }
        )
        
        return {'statusCode': 200, 'body': json.dumps({'message': 'ลงทะเบียนสำเร็จ!'}, ensure_ascii=False)}
    
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
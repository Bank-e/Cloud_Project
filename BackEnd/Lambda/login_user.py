import json
import boto3

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
CUSTOMERS_TABLE = 'Customers'

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        username = body.get('username')
        password = body.get('password')

        response = dynamodb_client.query(
            TableName=CUSTOMERS_TABLE,
            KeyConditionExpression='Username = :uname',
            ExpressionAttributeValues={
                ':uname': {'S': username}
            }
        )
        
        if response['Count'] == 0:
            return {'statusCode': 401, 'body': json.dumps({'error': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'}, ensure_ascii=False)}
            
        item = response['Items'][0]
        
        if item.get('Password', {}).get('S') != password:
            return {'statusCode': 401, 'body': json.dumps({'error': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'}, ensure_ascii=False)}

        # Login successful, return user data
        return {
            'statusCode': 200,
            'body': json.dumps({
                # สันนิษฐานว่ามี CustomerID เป็น attribute แต่ไม่ใช่ key
                'CustomerID': item.get('CustomerID', {}).get('S'), 
                'Username': item['Username']['S'],
                'PhoneNumber': item['PhoneNumber']['S'],
                'Points': int(item['Points']['N'])
            }, ensure_ascii=False)
        }

    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
import json
import boto3

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
SALES_TABLE = 'Sales'

def lambda_handler(event, context):
    try:
        response = dynamodb_client.scan(TableName=SALES_TABLE)
        
        sales_history = []
        for item in response['Items']:
            sales_history.append({
                'Date': item['Date']['S'],
                'ItemCount': int(item['ItemCount']['N']),
                'CustomerCount': int(item['CustomerCount']['N']),
                'PaymentType': item['PaymentType']['S'],
                'TotalAmount': float(item['TotalAmount']['N'])  # แก้ไขตรงนี้
            })
            
        return {'statusCode': 200, 'body': json.dumps(sales_history, ensure_ascii=False)}
    
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
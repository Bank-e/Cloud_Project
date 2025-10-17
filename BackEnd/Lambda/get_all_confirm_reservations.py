import json
import boto3
from boto3.dynamodb.conditions import Attr

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
RESERVATIONS_TABLE = 'Reservations'

def lambda_handler(event, context):
    try:
        response = dynamodb_client.scan(
            TableName=RESERVATIONS_TABLE,
            FilterExpression=Attr('Status').eq('Confirm')
        )

        reservations = []
        for item in response['Items']:
            reservations.append({
                'CustomerID': item['CustomerID']['S'],
                'Date': item['Date']['S'],
                'Time': item['Time']['S'],
                'NumberOfGuests': int(item['NumberOfGuests']['N']),
                'Status': item['Status']['S']
            })
        
        return {'statusCode': 200, 'body': json.dumps(reservations, ensure_ascii=False)}

    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
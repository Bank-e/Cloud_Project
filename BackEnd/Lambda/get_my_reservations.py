import json
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
RESERVATIONS_TABLE = dynamodb.Table('Reservations')

def lambda_handler(event, context):
    try:
        customer_id = event['queryStringParameters']['CustomerID']
        
        response = RESERVATIONS_TABLE.query(
            IndexName='CustomerID-Date-index',
            KeyConditionExpression=Key('CustomerID').eq(customer_id)
        )

        reservations = []
        for item in response['Items']:
            reservations.append({
                'ReservationID': item['ReservationID'],
                'Date': item['Date'],
                'Time': item['Time'],
                'NumberOfGuests': int(item['NumberOfGuests']),
                'Status': item['Status']
            })

        return {'statusCode': 200, 'body': json.dumps(reservations, ensure_ascii=False)}

    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
import json
import boto3

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
RESERVATIONS_TABLE = 'Reservations'

def lambda_handler(event, context):
    try:
        reservation_id = event['pathParameters']['reservationId']

        response = dynamodb_client.get_item(
            TableName=RESERVATIONS_TABLE,
            Key={'ReservationID': {'S': reservation_id}}
        )

        item = response.get('Item')
        if not item:
            return {'statusCode': 404, 'body': json.dumps({'error': 'Reservation not found.'}, ensure_ascii=False)}

        reservation_data = {
            'Date': item['Date']['S'],
            'Time': item['Time']['S'],
            'NumberOfGuests': int(item['NumberOfGuests']['N'])
        }

        return {'statusCode': 200, 'body': json.dumps(reservation_data, ensure_ascii=False)}

    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
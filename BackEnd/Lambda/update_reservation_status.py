import json
import boto3

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
RESERVATIONS_TABLE = 'Reservations'

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        reservation_id = body.get('ReservationID')
        customer_id = body.get('CustomerID') # เพิ่ม CustomerID เข้ามา
        new_status = body.get('Status')

        if not reservation_id or not customer_id or not new_status:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'ReservationID, CustomerID, and Status are required.'}, ensure_ascii=False)
            }

        dynamodb_client.update_item(
            TableName=RESERVATIONS_TABLE,
            Key={
                'ReservationID': {'S': reservation_id},
                #'CustomerID': {'S': customer_id} # เพิ่ม CustomerID ใน Key
            },
            UpdateExpression='SET #status = :val',
            ExpressionAttributeNames={'#status': 'Status'},
            ExpressionAttributeValues={':val': {'S': new_status}}
        )

        return {
            'statusCode': 200,
            'body': json.dumps({'message': f'Reservation {reservation_id} status updated to {new_status}.'}, ensure_ascii=False)
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }

import json
import boto3

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
RESERVATIONS_TABLE = 'Reservations'

def lambda_handler(event, context):
    try:
        # ใช้ FilterExpression และ ExpressionAttributeValues ที่ถูกต้องสำหรับ boto3.client
        response = dynamodb_client.scan(
            TableName=RESERVATIONS_TABLE,
            FilterExpression='#status = :val', 
            ExpressionAttributeNames={
                '#status': 'Status'
            },
            ExpressionAttributeValues={
                ':val': {'S': 'Confirm'}
            }
        )

        reservations = []
        for item in response['Items']:
            num_guests_str = item.get('NumberOfGuests', {}).get('N')
            
            # แปลงเป็น int หากมีค่า มิฉะนั้นให้เป็น 0 หรือค่าเริ่มต้น
            num_guests = int(num_guests_str) if num_guests_str else 0
            
            # ดึง ReservationID และ CustomerID อย่างปลอดภัย
            res_id = item.get('ReservationID', {}).get('S', 'N/A')
            cust_id = item.get('CustomerID', {}).get('S', 'N/A')
            
            reservations.append({
                'ReservationID': res_id, # ดึงค่าอย่างปลอดภัย
                'CustomerID': cust_id, # ดึงค่าอย่างปลอดภัย
                'Date': item.get('Date', {}).get('S', 'N/A'),
                'Time': item.get('Time', {}).get('S', 'N/A'),
                'NumberOfGuests': num_guests,
                'Status': item.get('Status', {}).get('S', 'N/A')
            })
        
        return {'statusCode': 200, 'body': json.dumps(reservations, ensure_ascii=False)}

    except Exception as e:
        # ตรวจสอบและพิมพ์ข้อผิดพลาดเพื่อ Debug
        print(f"Error in get_all_confirm_reservations: {str(e)}")
        # คืนค่าข้อผิดพลาดที่เป็นมิตร
        return {'statusCode': 500, 'body': json.dumps({'error': 'Internal server error during reservation data processing.'}, ensure_ascii=False)}
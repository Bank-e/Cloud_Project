import json
import boto3
from datetime import datetime
from botocore.exceptions import ClientError

# --- Configuration ---
REGION_NAME = 'us-east-1'
PROMOTIONS_TABLE = 'RewardsPromotions'

dynamodb_client = boto3.client('dynamodb', region_name=REGION_NAME)

# --- Helper Functions to safely extract data ---

def get_safe_number(item_dict, key):
    """ดึงค่าตัวเลขจาก DynamoDB (N) และแปลงเป็น int, คืนค่า 0 หากไม่พบ"""
    try:
        # ใช้ .get('N', '0') เพื่อให้ได้ค่า '0' แทนการเกิด KeyError
        value_str = item_dict.get(key, {}).get('N', '0')
        return int(value_str)
    except ValueError:
        # ป้องกันกรณีที่ค่าใน DB ไม่ใช่ตัวเลข
        return 0

def get_safe_string(item_dict, key):
    """ดึงค่า String จาก DynamoDB (S) หรือคืนค่า None หากไม่พบ"""
    return item_dict.get(key, {}).get('S', None)

# --------------------------------------------------

def lambda_handler(event, context):
    try:
        # 1. กำหนดวันที่ปัจจุบัน
        today = datetime.now().strftime('%Y-%m-%d')
        
        # 2. Scan ตารางและ Filter ตามวันที่ (ยังคงต้อง Scan เพราะไม่มี Index สำหรับ Date Range)
        response = dynamodb_client.scan(
            TableName=PROMOTIONS_TABLE,
            FilterExpression='StartDate <= :today_val AND EndDate >= :today_val',
            ExpressionAttributeValues={
                ':today_val': {'S': today}
            }
        )

        promotions = []
        for item in response['Items']:
            
            # 3. เตรียมข้อมูล Output โดยดึง Attribute ใหม่ทั้งหมดอย่างปลอดภัย
            promo = {
                'Code': get_safe_string(item, 'Code'),
                'Description': get_safe_string(item, 'Description'),
                'StartDate': get_safe_string(item, 'StartDate'),
                'EndDate': get_safe_string(item, 'EndDate'),
                
                # --- เงื่อนไข/ส่วนลด ---
                'MinSpend': get_safe_number(item, 'MinSpend'),
                'MinPoint': get_safe_number(item, 'MinPoint'),
                'DiscountValue': get_safe_number(item, 'DiscountValue'),
                'DiscountPercent': get_safe_number(item, 'DiscountPercent'),
                
                # --- ของแถม/แต้มสะสม ---
                'BonusProductID': get_safe_string(item, 'BonusProductID'),
                'BonusQty': get_safe_number(item, 'BonusQty'),
                'RewardPoints': get_safe_number(item, 'RewardPoints')
            }
            
            promotions.append(promo)
        
        # 4. คืนค่ารายการโปรโมชั่นที่กรองแล้ว
        return {'statusCode': 200, 'body': json.dumps(promotions, ensure_ascii=False)}

    except ClientError as e:
        return {'statusCode': 500, 'body': json.dumps({'error': f'DynamoDB Error: {e.response["Error"]["Message"]}'}, ensure_ascii=False)}
        
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': f'Unexpected Error: {str(e)}'}, ensure_ascii=False)}
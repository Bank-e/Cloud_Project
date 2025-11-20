import json
import boto3
from botocore.exceptions import ClientError

# --- Configuration ---
REGION_NAME = 'us-east-1'
CUSTOMERS_TABLE = 'Customers'
PROMOTIONS_TABLE = 'RewardsPromotions'

DYNAMODB_CLIENT = boto3.client('dynamodb', region_name=REGION_NAME)
# -----------------------

# --- Helper Functions ---
def get_db_item(table_name, key_name, key_value):
    """Generic GetItem utility"""
    return DYNAMODB_CLIENT.get_item(
        TableName=table_name,
        Key={key_name: {'S': key_value}}
    ).get('Item')

def get_db_num(item_dict, key):
    """Safely extracts and converts DynamoDB Number (N) type to int/float"""
    value = item_dict.get(key, {}).get('N', '0')
    try:
        return float(value)
    except ValueError:
        return 0.0

# -----------------------

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        customer_id = body.get('CustomerID')
        current_total = float(body.get('TotalAmount')) # ยอดรวมก่อนหักส่วนลด
        promo_codes = body.get('PromoCodes', []) # Array ของโค้ดที่ลูกค้า/พนักงานเลือก
        
        if not customer_id:
            return {'statusCode': 400, 'body': json.dumps({'error': 'CustomerID is required.'}, ensure_ascii=False)}

        # 1. 💾 ดึงข้อมูลลูกค้า (เพื่อตรวจสอบแต้ม)
        customer_item = get_db_item(CUSTOMERS_TABLE, 'CustomerID', customer_id)
        if not customer_item:
             return {'statusCode': 404, 'body': json.dumps({'error': 'Customer profile not found.'}, ensure_ascii=False)}
        
        current_points = get_db_num(customer_item, 'Points')
        
        # 2. 🛡️ คำนวณส่วนลดและตรวจสอบเงื่อนไข
        final_discount = 0.0
        points_to_deduct = 0
        free_items = []
        
        for code in promo_codes:
            promo_item = get_db_item(PROMOTIONS_TABLE, 'Code', code)
            
            if promo_item:
                min_point = get_db_num(promo_item, 'MinPoint')
                min_spend = get_db_num(promo_item, 'MinSpend')
                
                # A. เงื่อนไขแต้มสะสม
                if min_point > 0:
                    if (points_to_deduct + min_point) > current_points:
                        # ข้ามโปรโมชั่นนี้เพราะแต้มไม่พอ
                        continue 
                    points_to_deduct += min_point
                
                # B. เงื่อนไขยอดใช้จ่ายขั้นต่ำ
                if min_spend > 0 and current_total < min_spend:
                    continue 

                # C. คำนวณส่วนลด (ใช้ได้แค่ 1 สิทธิ์ต่อประเภท - Logic นี้จะคำนวณทั้งหมด)
                final_discount += get_db_num(promo_item, 'DiscountValue')
                final_discount += current_total * (get_db_num(promo_item, 'DiscountPercent') / 100)
                
                # D. ของแถม
                if promo_item.get('BonusProductID'):
                    free_items.append({
                        'ProductID': promo_item['BonusProductID']['S'],
                        'Qty': int(get_db_num(promo_item, 'BonusQty')),
                        'Description': promo_item.get('Description', {}).get('S')
                    })


        # 3. สรุปผลลัพธ์
        final_payable = current_total - final_discount
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'OriginalTotal': current_total,
                'TotalDiscount': round(final_discount, 2),
                'FinalPayable': round(final_payable, 2),
                'PointsDeducted': points_to_deduct,
                'FreeItems': free_items
            }, ensure_ascii=False)
        }

    except ClientError as e:
        return {'statusCode': 500, 'body': json.dumps({'error': f'DynamoDB Error: {e.response["Error"]["Message"]}'}, ensure_ascii=False)}
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': f'Unexpected Error: {str(e)}'}, ensure_ascii=False)}
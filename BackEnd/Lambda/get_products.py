import json
import boto3
from decimal import Decimal

# Custom JSON Encoder (คงเดิมไว้)
class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super(DecimalEncoder, self).default(o)

dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    table = dynamodb.Table('Products')
    
    try:
        path_params = event.get('pathParameters')
        items_to_return = [] # สร้างตัวแปรมารับข้อมูล

        if path_params and 'productID' in path_params:
            # --- ดึงสินค้าชิ้นเดียว ---
            product_id = path_params['productID']
            response = table.get_item(Key={'ProductID': product_id})
            item = response.get('Item')
            if item:
                items_to_return = [item] # ใส่ list เพื่อให้ process เหมือนกัน
            else:
                return {
                    'statusCode': 404,
                    'body': json.dumps({'message': 'Product not found'}, ensure_ascii=False)
                }
        else:
            # --- ดึงสินค้าทั้งหมด ---
            response = table.scan()
            items_to_return = response.get('Items', [])

        # ==========================================
        # 🔴 ส่วนที่เพิ่ม: บังคับแปลง ProductPrice เป็น float
        # ==========================================
        for item in items_to_return:
            if 'ProductPrice' in item:
                # แปลงเป็น float ไม่ว่าต้นทางจะเป็น String หรือ Decimal
                item['ProductPrice'] = float(item['ProductPrice']) 

        # ถ้าเป็นเคส productID เดียว ให้เอาออกจาก list (ถ้าต้องการ return object เดียว)
        if path_params and 'productID' in path_params:
             final_body = items_to_return[0]
        else:
             final_body = items_to_return

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            # ไม่ต้องใช้ cls=DecimalEncoder แล้วก็ได้ เพราะเราแปลงเป็น float เองแล้ว
            # แต่ใส่ไว้กันเหนียวสำหรับ field อื่นที่เป็น Decimal
            'body': json.dumps(final_body, cls=DecimalEncoder, ensure_ascii=False)
        }

    except Exception as e:
        print(e)
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Internal server error', 'error': str(e)}, ensure_ascii=False)
        }
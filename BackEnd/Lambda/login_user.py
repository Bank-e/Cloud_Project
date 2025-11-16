import json
import boto3
import logging
from botocore.exceptions import ClientError

# --- ⚠️ Configuration ---
USER_POOL_ID = '44685408-30a1-701e-b3f8-eb06f399956e'  
APP_CLIENT_ID = '5bdjhh58rfudoj736qt9nskniq'
CUSTOMERS_TABLE = 'Customers' 
REGION_NAME = 'us-east-1'
CUSTOMER_GSI_NAME = 'CustomerID-index' 

COGNITO_CLIENT = boto3.client('cognito-idp', region_name=REGION_NAME)
DYNAMODB_CLIENT = boto3.client('dynamodb', region_name=REGION_NAME)

# ตั้งค่า Logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)
# -------------------------

def lambda_handler(event, context):
    step = "initialization"  # ติดตามว่าอยู่ขั้นตอนไหน
    
    try:
        # STEP 1: Parse Request Body
        step = "parsing_request_body"
        logger.info(f"[{step}] กำลังแปลง request body")
        body = json.loads(event['body'])
        username = body['username']
        password = body['password']
        logger.info(f"[{step}] ✓ Username: {username}")
        
        # STEP 2: Cognito Authentication
        step = "cognito_authentication"
        logger.info(f"[{step}] กำลังยืนยันตัวตนกับ Cognito")
        auth_response = COGNITO_CLIENT.initiate_auth(
            ClientId=APP_CLIENT_ID,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': username,
                'PASSWORD': password
            }
        )
        auth_result = auth_response['AuthenticationResult']
        access_token = auth_result['AccessToken']
        logger.info(f"[{step}] ✓ ยืนยันตัวตนสำเร็จ")
        
        # STEP 3: Get CustomerID from Cognito
        step = "get_cognito_user_info"
        logger.info(f"[{step}] กำลังดึงข้อมูลผู้ใช้จาก Cognito")
        user_info = COGNITO_CLIENT.get_user(AccessToken=access_token)
        
        customer_id = next(
            (attr['Value'] for attr in user_info['UserAttributes'] if attr['Name'] == 'sub'),
            None
        )
        
        if not customer_id:
            logger.error(f"[{step}] ✗ ไม่พบ CustomerID (sub) ใน Cognito")
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'ไม่สามารถดึง Cognito ID ได้',
                    'step': step
                }, ensure_ascii=False)
            }
        
        logger.info(f"[{step}] ✓ CustomerID: {customer_id}")
        
        # 4. 💾 DynamoDB Retrieval: ดึงข้อมูลแอปพลิเคชัน (ใช้ CustomerID เป็น PK)
        step = "dynamodb_retrieval"
        logger.info(f"[{step}] กำลังดึงข้อมูลจาก DynamoDB ผ่าน GSI: {CUSTOMER_GSI_NAME}")
        
        # 🚀 ใช้ QUERY บน GSI เพื่อค้นหาด้วย CustomerID
        db_response = DYNAMODB_CLIENT.query(
            TableName=CUSTOMERS_TABLE,
            IndexName=CUSTOMER_GSI_NAME,
            KeyConditionExpression='CustomerID = :customer_id',
            ExpressionAttributeValues={
                ':customer_id': {'S': customer_id}
            }
        )
        
        items = db_response.get('Items', [])
        db_item = items[0] if items else None
        
        # STEP 5: Prepare Customer Data (รวม UserRole จาก DB)
        step = "prepare_customer_data"
        
        if db_item:
            logger.info(f"[{step}] ✓ พบข้อมูลลูกค้าใน DynamoDB")
            
            # 🎯 ดึง UserRole จาก DynamoDB โดยตรง
            user_role_from_db = db_item.get('UserRole', {'S': 'Customer'}).get('S')
            points_value = db_item.get('Points', {'N': '0'}).get('N')

            customer_data = {
                'CustomerID': db_item.get('CustomerID', {}).get('S'),
                'Username': db_item.get('Username', {}).get('S'),
                'PhoneNumber': db_item.get('PhoneNumber', {}).get('S'),
                'Email': db_item.get('Email', {}).get('S'),
                'Points': int(points_value),
                'UserRole': user_role_from_db # ใช้ค่าที่ดึงมาจาก DynamoDB
            }
        else:
            logger.warning(f"[{step}] ⚠ ไม่พบข้อมูลใน DynamoDB, ใช้ข้อมูลพื้นฐาน")
            # ถ้าไม่พบใน DB แสดงว่า Post-Confirmation ล้มเหลว
            customer_data = {'CustomerID': customer_id, 'Username': username, 'Points': 0, 'UserRole': 'Customer'}

        # STEP 6: Return Success Response
        step = "return_response"
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Login สำเร็จ',
                'Tokens': {
                    'IdToken': auth_result['IdToken'],
                    'AccessToken': access_token,
                    'ExpiresIn': auth_result['ExpiresIn'],
                },
                **customer_data # ส่งข้อมูลลูกค้าทั้งหมดกลับไป
            }, ensure_ascii=False)
        }

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        
        logger.error(f"[{step}] ✗ ClientError: {error_code} - {error_message}")
        
        # จัดการ Error แยกตาม step
        if step == "cognito_authentication":
            if error_code == 'NotAuthorizedException':
                msg = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
            elif error_code == 'UserNotFoundException':
                msg = 'ไม่พบผู้ใช้นี้ในระบบ'
            elif error_code == 'UserNotConfirmedException':
                msg = 'บัญชียังไม่ถูกยืนยัน'
            else:
                msg = f'ไม่สามารถเข้าสู่ระบบได้: {error_code}'
            
            return {
                'statusCode': 401,
                'body': json.dumps({
                    'error': msg,
                    'code': error_code,
                    'step': step
                }, ensure_ascii=False)
            }
        
        # Error จาก DynamoDB หรืออื่นๆ
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': error_code,
                'message': error_message,
                'step': step
            }, ensure_ascii=False)
        }

    except KeyError as e:
        logger.error(f"[{step}] ✗ KeyError: ขาดข้อมูล {str(e)}")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': f'ขาดข้อมูลที่จำเป็น: {str(e)}',
                'step': step
            }, ensure_ascii=False)
        }

    except Exception as e:
        logger.error(f"[{step}] ✗ Unexpected Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
                'message': str(e),
                'step': step
            }, ensure_ascii=False)
        }


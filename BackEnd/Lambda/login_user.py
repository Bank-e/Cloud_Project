import json
import boto3
import logging
import hmac
import hashlib
import base64
from botocore.exceptions import ClientError

# ========================================
# Configuration
# ========================================
USER_POOL_ID = 'us-east-1_0Ga5JJhMu'  
APP_CLIENT_ID = '7fn1fd6cpnrvtpogg0r7mvqh3v'
APP_CLIENT_SECRET = '1id6c8tdvg7e3av436orti82pp05er7lnsrbgruo5ln65d6rsftl'  # <--- 🔴 ใส่ Client Secret จาก Cognito ตรงนี้
CUSTOMERS_TABLE = 'Customers'
REGION_NAME = 'us-east-1'

# Initialize AWS Clients
COGNITO_CLIENT = boto3.client('cognito-idp', region_name=REGION_NAME)
DYNAMODB_CLIENT = boto3.client('dynamodb', region_name=REGION_NAME)

# Configure Logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ========================================
# Helper Functions
# ========================================
def calculate_secret_hash(username, client_id, client_secret):
    """
    คำนวณ SecretHash สำหรับส่งให้ Cognito ในกรณีที่ App Client มี Secret
    """
    message = username + client_id
    dig = hmac.new(
        str(client_secret).encode('utf-8'), 
        msg=str(message).encode('utf-8'), 
        digestmod=hashlib.sha256
    ).digest()
    return base64.b64encode(dig).decode()

# ========================================
# Lambda Handler
# ========================================
def lambda_handler(event, context):
    step = "initialization"
    
    try:
        # ========================================
        # STEP 1: Parse Request Body
        # ========================================
        step = "parsing_request_body"
        logger.info(f"[{step}] กำลังแปลง request body")
        
        body = json.loads(event['body'])
        username = body['username']
        password = body['password']
        
        logger.info(f"[{step}] ✓ Username: {username}")
        
        # ========================================
        # STEP 2: Cognito Authentication (With Secret Hash)
        # ========================================
        step = "cognito_authentication"
        logger.info(f"[{step}] กำลังยืนยันตัวตนกับ Cognito")
        
        # คำนวณ Secret Hash
        secret_hash = calculate_secret_hash(username, APP_CLIENT_ID, APP_CLIENT_SECRET)
        
        auth_response = COGNITO_CLIENT.initiate_auth(
            ClientId=APP_CLIENT_ID,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': username,
                'PASSWORD': password,
                'SECRET_HASH': secret_hash  # <--- ส่ง Hash ไปด้วย
            }
        )
        
        auth_result = auth_response['AuthenticationResult']
        access_token = auth_result['AccessToken']
        
        logger.info(f"[{step}] ✓ ยืนยันตัวตนสำเร็จ")
        
        # ========================================
        # STEP 3: Get CustomerID from Cognito
        # ========================================
        step = "get_cognito_user_info"
        logger.info(f"[{step}] กำลังดึงข้อมูลผู้ใช้จาก Cognito")
        
        user_info = COGNITO_CLIENT.get_user(AccessToken=access_token)
        
        customer_id = next(
            (attr['Value'] for attr in user_info['UserAttributes'] 
             if attr['Name'] == 'sub'),
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
        
        # ========================================
        # STEP 4: DynamoDB Retrieval
        # ========================================
        step = "dynamodb_retrieval"
        logger.info(f"[{step}] กำลังดึงข้อมูลจาก DynamoDB ผ่าน Primary Key")
        
        db_response = DYNAMODB_CLIENT.get_item(
            TableName=CUSTOMERS_TABLE,
            Key={
                'CustomerID': {'S': customer_id}
            }
        )
        
        db_item = db_response.get('Item')
        
        # ========================================
        # STEP 5: Prepare Customer Data
        # ========================================
        step = "prepare_customer_data"
        
        if db_item:
            logger.info(f"[{step}] ✓ พบข้อมูลลูกค้าใน DynamoDB")
            
            user_role_from_db = db_item.get('UserRole', {'S': 'Customer'}).get('S')
            points_value = db_item.get('Points', {'N': '0'}).get('N')
            
            customer_data = {
                'CustomerID': db_item.get('CustomerID', {}).get('S'),
                'Username': db_item.get('Username', {}).get('S'),
                'PhoneNumber': db_item.get('PhoneNumber', {}).get('S'),
                'Email': db_item.get('Email', {}).get('S'),
                'Points': int(points_value),
                'UserRole': user_role_from_db
            }
        else:
            logger.warning(f"[{step}] ⚠ ไม่พบข้อมูลใน DynamoDB, ใช้ข้อมูลพื้นฐาน")
            customer_data = {
                'CustomerID': customer_id,
                'Username': username,
                'Points': 0,
                'UserRole': 'Customer'
            }
        
        # ========================================
        # STEP 6: Return Success Response
        # ========================================
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
                **customer_data
            }, ensure_ascii=False)
        }
    
    # ========================================
    # Error Handling
    # ========================================
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        
        logger.error(f"[{step}] ✗ ClientError: {error_code} - {error_message}")
        
        # Handle Cognito Authentication Errors
        if step == "cognito_authentication":
            error_messages = {
                'NotAuthorizedException': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (หรือ Secret ผิด)',
                'UserNotFoundException': 'ไม่พบผู้ใช้นี้ในระบบ',
                'UserNotConfirmedException': 'บัญชียังไม่ถูกยืนยัน',
                'PasswordResetRequiredException': 'กรุณารีเซ็ตรหัสผ่านใหม่'
            }
            
            msg = error_messages.get(
                error_code, 
                f'ไม่สามารถเข้าสู่ระบบได้: {error_code}'
            )
            
            return {
                'statusCode': 401,
                'body': json.dumps({
                    'error': msg,
                    'code': error_code,
                    'step': step
                }, ensure_ascii=False)
            }
        
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
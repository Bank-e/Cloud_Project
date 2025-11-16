import json
import boto3
import logging
from botocore.exceptions import ClientError

USER_POOL_ID = 'us-east-1_Z1Y2xTrtU'  
APP_CLIENT_ID = '5bdjhh58rfudoj736qt9nskniq'
COGNITO_CLIENT = boto3.client('cognito-idp', region_name='us-east-1')

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def format_phone_number(phone_number):
    """
    ตรวจสอบและแปลงเบอร์โทรศัพท์ให้อยู่ในรูปแบบ E.164 (+66xxxxxxxxx)
    :param phone_number: เบอร์โทรที่ผู้ใช้กรอก (เช่น 0988887474)
    :return: เบอร์โทรที่ถูกต้องตามมาตรฐาน E.164
    """
    if not phone_number:
        return None
        
    phone_number = phone_number.strip()
    
    # 1. ถ้าผู้ใช้กรอกเบอร์ขึ้นต้นด้วย 0
    if phone_number.startswith('0') and len(phone_number) == 10:
        # แทนที่ 0 ตัวแรกด้วย +66
        return '+66' + phone_number[1:]
    
    # 2. ถ้าผู้ใช้กรอกรหัสประเทศ (+66) มาแล้ว ก็คืนค่าเดิม
    if phone_number.startswith('+'):
        return phone_number
    
    # 3. กรณีอื่นๆ (อาจเป็นเบอร์สั้น หรือรูปแบบผิดพลาด)
    return phone_number

def lambda_handler(event, context):
    step = "initialization"
    
    try:
        step = "parsing_request_body"
        logger.info(f"[{step}] กำลังแปลง request body")
        
        body = json.loads(event['body'])
        username = body['username']
        password = body['password']
        email = body.get('email')
        phone_number = body.get('phoneNumber')
        
        # แปลงเบอร์โทรให้เป็น E.164 format
        if phone_number:
            formatted_phone = format_phone_number(phone_number)
            logger.info(f"[{step}] Phone format: {phone_number} → {formatted_phone}")
            phone_number = formatted_phone
        
        logger.info(f"[{step}] ✓ Username: {username}, Email: {email}, Phone: {phone_number}")
        
        step = "cognito_signup"
        logger.info(f"[{step}] กำลังลงทะเบียนกับ Cognito")
        
        user_attributes = []
        if email:
            user_attributes.append({'Name': 'email', 'Value': email})
        if phone_number:
            user_attributes.append({'Name': 'phone_number', 'Value': phone_number})
        
        response = COGNITO_CLIENT.sign_up(
            ClientId=APP_CLIENT_ID,
            Username=username,
            Password=password,
            UserAttributes=user_attributes
        )
        
        logger.info(f"[{step}] ✓ ลงทะเบียนสำเร็จ, UserSub: {response['UserSub']}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'ลงทะเบียนสำเร็จ!', 
                'UserSub': response['UserSub'],
                'UserConfirmed': response.get('UserConfirmed', False)
            }, ensure_ascii=False)
        }

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"[{step}] ✗ ClientError: {error_code} - {error_message}")
        
        if error_code == 'UsernameExistsException':
            msg = 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว'
        elif error_code == 'InvalidPasswordException':
            msg = 'รหัสผ่านไม่ตรงตามเงื่อนไข'
        elif error_code == 'InvalidParameterException':
            msg = f'พารามิเตอร์ไม่ถูกต้อง: {error_message}'
        else:
            msg = f'ไม่สามารถลงทะเบียนได้: {error_code}'
        
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': msg,
                'code': error_code,
                'step': step
            }, ensure_ascii=False)
        }

    except Exception as e:
        logger.error(f"[{step}] ✗ Unexpected Error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'เกิดข้อผิดพลาด',
                'message': str(e),
                'step': step
            }, ensure_ascii=False)
        }
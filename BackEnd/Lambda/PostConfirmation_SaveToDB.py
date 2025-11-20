import json
import boto3
import logging
from botocore.exceptions import ClientError

DYNAMODB_CLIENT = boto3.client('dynamodb', region_name='us-east-1')
COGNITO_CLIENT = boto3.client('cognito-idp', region_name='us-east-1')
CUSTOMERS_TABLE = 'Customers'
USER_POOL_ID = 'us-east-1_0Ga5JJhMu'  

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    step = "initialization"
    
    try:
        logger.info("=== Post Confirmation Trigger Started ===")
        logger.info(f"Event: {json.dumps(event, ensure_ascii=False)}")
        
        step = "extract_user_data"
        user_attributes = event['request']['userAttributes']
        customer_id = user_attributes['sub']
        username = event['userName']
        email = user_attributes.get('email', '').lower()
        phone_number = user_attributes.get('phone_number', '')
        
        logger.info(f"[{step}] CustomerID: {customer_id}, Username: {username}")
        
        # STEP: Add user to appropriate Cognito Group
        step = "add_to_cognito_group"
        if '@cat' in email or '@catexcalibur' in email:
            group_name = 'Admins'
        else:
            group_name = 'Customers'
        
        try:
            logger.info(f"[{step}] Adding user to group: {group_name}")
            COGNITO_CLIENT.admin_add_user_to_group(
                UserPoolId=USER_POOL_ID,
                Username=username,
                GroupName=group_name
            )
            logger.info(f"[{step}] ✓ User added to {group_name} group")
        except ClientError as e:
            logger.warning(f"[{step}] Could not add to group: {e.response['Error']['Code']}")
        
        step = "dynamodb_insert"
        logger.info(f"[{step}] กำลังบันทึกข้อมูลลง DynamoDB")
        
        # กำหนด UserRole ตามโดเมนอีเมล
        if '@cat' in email or '@catexcalibur' in email:
            user_role = 'Admins'
        else:
            user_role = 'Customers'
        
        item = {
            'CustomerID': {'S': customer_id},
            'Username': {'S': username},
            'Email': {'S': email},
            'PhoneNumber': {'S': phone_number},
            'Points': {'N': '0'},
            'UserRole': {'S': user_role}  # ← เพิ่ม UserRole
        }
        
        logger.info(f"[{step}] Item: {item}")
        logger.info(f"[{step}] UserRole: {user_role}")
        
        DYNAMODB_CLIENT.put_item(
            TableName=CUSTOMERS_TABLE,
            Item=item
        )
        
        logger.info(f"[{step}] ✓ บันทึกข้อมูลสำเร็จ")
        logger.info("=== Post Confirmation Trigger Completed ===")
        
        return event
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"[{step}] ✗ ClientError: {error_code} - {error_message}")
        raise
    
    except Exception as e:
        logger.error(f"[{step}] ✗ Unexpected Error: {str(e)}", exc_info=True)
        raise
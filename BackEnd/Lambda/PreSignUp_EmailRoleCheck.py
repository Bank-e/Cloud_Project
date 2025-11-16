import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    try:
        logger.info("=== Pre Sign-up Trigger Started ===")
        logger.info(f"Event received: {json.dumps(event, ensure_ascii=False)}")
        
        username = event['userName']
        email = event['request']['userAttributes'].get('email', '').lower()
        
        logger.info(f"Username: {username}, Email: {email}")
        
        # ตรวจสอบโดเมนอีเมล (เก็บไว้ log อย่างเดียว)
        if '@cat' in email or '@catexcalibur' in email:
            logger.info("✓ Admin email detected")
        else:
            logger.info("✓ Customer email detected")
        
        # ⚠️ สำคัญ: Auto-confirm user เพื่อไม่ต้องยืนยันอีเมล/โทรศัพท์
        event['response']['autoConfirmUser'] = True
        event['response']['autoVerifyEmail'] = True
        event['response']['autoVerifyPhone'] = True
        
        # ❌ ลบ groupsToOverride ออก - ไม่รองรับใน Pre Sign-up!
        
        logger.info("✓ User will be auto-confirmed")
        logger.info(f"Event to return: {json.dumps(event, ensure_ascii=False)}")
        logger.info("=== Pre Sign-up Trigger Completed ===")
        
        return event
    
    except Exception as e:
        logger.error(f"✗ Error in Pre sign-up: {str(e)}", exc_info=True)
        raise
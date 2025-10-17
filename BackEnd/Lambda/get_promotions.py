import json
import boto3
from datetime import datetime

dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
PROMOTIONS_TABLE = 'RewardsPromotions'

def lambda_handler(event, context):
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        
        response = dynamodb_client.scan(
            TableName=PROMOTIONS_TABLE,
            FilterExpression='StartDate <= :today_val AND EndDate >= :today_val',
            ExpressionAttributeValues={
                ':today_val': {'S': today}
            }
        )

        promotions = []
        for item in response['Items']:
            promotions.append({
                'Code': item['Code']['S'],
                'Discount': int(item['Discount']['N']),
                'Description': item['Description']['S'],
                'StartDate': item['StartDate']['S'],
                'EndDate': item['EndDate']['S'],
                'MinPoint': int(item['MinPoint']['N'])
            })
        
        return {'statusCode': 200, 'body': json.dumps(promotions, ensure_ascii=False)}

    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
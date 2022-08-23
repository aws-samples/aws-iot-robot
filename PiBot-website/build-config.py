# Use this script as part of a build pipeline for the PiBot website to capture the details that
# need to be populated into awsconfig.ts, such as Cognito user/id pools
# The script should executed as part of the pre-build in the buildspec.yml (example included in the same folder as this script)

import boto3
import argparse

parser = argparse.ArgumentParser(description="Configure AWS parameters for web application")
parser.add_argument('--region', required=True, default="eu-west-1", help="The AWS region you are using for the workshop")
args = parser.parse_args()

upclient = boto3.client('cognito-idp', region_name=args.region)
idclient = boto3.client('cognito-identity', region_name=args.region)
iotclient = boto3.client('iot', region_name=args.region)
aws_config_file = "PiBot-website/src/app/awsconfig.ts"

# get cognito details
user_pools = upclient.list_user_pools(
	MaxResults = 50
)

for pool in user_pools['UserPools']:
	if pool['Name'] == 'pibot-userpool':
		user_pool_id = pool['Id']

user_pool_clients = upclient.list_user_pool_clients(
	UserPoolId = user_pool_id,
	MaxResults = 50
)

for app in user_pool_clients['UserPoolClients']:
	if app['ClientName'] == 'pibot_client':
		app_id = app['ClientId']
 
id_pools = idclient.list_identity_pools(
	MaxResults = 50
)

for idp in id_pools['IdentityPools']:
	if idp['IdentityPoolName'] == "pibot_id_pool":
		id_pool_id = idp['IdentityPoolId']

# Get IoT Core endpoint
iot_endpoint = iotclient.describe_endpoint(
	endpointType = 'iot:Data-ATS'
)

# Now update awsconfig.ts with correct values
placeholders = ['aws-region','pibot-user-pool','pibot-id-pool','pibot-app-id','iot-endpoint']
final_vals = (args.region,user_pool_id,id_pool_id,app_id,iot_endpoint['endpointAddress'])

with open(aws_config_file,'r') as input:
	config_data = input.read()

for placeholder,final in zip(placeholders,final_vals):
	config_data = config_data.replace(placeholder,final)

with open(aws_config_file, 'w') as output:
	output.write(config_data)


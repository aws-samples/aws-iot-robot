#!/usr/bin/python3.9

import os
import sys
import json
import base64
print('Content-type: text/html') # the mime-type header.
print() # header must be separated from body by 1 empty line.
post_data = json.loads(sys.stdin.read())
print("PostData:",post_data)

os.system('wget -O /greengrass/v2/AmazonRootCA1.pem https://www.amazontrust.com/repository/AmazonRootCA1.pem')

#download and unzip the GGv2 core software
os.system('curl -s https://d2s8p88vqu9w66.cloudfront.net/releases/greengrass-nucleus-latest.zip > /greengrass/greengrass-nucleus-latest.zip')
os.system('unzip /greengrass/greengrass-nucleus-latest.zip -d /greengrass/GreengrassInstaller')

#download the GGv2 fleet provisioning plugin
os.system('curl -s https://d2s8p88vqu9w66.cloudfront.net/releases/aws-greengrass-FleetProvisioningByClaim/fleetprovisioningbyclaim-latest.jar > /greengrass/GreengrassInstaller/aws.greengrass.FleetProvisioningByClaim.jar')

os.system('sudo /usr/lib/cgi-bin/deploy.sh')

success = {"complete":200}

print(json.dumps(success))
#!/usr/bin/python3.9

import os
import sys
import json
import base64
print('Content-type: text/html') # the mime-type header.
print() # header must be separated from body by 1 empty line.
post_data = json.loads(sys.stdin.read())
print("PostData:",post_data)

#### Setup variables
fleetTemplateName = post_data['template']
hostPrefix = post_data['endpoint']
credHostPrefix = post_data['credentialep']
thingName = post_data['devicename']
#thingGroupName = post_data['thinggroup']
thingGroupName = "ggv2"

configOut = "/greengrass/v2/config.yaml"

# Base config.yaml for fleet provisioning base64 encoded
template = "LS0tCnNlcnZpY2VzOgogIGF3cy5ncmVlbmdyYXNzLk51Y2xldXM6CiAgICB2ZXJzaW9uOiAiMi41 \
        LjMiCiAgYXdzLmdyZWVuZ3Jhc3MuRmxlZXRQcm92aXNpb25pbmdCeUNsYWltOgogICAgY29uZmln \
        dXJhdGlvbjoKICAgICAgcm9vdFBhdGg6IC9ncmVlbmdyYXNzL3YyCiAgICAgIGF3c1JlZ2lvbjog \
        ImV1LXdlc3QtMSIKICAgICAgaW90RGF0YUVuZHBvaW50OiAiW2F0cy1lbmRwb2ludF0iCiAgICAg \
        IGlvdENyZWRlbnRpYWxFbmRwb2ludDogIltjcmVkZW50aWFscy1lbmRwb2ludF0iCiAgICAgIGlv \
        dFJvbGVBbGlhczogIkdyZWVuZ3Jhc3NDb3JlVG9rZW5FeGNoYW5nZVJvbGVBbGlhcyIKICAgICAg \
        cHJvdmlzaW9uaW5nVGVtcGxhdGU6ICJbZmxlZXQtdGVtcGxhdGVdIgogICAgICBjbGFpbUNlcnRp \
        ZmljYXRlUGF0aDogIi9ncmVlbmdyYXNzL3YyL2NsYWltLWNlcnRzL2NlcnQucGVtIgogICAgICBj \
        bGFpbUNlcnRpZmljYXRlUHJpdmF0ZUtleVBhdGg6ICIvZ3JlZW5ncmFzcy92Mi9jbGFpbS1jZXJ0 \
        cy9wcml2YXRlLmtleSIKICAgICAgcm9vdENhUGF0aDogIi9ncmVlbmdyYXNzL3YyL0FtYXpvblJv \
        b3RDQTEucGVtIgogICAgICB0ZW1wbGF0ZVBhcmFtZXRlcnM6CiAgICAgICAgVGhpbmdOYW1lOiAi \
        W3RoaW5nLW5hbWVdIgogICAgICAgIFRoaW5nR3JvdXBOYW1lOiAiW3RoaW5nLWdyb3VwXSIK"

base64_bytes = template.encode('ascii')
template_bytes = base64.b64decode(base64_bytes)
base_template = template_bytes.decode('ascii')

###################
# Write yaml
###################

sampleConfig = ("[ats-endpoint]","[credentials-endpoint]","[fleet-template]","[thing-name]","[thing-group]")
newConfig = (hostPrefix,credHostPrefix,fleetTemplateName,thingName,thingGroupName)

for sample,final in zip(sampleConfig,newConfig):
        base_template = base_template.replace(sample,final)

with open(configOut,'w') as config:
        config.write(base_template)

success = {"complete":200}

print(json.dumps(success))
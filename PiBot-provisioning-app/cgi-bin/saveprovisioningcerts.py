#!/usr/bin/python3.9

import sys
import json
print('Content-type: text/html') # the mime-type header.
print() # header must be separated from body by 1 empty line.
post_data = json.loads(sys.stdin.read())
print("PostData:",post_data)

cert = open("/greengrass/v2/claim-certs/cert.pem", "w")
pubkey = open("/greengrass/v2/claim-certs/public.key", "w")
prvkey = open("/greengrass/v2/claim-certs/private.key", "w")
cert.write(post_data['certPem'])
pubkey.write(post_data['pubKey'])
prvkey.write(post_data['prvKey'])
cert.close()
pubkey.close()
prvkey.close()
success = {"complete":200}

print(json.dumps(success))
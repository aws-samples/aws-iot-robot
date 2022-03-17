#/*
# * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# *
# * SPDX-License-Identifier: MIT-0
# * Permission is hereby granted, free of charge, to any person obtaining a copy of this
# * software and associated documentation files (the "Software"), to deal in the Software
# * without restriction, including without limitation the rights to use, copy, modify,
# * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
# * permit persons to whom the Software is furnished to do so.
# *
# * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
# * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
# * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
# * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
# * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
# * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
# */

import os
import subprocess
import sys
thread_list = []

shell_env = os.environ.copy()
exec_path='/home/pi/amazon-kinesis-video-streams-webrtc-sdk-c/build/samples'
shell_env["AWS_IOT_CORE_THING_NAME"] = sys.argv[1]
shell_env["AWS_IOT_CORE_CREDENTIAL_ENDPOINT"] = "[CREDENTIAL_ENDPOINT]"
shell_env["AWS_IOT_CORE_CERT"] = "/greengrass/v2/thingCert.crt"
shell_env["AWS_IOT_CORE_PRIVATE_KEY"] = "/greengrass/v2/privKey.key"
shell_env["AWS_IOT_CORE_ROLE_ALIAS"] = "kvs-webrtc-role-alias"
shell_env["LD_LIBRARY_PATH"] = "/home/pi/amazon-kinesis-video-streams-webrtc-sdk-c/open-source/lib/:/home/pi/amazon-kinesis-video-streams-webrtc-sdk-c/build"
thread = subprocess.Popen(exec_path+"/kvsWebrtcClientMasterGstSample", env=shell_env, encoding="utf-8")
thread_list.append(thread)

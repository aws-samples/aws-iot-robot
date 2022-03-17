#!/bin/sh

java -Droot="/greengrass/v2" -Dlog.store=FILE \
  -jar /greengrass/GreengrassInstaller/lib/Greengrass.jar \
  --trusted-plugin /greengrass/GreengrassInstaller/aws.greengrass.FleetProvisioningByClaim.jar \
  --init-config /greengrass/v2/config.yaml \
  --component-default-user ggc_user:ggc_group \
  --setup-system-service true

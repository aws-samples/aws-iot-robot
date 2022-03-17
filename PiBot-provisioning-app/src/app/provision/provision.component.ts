/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import * as AWS from 'aws-sdk';
import * as awsConfig from '../awsconfig';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-provision',
  templateUrl: './provision.component.html',
  styleUrls: ['./provision.component.css']
})
export class ProvisionComponent implements OnInit {

  provStage = 1;
  certPem;
  pubKey;
  prvKey;
  interval;
  timeLeft = 300;
  templates;
  templateName;
  endpointAddress;
  credentialEp;
  endpointPrefix;
  accountNumber;
  deviceName;
  provRequestStatus = "Request Certificates";
  provDeployStatus = "Deploy Certificates to Device";
  configDeployStatus = "Create Config.yaml";
  fullDeployStatus = "Install and Deploy GGv2";
  provUrl = '/cgi-bin/saveprovisioningcerts.py';
  configUrl = '/cgi-bin/createconfigyaml.py';
  provisionUrl = '/cgi-bin/provisionggv2.py';

  constructor(public authService: AuthService, private http: HttpClient) { }

  ngOnInit(): void {
    this.setEndpoint();
    this.getCredentialEndpoint();
    this.setAccountNumber();
    this.getProvisioningTemplates();
  }

  setEndpoint()
  {
    var self = this;
    let params = {
      endpointType: 'iot:Data-ATS'
    };
    new AWS.Iot().describeEndpoint(params,function(err,data) {
      if (err)
      {
        console.log("Error getting IoT Endpioint address");
      }
      else
      {
        self.endpointAddress = data.endpointAddress;
        self.endpointPrefix = self.endpointAddress.split('-')[0];
      }
    });
  }

  setAccountNumber()
  {
    var self = this;
    let sts = new AWS.STS();
    sts.getCallerIdentity({}, function(err, data) {
      if (err) 
      {
        console.log("Error", err);
      } 
      else
      {
        //console.log(JSON.stringify(data.Account));
        self.accountNumber = data.Account;
      }
    });
  }

  getCredentialEndpoint()
  {
    var self = this;
    let params = {
      endpointType: 'iot:CredentialProvider'
    };
    new AWS.Iot().describeEndpoint(params,function(err,data) {
      if (err)
      {
        console.log("Error getting IoT Endpioint address");
      }
      else
      {
        self.credentialEp = data.endpointAddress;
      }
    });    
  }

  getProvisioningTemplates()
  {
    var self = this;
    let params = {
      maxResults: 5
    };
    new AWS.Iot().listProvisioningTemplates(params, function(err, data) {
      if (err) 
      {
        console.log(err, err.stack); // an error occurred
      }
      else
      {
        self.templates = data.templates;
        console.log(data);           // successful response
      }
    });
  }

  getProvisioningCerts()
  {
    var self = this;
    //let params = { templateName: awsConfig.iotTemplateName };
    let params = { templateName: this.templateName };
    let claim = new AWS.Iot().createProvisioningClaim(params,function(err,data) {
      if (err)
      {
          console.log("Error creating claim:",err);
      }
      else
      {
          console.log("Created claim successfully:",data)
          self.certPem = data['certificatePem'];
          self.pubKey = data['keyPair']['PublicKey'];
          self.prvKey = data['keyPair']['PrivateKey'];
          self.provStage = 2;
          self.provRequestStatus = "Done!"
          self.startTimer();
      }
    });
  }

  deployProvisioningCerts()
  {
    var self = this;
    console.log("Uploading provisioning certs");
    const body = { certPem: this.certPem, prvKey: this.prvKey, pubKey: this.pubKey };
    this.http.post(
      this.provUrl,
      body,
      {responseType: 'text'}
    ).subscribe(data => {
      console.log("Sent provisioning certs,",data);
      self.provStage = 3;
      self.provDeployStatus = "Done!";
    });
  }

  createConfigYaml()
  {
    var self = this;
    console.log("Creating GGv2 Config.yaml");
    const body = { template: this.templateName, endpoint: this.endpointAddress, credentialep: this.credentialEp, devicename: this.deviceName };
    this.http.post(
      this.configUrl,
      body,
      {responseType: 'text'}
    ).subscribe(data => {
      console.log("Created config.yaml,",data);
      self.provStage = 4;
      self.configDeployStatus = "Done!"
    });
  }

  provision()
  {
    var self = this;
    console.log("Installing and provisioning");
    const body = {  };
    this.http.post(
      this.provisionUrl,
      body,
      {responseType: 'text'}
    ).subscribe(data => {
      console.log("Provisioning,",data);
      self.provStage = 5;
      self.fullDeployStatus = "Done!"
      window.clearInterval(self.interval);
    });    
  }

  onSelectTemplate(template)
  {
    this.templateName = template;
    console.log("Selected template:",template);
  }

  startTimer()
  {
    // Timer to ensure process is completed within 5 minutes, which is the validity period for the provisioning certs
    var self=this;
    this.interval = setInterval(() => {
      if(this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        this.provStage = 1;
        this.provRequestStatus = "Request"
        this.timeLeft = 300;
        clearInterval(self.interval);
      }
    },1000)
  }

}

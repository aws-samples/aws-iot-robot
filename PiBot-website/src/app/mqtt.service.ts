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

import { Injectable } from '@angular/core';
import * as Paho from 'paho-mqtt';
import * as CryptoJS from 'crypto-js';
import * as awsConfig from './awsconfig';
import { Observable, of, Subject } from 'rxjs';
import { QoS } from 'aws-crt/dist/common/mqtt';

@Injectable({
  providedIn: 'root'
})
export class MqttService {

  mqttClient;
  private _mqttConnected = new Subject<boolean>();
  private _mqttMessages = new Subject();
  mqttConnected$ = this._mqttConnected.asObservable();
  mqttMessages$ = this._mqttMessages.asObservable();
  topics;

  constructor() 
  {
    this.topics = ['PiBot/movement','PiBot/proximity','$aws/events/presence/#']
  }

  // mqttservice commands
  private p4sign(key:any, msg:any) 
  { 
    const hash=CryptoJS.HmacSHA256(msg, key); 
    return hash.toString(CryptoJS.enc.Hex); 
  }

  private p4sha256(msg:any)
  { 
    const hash=CryptoJS.SHA256(msg); 
    return hash.toString(CryptoJS.enc.Hex); 
  }

  private p4getSignatureKey(key:any,dateStamp:any,regionName:string,serviceName:any)
  { 
    const kDate=CryptoJS.HmacSHA256(dateStamp,'AWS4'+key); 
    const kRegion=CryptoJS.HmacSHA256(regionName,kDate); 
    const kService=CryptoJS.HmacSHA256(serviceName,kRegion); 
    const kSigning=CryptoJS.HmacSHA256('aws4_request',kService); 
    return kSigning;
  } 

  connect(accessKey,secretAccessKey,sessionToken)
  {
    //init MQTT client
    this._mqttConnected.next(false);
    let clientId = Math.random().toString(36).substring(7);
    let endpoint = this.getEndpoint(accessKey,secretAccessKey,sessionToken);
    this.mqttClient = new Paho.Client(endpoint,clientId);
    const connectOptions={ 
      useSSL:true, 
      timeout:3, 
      mqttVersion:4, 
      onSuccess: this.onConnect.bind(this),
      onFailure: this.onFailConnect.bind(this)
    };
    this.mqttClient.connect(connectOptions);
  }

  getEndpoint(accessKey,secretAccessKey,sessionToken)
  {
    const REGION=awsConfig.region; 
    const IOT_ENDPOINT=awsConfig.iotEndpoint; 
    const KEY_ID=accessKey; 
    const SECRET_KEY=secretAccessKey;
    const SESSION_TOKEN = encodeURIComponent(sessionToken);

    //date&time 
    const dt=(new Date()).toISOString().replace(/[^0-9]/g,""); 
    const ymd=dt.slice(0,8); 
    const fdt=`${ymd}T${dt.slice(8,14)}Z` 

    const scope=`${ymd}/${REGION}/iotdevicegateway/aws4_request`; 
    const ks=encodeURIComponent(`${KEY_ID}/${scope}`); 
    let qs=`X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${ks}&X-Amz-Date=${fdt}&X-Amz-SignedHeaders=host`; 
    const req=`GET\n/mqtt\n${qs}\nhost:${IOT_ENDPOINT}\n\nhost\n${this.p4sha256('')}`; 
    qs+='&X-Amz-Signature='+this.p4sign( 
      this.p4getSignatureKey(SECRET_KEY,ymd,REGION,'iotdevicegateway'),
        `AWS4-HMAC-SHA256\n${fdt}\n${scope}\n${this.p4sha256(req)}`
    ); 
    qs += '&X-Amz-Security-Token='+SESSION_TOKEN;
    return `wss://${IOT_ENDPOINT}/mqtt?${qs}`; 
  }

  onConnect()
  {

    this._mqttConnected.next(true);
    this.subscribeTopics();
    console.log("MQTT client connected:",this.mqttClient);
    this.mqttClient.onMessageArrived = this.onNewMessage.bind(this);
    this.mqttClient.onConnectionLost=function(e){ 
      console.log(e); 
    };
  }

  subscribeTopics()
  {
    this.topics.forEach(topic => {
      this.mqttClient.subscribe(topic);
    });
  }

  onNewMessage(message)
  {
    let info=JSON.parse(message.payloadString); 
    this._mqttMessages.next(info);
    //console.log("MQTT Service - message:",info);
  }

  sendMessage(topic,payload)
  {
    console.log("Sending MQTT message to topic ",topic);
    this.mqttClient.publish(topic,payload=payload);
  }

  onFailConnect(err)
  {
    console.log("MQTT connect failed:",err);
  }

}

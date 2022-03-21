/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
* SPDX-License-Identifier: Apache-2.0.
* Modifications Copyright 2022 Amazon.com, Inc. or its affiliates. Licensed under the MIT-0 License.
*/


import { Component, OnInit, ViewChild } from '@angular/core';
import * as AWS from 'aws-sdk';
import { SignalingClient } from 'amazon-kinesis-video-streams-webrtc';
import { Role } from '../../role';
import * as awsConfig from '../awsconfig';
import { MqttService } from '../mqtt.service';
import { AuthService } from '../auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})

export class DashboardComponent implements OnInit {

    title = 'PiBot-website';

    viewer = {};
    natTraversalDisabled = false;
    forceTURN = false;
    clientId = "VIEWER";
    widescreen = false;
    openDataChannel = false;
    sendVideo = false;
    sendAudio = false;
    useTrickleICE = true;
    cameraAngle;
    coreItems: Array<any> = []

    thingName;
    iotClient;
    iotEndpointAddress;
    mqttConnection:Subscription;
    mqttConnected;
    devicesConnected = {};
    awsCredentials;
    mqttMessages;
    availableThings;

    rekog;
    canvas;
    video;
    videoRef;
    detectedLabels;
    findLabel;
    findLabels;
    foundLabels;
    boundingBoxes;
    stream
    detect;
    confidence = 50;
    timeoutId;

    constructor(public mqttService: MqttService, public authService: AuthService) {}

    ngOnInit()
    {
        this.mqttConnection = this.mqttService.mqttConnected$
            .subscribe(mqttConnected => this.mqttConnected = mqttConnected);
        this.mqttMessages = this.mqttService.mqttMessages$
            .subscribe(mqttMessages => this.processMqttMessage(mqttMessages));
        this.awsCredentials = this.authService.getCredentials();
        this.initDashboard();

        // Video and Rekognition
        this.rekog = new AWS.Rekognition();
        this.canvas = document.getElementById('canvas');
        this.video = document.getElementById('remoteview');
        this.videoRef = this.video.getBoundingClientRect();
        console.log("Video Ref:",this.videoRef);
        this.detect = "no";
        this.stream = "no";
        this.detectedLabels = [];
        this.findLabels = [];
        this.foundLabels = [];
        this.availableThings = [];
        this.thingName = "Not Set"
        this.getThings();      
    }

    initDashboard()
    {
        this.mqttService.connect(this.awsCredentials['accessKeyId'],this.awsCredentials['secretAccessKey'],this.awsCredentials['sessionToken']);
    }

    setThingName(name)
    {
        this.thingName = name;
    }

    processMqttMessage(message)
    {
        try
        {
            if ('clientId' in message)
            {
                this.devicesConnected[message.clientId] = message.eventType;
                console.log(message);
            }
        }
        catch
        {
            console.log("process mqtt error")
        }
    }

    async startViewer(localView, remoteView, onStatsReport, onRemoteDataMessage) {
        this.viewer['remoteView'] = remoteView;
        this.stream = "yes";
        //console.log("Kinesis creds:", this.awsCredentials);
        // Create KVS client
        const kinesisVideoClient = new AWS.KinesisVideo({
            region: awsConfig.region,
            accessKeyId: this.awsCredentials['accessKeyId'],
            secretAccessKey: this.awsCredentials['secretAccessKey'],
            sessionToken: this.awsCredentials['sessionToken'],
            correctClockSkew: true
        });
    
        // Get signaling channel ARN
        const describeSignalingChannelResponse = await kinesisVideoClient
            .describeSignalingChannel({
                ChannelName: this.thingName,
            })
            .promise();

        const channelARN = describeSignalingChannelResponse.ChannelInfo.ChannelARN;
        console.log('[VIEWER] Channel ARN: ', channelARN);
    
        // Get signaling channel endpoints
        const getSignalingChannelEndpointResponse = await kinesisVideoClient
            .getSignalingChannelEndpoint({
                ChannelARN: channelARN,
                SingleMasterChannelEndpointConfiguration: {
                    Protocols: ['WSS', 'HTTPS'],
                    Role: "VIEWER"
                },
            })
            .promise();

        const endpointsByProtocol = getSignalingChannelEndpointResponse.ResourceEndpointList.reduce((endpoints, endpoint) => {
            endpoints[endpoint.Protocol] = endpoint.ResourceEndpoint;
            return endpoints;
            },
            {}
        );

        console.log('[VIEWER] Endpoints: ', endpointsByProtocol);
    
        const kinesisVideoSignalingChannelsClient = new AWS.KinesisVideoSignalingChannels({
            region: awsConfig.region,
            accessKeyId: this.awsCredentials['accessKeyId'],
            secretAccessKey: this.awsCredentials['secretAccessKey'],
            sessionToken: this.awsCredentials['sessionToken'],
            endpoint: endpointsByProtocol['HTTPS'],
            correctClockSkew: true,
        });
 
        // Get ICE server configuration
        const getIceServerConfigResponse = await kinesisVideoSignalingChannelsClient
            .getIceServerConfig({
                ChannelARN: channelARN,
            })
            .promise();

        const iceServers = [];
        if (!this.natTraversalDisabled && !this.forceTURN) {
            iceServers.push({ urls: `stun:stun.kinesisvideo.${awsConfig.region}.amazonaws.com:443` });
        }

        if (!this.natTraversalDisabled) {
            getIceServerConfigResponse.IceServerList.forEach(iceServer =>
                iceServers.push({
                    urls: iceServer.Uris,
                    username: iceServer.Username,
                    credential: iceServer.Password,
                }),
            );
        }
        console.log('[VIEWER] ICE servers: ', iceServers);
 
        console.log("Config:",getSignalingChannelEndpointResponse);

        // Create Signaling Client
        this.viewer['signalingClient'] = new SignalingClient({
            channelARN,
            channelEndpoint: endpointsByProtocol['WSS'],
            //clientId: this.viewer['connection_id'],
            clientId: this.clientId,
            role: Role.VIEWER,
            region: awsConfig.region,
            credentials: {
                accessKeyId: this.awsCredentials['accessKeyId'],
                secretAccessKey: this.awsCredentials['secretAccessKey'],
                sessionToken: this.awsCredentials['sessionToken']
            },
            systemClockOffset: kinesisVideoClient.config.systemClockOffset
        });
 
        const resolution = this.widescreen ? { width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 640 }, height: { ideal: 480 } };
        const constraints = {
            video: this.sendVideo ? resolution : false,
            audio: this.sendAudio,
        };
        const configuration = {
            iceServers
            //iceTransportPolicy: this.forceTURN ? 'relay' : 'all'
        };

        this.viewer['peerConnection'] = new RTCPeerConnection(configuration);

        if (this.openDataChannel) {
            this.viewer['dataChannel'] = this.viewer['peerConnection'].createDataChannel('kvsDataChannel');
            this.viewer['peerConnection'].ondatachannel = event => {
                event.channel.onmessage = onRemoteDataMessage;
            };
        }
 
        // Poll for connection stats
        this.viewer['peerConnectionStatsInterval'] = setInterval(() => this.viewer['peerConnection'].getStats().then(onStatsReport), 1000);
    
        this.viewer['signalingClient'].on('open', async () => {
            console.log('[VIEWER] Connected to signaling service');
    
            // Get a stream from the webcam, add it to the peer connection, and display it in the local view.
            // If no video/audio needed, no need to request for the sources. 
            // Otherwise, the browser will throw an error saying that either video or audio has to be enabled.
            if (this.sendVideo || this.sendAudio) {
                try {
                    this.viewer['localStream'] = await navigator.mediaDevices.getUserMedia(constraints);
                    this.viewer['localStream'].getTracks().forEach(track => this.viewer['peerConnection'].addTrack(track, this.viewer['localStream']));
                    localView.srcObject = this.viewer['localStream'];
                } catch (e) {
                    console.error('[VIEWER] Could not find webcam');
                    return;
                }
            }
 
            // Create an SDP offer to send to the master
            console.log('[VIEWER] Creating SDP offer');
            await this.viewer['peerConnection'].setLocalDescription(
                await this.viewer['peerConnection'].createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                }),
            );
    
            // When trickle ICE is enabled, send the offer now and then send ICE candidates as they are generated. Otherwise wait on the ICE candidates.
            if (this.useTrickleICE) {
                console.log('[VIEWER] Sending SDP offer');
                this.viewer['signalingClient'].sendSdpOffer(this.viewer['peerConnection']['localDescription']);
            }
            console.log('[VIEWER] Generating ICE candidates');
        });
 
        this.viewer['signalingClient'].on('sdpAnswer', async answer => {
            // Add the SDP answer to the peer connection
            console.log('[VIEWER] Received SDP answer');
            await this.viewer['peerConnection'].setRemoteDescription(answer);
        });
    
        this.viewer['signalingClient'].on('iceCandidate', candidate => {
            // Add the ICE candidate received from the MASTER to the peer connection
            console.log('[VIEWER] Received ICE candidate');
            this.viewer['peerConnection'].addIceCandidate(candidate);
        });
    
        this.viewer['signalingClient'].on('close', () => {
            console.log('[VIEWER] Disconnected from signaling channel');
        });
    
        this.viewer['signalingClient'].on('error', error => {
            console.error('[VIEWER] Signaling client error: ', error);
        });
 
        // Send any ICE candidates to the other peer
        this.viewer['peerConnection'].addEventListener('icecandidate', ({ candidate }) => {
            if (candidate) {
                //console.log('[VIEWER] Generated ICE candidate');
    
                // When trickle ICE is enabled, send the ICE candidates as they are generated.
                if (this.useTrickleICE) {
                    //console.log('[VIEWER] Sending ICE candidate');
                    this.viewer['signalingClient'].sendIceCandidate(candidate);
                }
            } else {
                console.log('[VIEWER] All ICE candidates have been generated');
    
                // When trickle ICE is disabled, send the offer now that all the ICE candidates have ben generated.
                if (!this.useTrickleICE) {
                    console.log('[VIEWER] Sending SDP offer');
                    this.viewer['signalingClient'].sendSdpOffer(this.viewer['peerConnection']['localDescription']);
                }
            }
        });
 
        // As remote tracks are received, add them to the remote view
        remoteView = document.getElementById('remoteview');

        this.viewer['peerConnection'].addEventListener('track', event => {
            console.log('[VIEWER] Received remote track');
            if (remoteView['srcObject']) {
                return;
            }
            this.viewer['remoteStream'] = event.streams[0];
            remoteView['srcObject'] = this.viewer['remoteStream'];
        });
    
        console.log('[VIEWER] Starting viewer connection');
        this.viewer['signalingClient'].open();
    }
 
    stopViewer() {
        console.log('[VIEWER] Stopping viewer connection');
        this.stream = "no";
        
        if (this.viewer['signalingClient']) {
            this.viewer['signalingClient'].close();
            this.viewer['signalingClient'] = null;
        }
    
        if (this.viewer['peerConnection']) {
            this.viewer['peerConnection'].close();
            this.viewer['peerConnection'] = null;
        }
    
        if (this.viewer['localStream']) {
            this.viewer['localStream'].getTracks().forEach(track => track.stop());
            this.viewer['localStream'] = null;
        }
    
        if (this.viewer['remoteStream']) {
            this.viewer['remoteStream'].getTracks().forEach(track => track.stop());
            this.viewer['remoteStream'] = null;
        }
    
        if (this.viewer['peerConnectionStatsInterval']) {
            clearInterval(this.viewer['peerConnectionStatsInterval']);
            this.viewer['peerConnectionStatsInterval'] = null;
        }
    
        if (this.viewer['localView']) {
            this.viewer['localView']['srcObject'] = null;
        }
    
        if (this.viewer['remoteView']) {
            this.viewer['remoteView']['srcObject'] = null;
        }
    
        if (this.viewer['dataChannel']) {
            this.viewer['dataChannel'] = null;
        }
    }
 
    sendViewerMessage(message) 
    {
        if (this.viewer['dataChannel']) {
            try {
                this.viewer['dataChannel'].send(message);
            } catch (e) {
                console.error('[VIEWER] Send DataChannel: ', e.toString());
            }
        }
    }

    getThings()
    {
        var self = this;
        let params = {};
        new AWS.Iot().listThings(params, (err,data) => {
            if (err)
            {
                console.log("unable to retrieve available thing names");
            }
            else
            {
                data['things'].forEach((thing) =>
                {
                    self.availableThings.push(thing.thingName);
                });
            }
        });
    }

    getIoTEndpoint()
    {
      var self = this;
      let params = {
        endpointType: 'iot:Data-ATS'
      };
      new AWS.Iot().describeEndpoint(params,function(err,data) {
        if (err)
        {
          console.log("Error getting IoT Endpoint address");
        }
        else
        {
          console.log("Got endpoint address:",data.endpointAddress);
          self.iotEndpointAddress = data.endpointAddress;
        }
      });
    }

    initIoTClient()
    {
        let creds = this.authService.getCredentials();
        console.log("Initiate IoT Client connection for shadow update:",creds);
        this.iotClient = new AWS.IotData({
            endpoint: awsConfig.iotEndpoint,
            region: awsConfig.region,
            credentials: creds
        });
    }

    startDetection()
    {
        let self = this;
        this.detect = "yes";
        this.timeoutId = setInterval(function() {
            self.detectLabels();
            self.findMatches();
        },2000);
    }

    stopDetection()
    {
        this.detect = "no";
        clearInterval(this.timeoutId);
        this.boundingBoxes = [];
    }

    detectLabels()
    {
        let stream = this.viewer['remoteStream'];

        if (stream)
        {
            //console.log("Stream:",stream);
            let context = this.canvas.getContext('2d');
            context.drawImage(this.video,0,0,640,480)
            let dataUri = this.canvas.toDataURL('image/jpg'),
                bin = atob(dataUri.split(',')[1]),
                tempArr = [];
            
            for (let i=0;i<bin.length;i++)
            {
                tempArr.push(bin.charCodeAt(i));
            }
            let imageBlob = new Uint8Array(tempArr);
            this.getLabels(imageBlob);
        }
        else
        {
            console.log("No stream");
        }
    }

    getLabels(imageBlob)
    {
        let self = this;
        let params = {
                Image: {
                    Bytes: imageBlob
                },
                MaxLabels: 10,
                MinConfidence: this.confidence
            };

        this.rekog.detectLabels(params, function(err,data)
        {
            if (err)
            {
                console.log(err, err.stack)
            }
            else
            {
                self.drawBoundingBoxes(data.Labels);
            }
        })
    }
    
    drawBoundingBoxes(labels)
    {
        this.boundingBoxes = [];
        for (let i=0;i<labels.length;i++)
        {
            let instances = labels[i].Instances.length;
            if (instances > 0)
            {
                for (let j=0;j<instances;j++)
                {
                    //console.log("Raw BBox:",labels[i]);
                    let bBox = {
                        Name: labels[i].Name,
                        Width: labels[i].Instances[j].BoundingBox.Width * this.videoRef.width,
                        Height: (labels[i].Instances[j].BoundingBox.Height * (this.videoRef.height-100)),
                        Left: labels[i].Instances[j].BoundingBox.Left * this.videoRef.width,
                        Top: (labels[i].Instances[j].BoundingBox.Top * this.videoRef.height) + 30
                    }
                    //console.log("Full Bounding box:",bBox);
                    this.boundingBoxes.push(bBox);
                    if (!this.detectedLabels.some(label => label.name === labels[i].Name))
                    {
                        this.detectedLabels.push({"name":labels[i].Name,"confidence":(labels[i].Confidence).toFixed(0)});
                    }
                }
            }
        }
    }

    addFindItem(item)
    {
        console.log("Adding item to find:",item);
        this.findLabels.push(item);
        this.findLabel = "";
    }

    findMatches()
    {
        this.findLabels.forEach(findlabel => {
            if(this.detectedLabels.some(label => (label.name).toLowerCase() === findlabel.toLowerCase()))
            {
            console.log("Match:",findlabel);
            this.findLabels.splice(this.findLabels.indexOf(findlabel),1);
            this.foundLabels.push(findlabel);
            }
        });
    }

    logout()
    {
        this.authService.signOut();
    }

}

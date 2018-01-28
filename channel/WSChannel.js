/**
 * Created by renbaogang on 2017/10/28.
 */
var Store = require("../store/Store")


var WSChannel={
    timeout:60000,
    _lastPongTime:null,
    seed:0,
    callbacks:{},
    generataMsgId : function () {
        return this.seed++;
    },
    newRequestMsg:function (action,data,callback,clientId,targetId) {
        var id = this.generataMsgId();
        if(callback)
            this.callbacks[id] = callback;
        return  {id:id,action:action,data:data,clientId:clientId,targetId:targetId};//id消息id clientId 身份id
    },
    useChannel:function (callback) {
        this.applyChannel(this.ip,callback);
    },
    applyChannel : function(ip, callback){
        if(!ip){
            return;
        }
        var url = 'ws://'+ip+':3000/transfer';
        this.ip = ip;
        //关掉原来的
        // if(this.ws&&this.ws.ip!=ip){
        //     this.ws.close();
        //     delete this.ws;
        // }
        if(!this.ws){
            console.info("start conn ");
            try{
                this.ws = new WebSocket(url);
            }catch (e){
                delete this.ws;
            }
            if(this.ws){
                this.ws.ip=ip;
                this.ws.onmessage = function incoming(message) {
                    var msg = JSON.parse(message.data);
                    var action = msg.action;
                    var isResponse = msg.isResponse;
                    if(isResponse){
                        if(WSChannel.callbacks[msg.id]){
                            WSChannel.callbacks[msg.id](msg.data);
                            delete WSChannel.callbacks[msg.id];
                        }
                    }else{
                        WSChannel[action+"Handler"](msg);
                        WSChannel.ws.send(JSON.stringify({key:msg.key,isResponse:true}));
                    }

                };

                this.ws.onerror = function incoming(event) {
                    console.info("error: "+JSON.stringify(event));

                };
                this.ws.onclose = (event)=>{
                    var t = new Date();
                    console.info("close "+t.getHours()+":"+t.getMinutes()+":"+t.getSeconds());
                    if(event.target.ip==WSChannel.ip){
                        delete WSChannel.ws;
                        setTimeout(()=>{
                            WSChannel.applyChannel(event.target.ip,function () {
                                if(Store.getCurrentClientId()){
                                    WSChannel.login(Store.getName(),Store.getCurrentClientId(),ip,(data,error)=>{
                                        if(error){
                                            alert(error);
                                        }
                                    });
                                }
                            });
                        },5000);

                    }

                }


                //error here
                this.ws.onopen = function () {
                    console.log("open:"+Store.getCurrentClientId());

                    if(callback)
                        callback(WSChannel.ws);
                };
            }
        }else{
            if(callback)
                callback(this.ws);
        }
    },
    //获取公钥私钥
    generateKey : function(name,ip,callback,timeoutCallback){
        // var times=0;
        var req = WSChannel.newRequestMsg("generateKey",{name:name},callback)
        this._sendRequest(req,timeoutCallback);


        // var tmp = function () {
        //     if(ws.readyState==ws.OPEN){
        //         ws.send(JSON.stringify(WSChannel.newRequestMsg("generateKey",{name:name},callback)));
        //     }
        //      else if(ws.readyState==ws.CONNECTING&&times<=15){
        //         times++;
        //          setTimeout(tmp,2000);
        //      }
        //     else{
        //         callback(null,"无法连接服务器，请确认服务器ip是否正确");
        //     }
        // }
        // tmp();

    },
    _timeoutHandler : function (reqId,callback) {
        setTimeout(function(){
            if(WSChannel.callbacks[reqId]){
                if(callback){
                    callback()
                }else{
                    //TODO 提示不够精确
                    alert("无法连接服务器");
                }
            }

        },this.timeout);
    },
    //登录后服务端形成公钥和通道形成绑定
    login:function (name,clientId,ip,callback,timeoutCallback) {
        // var times=0;
        var req = WSChannel.newRequestMsg("login",{name:name},
            function () {
                WSChannel._lastPongTime = Date.now();
                callback();
            },clientId);
        this._sendRequest(req,timeoutCallback,ip);

        // var tmp = function () {
        //     if(ws.readyState==ws.OPEN){
        //         ws.send(JSON.stringify(WSChannel.newRequestMsg("login",{name:name},callback,clientId)));
        //     }
        //     else if(ws.readyState==ws.CONNECTING&&times<=15){
        //         times++;
        //          setTimeout(tmp,2000);
        //     }
        //     else{
        //         callback(null,"无法连接服务器，请确认服务器ip是否正确");
        //     }
        // }
        // tmp();

    },
    searchFriends:function (searchText,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("searchFriends",{text:searchText},callback);
        this._sendRequest(req,timeoutCallback);
    },
    applyMakeFriends:function (targetId,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("applyMakeFriends",{name:Store.getName(),publicKey:Store.getPublicKey()},callback,Store.getCurrentClientId(),targetId);
        this._sendRequest(req,timeoutCallback);
    },
    applyMakeFriendsHandler:function(msg){
        Store.receiveMKFriends(msg.clientId,msg.data.name,msg.data.publicKey);
    },
    acceptMakeFriends:function (targetId,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("acceptMakeFriends",{name:Store.getName(),publicKey:Store.getPublicKey()},callback,Store.getCurrentClientId(),targetId);
        this._sendRequest(req,timeoutCallback);
    },
    acceptMakeFriendsHandler:function(msg){
        Store.addFriend(msg.clientId,msg.data.name,msg.data.publicKey);
    },
    sendMessage:function (targetId,text,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendMessage",{text:text},callback,Store.getCurrentClientId(),targetId);
        this._sendRequest(req,timeoutCallback);

    },
    sendMessageHandler:function(msg){
        Store.receiveMessage(msg.clientId,msg.data.text);
    },
    sendImage:function (targetId,uri,data,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendImage",{data:data},callback,Store.getCurrentClientId(),targetId);
        this._sendRequest(req,timeoutCallback);
    },
    sendImageHandler:function(msg){
        Store.receiveImage(msg.clientId,msg.data.data);
    },
    addGroup:function (groupId,groupName,members,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("addGroup",{groupId:groupId,groupName:groupName,members:members},callback,Store.getCurrentClientId());
        this._sendRequest(req,timeoutCallback);
    },
    addGroupHandler:function(msg){
        Store.addGroup(msg.data.groupId,msg.data.groupName,msg.data.members);
    },
    sendGroupMessage:function (groupId,members,text,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendGroupMessage",{groupId:groupId,members:members,text:text},callback,Store.getCurrentClientId());
        this._sendRequest(req,timeoutCallback);
    },
    sendGroupMessageHandler:function(msg){
        Store.receiveGroupMessage(msg.clientId,msg.data.groupId,msg.data.text);
    },
    sendGroupImage:function (groupId,members,uri,data,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendGroupImage",{groupId:groupId,members:members,data:data},callback,Store.getCurrentClientId());
        this._sendRequest(req,timeoutCallback);
    },
    sendGroupImageHandler:function(msg){
        Store.receiveGroupImage(msg.clientId,msg.data.groupId,msg.data.data);
    },

    _sendRequest:function (req,timeoutCallback,ip) {
        if(ip){
            this.applyChannel(ip,function (ws) {
                ws.send(JSON.stringify(req));
            });
        }else{
            this.useChannel(function (ws) {
                ws.send(JSON.stringify(req));
            });
        }

        this._timeoutHandler(req.id,timeoutCallback);
    }
};

function ping() {
    if(WSChannel.ip){
        var deprecated = false;
        if(!WSChannel._lastPongTime){
            WSChannel._lastPongTime = Date.now();
        }else if(WSChannel.ws&&Date.now()-WSChannel._lastPongTime>3*60000){//心跳超时双方都应该抛弃通道
            WSChannel.ws.close();
            deprecated=true
        }
        if(deprecated!=true){
            WSChannel.useChannel(function (ws) {
                ws.send(JSON.stringify(WSChannel.newRequestMsg("ping",null,function () {
                    WSChannel._lastPongTime=Date.now();
                })));
                //服务端收不到心跳会主动移除ws，尽管ws可能是可用的，而客户端还在使用该ws，有可能可以发出去但无法接收
            });
        }

    }
    setTimeout(ping,60000);
}
ping();//websocket timeout大概是30秒
module.exports=WSChannel
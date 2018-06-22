/* eslint-disable */
var Store = require("../store/Store")


var WSChannel={
    _listeners:new Map(),
    on:function (event,fun) {
        var ary=this._listeners.get(event)
        if(!ary){
            ary = [];
            this._listeners.set(event,ary);
        }
        ary.push(fun);
    },
    un:function (event,fun) {
        var ary=this._listeners.get(event);
        ary.splice(ary.indexOf(fun),1);
    },
    _fire:function (event,params) {
        var ary=this._listeners.get(event)
        if(ary){
            ary.forEach(function(o){
                o(params);
            });
        }
    },
    timeout:60000,
    _reloginDelay:0,
    _lastPongTime:null,
    seed:Date.now(),
    callbacks:{},
    generateMsgId : function () {
        return this.seed++;
    },
    newRequestMsg:function (action,data,callback,targetUid,targetCid,msgId) {
        var id = msgId||this.generateMsgId();
        if(callback)
            this.callbacks[id] = callback;
        return  {id:id,action:action,data:data,uid:Store.getCurrentUid(),targetUid:targetUid,cid:Store.getClientId(),targetCid:targetCid};//id消息id uid 身份id
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
        if(this.ws&&this.ws.ip!=ip){
            this.ws.close();
            delete this.ws;
        }
        if(!this.ws){
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
                    if(msg.isResponse){
                        if(WSChannel.callbacks[msg.id]){
                            WSChannel.callbacks[msg.id](msg.data,msg.id);
                            delete WSChannel.callbacks[msg.id];
                        }
                    }else if(msg.fromOtherDevice){
                        WSChannel[action+"FromOtherDevice"](msg);
                    }
                    else{
                        // WSChannel.ws.send(JSON.stringify({key:msg.key,isResponse:true,action:action,id:msg.id,targetUid:msg.uid,targetCid:msg.cid}));
                        var handle = function(m){
                            WSChannel[m.action+"Handler"](m,()=>{
                                try{
                                    WSChannel.ws.send(JSON.stringify({key:m.key,isResponse:true}));

                                }catch(e){}
                            });
                        }
                        if(isNaN(msg.length)){
                            handle(msg);
                        }else{
                            msg.forEach(function (m) {
                                handle(m);
                            })
                        }


                    }

                };

                this.ws.onerror = function incoming(event) {
                    console.trace(event);

                };
                this.ws.onclose = (event)=>{
                    if(event.target.ip==WSChannel.ip){
                        WSChannel._reLogin();
                    }

                }


                //error here
                this.ws.onopen = function () {
                    if(callback)
                        callback(WSChannel.ws);
                };
            }
        }else{
            if(callback)
                callback(this.ws);
        }
    },
    _reLogin:function () {
        var delay = this._reloginDelay>=5000?5000:this._reloginDelay;
        var login = function () {
            WSChannel._reloginDelay+=1000;
            delete WSChannel.ws;
            WSChannel.applyChannel(WSChannel.ip,function () {
                WSChannel._reloginDelay=0;
                if(Store.getLoginState()){
                    WSChannel.login(Store.getCurrentName(),Store.getCurrentUid(),Store.getClientId(),WSChannel.ip,(data, error)=>{
                        if(error){
                            //TODO 统一处理网络异常
                            //alert(error);
                        }
                        console.info("relogin end:"+Date.now());
                    });
                }
            });
        }
        if(delay){
            setTimeout(()=>{

                login();

            },delay);
        }else{
            login();
        }

    },
    reset :function () {
        delete this.ip;
        if(this.ws){
            this.ws.close();
            delete this.ws;
        }
    },
    register:function (ip,uid,cid,deviceId,name,publicKey,checkCode,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("register",{uid:uid,cid:cid,deviceId:deviceId,name:name,publicKey:publicKey,checkCode:checkCode},callback)
        this._sendRequest(req,timeoutCallback,ip);
    },
    authorize:function (ip,uid,cid,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("authorize",{uid:uid,cid:cid},callback)
        this._sendRequest(req,timeoutCallback,ip);
    },
    unauthorize:function () {
        var req = WSChannel.newRequestMsg("unauthorize");
        this._sendRequest(req);
    },
    _timeoutHandler : function (reqId,callback,preventDefault) {
        if(!preventDefault){
            setTimeout(function(){
                if(WSChannel.callbacks[reqId]){//如果还没有得到返回处理
                    WSChannel._fire("badnetwork");
                    if(callback)
                        callback();
                }

            },this.timeout);
        }
    },
    login:function (name,uid,cid,ip,callback,timeoutCallback) {
        Store.setCurrentUid(uid) ;
        var req = WSChannel.newRequestMsg("login",{name:name,uid:uid,cid:cid},
            function (msg) {
                if(!msg.err){
                    Store.setLoginState(true);
                }
                Store.suspendAutoSave();
                WSChannel._lastPongTime = Date.now();
                // if(msg.serverPublicKey){
                //     Store.truncateServerPublicKey(msg.serverPublicKey);
                // }
                if(msg.contacts){
                    // msg.contacts.forEach(function (c) {
                    //     var f = Store.getFriend(c.id);
                    //     if(f){
                    //         for(var i in f){
                    //             c[i] = f[i];
                    //         }
                    //     }
                    // });
                    Store.truncateFriends(msg.contacts);
                    var res = Store.getAllRecent();
                    for(var i=0;i<res.length;i++){
                        if(!Store.getFriend(res[i].id)){
                            Store.deleteRecent(res[i].id);
                        }
                    }
                }
                if(msg.groups){
                    msg.groups.forEach(function (ng) {
                        var g = Store.getGroup(ng.id);
                        if(g){
                            for(var i in g){
                                if(i!="members"){
                                    ng[i] = g[i];
                                }
                            }
                        }else{
                            ng["records"]=[];
                            ng.newReceive=false;
                            ng.newMsgNum=0;
                        }
                    });
                    Store.truncateGroups(msg.groups);
                }
                Store.resumeAutoSave();
                Store.foreSave();

                callback(msg);
                WSChannel._fire("afterLogin");
                WSChannel.checkTimeoutMsg();

            });
        this._sendRequest(req,timeoutCallback,ip);

    },
    fetchAllMessages:function () {
        if(Store.getLoginState()){
            var req = WSChannel.newRequestMsg("fetchAllMessages",null);
            this._sendRequest(req,null,null,true);
        }

    },
    searchFriends:function (searchText,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("searchFriends",{text:searchText},callback);
        this._sendRequest(req,timeoutCallback);
    },
    applyMakeFriends:function (targetId,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("applyMakeFriends",{name:Store.getCurrentName(),publicKey:Store.getPublicKey(),pic:Store.getPersonalPic()},callback,targetId);
        this._sendRequest(req,timeoutCallback);
    },
    applyMakeFriendsHandler:function(msg,callback){
        Store.receiveMKFriends(msg.uid,msg.data.name,msg.data.publicKey,msg.data.pic);
        callback();
    },
    acceptMakeFriends:function (targetId,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("acceptMakeFriends",{name:Store.getCurrentName(),publicKey:Store.getPublicKey()},callback,targetId);
        this._sendRequest(req,timeoutCallback);
    },
    acceptMakeFriendsHandler:function(msg,callback){
        Store.addFriend(msg.uid,msg.data.name,msg.data.publicKey);
        callback();
    },
    acceptMakeFriendsFromOtherDevice:function(msg){
        Store.addFriend(msg.data.targetUid,msg.data.name,msg.data.publicKey);
    },
    encrypt:function(text,pk){
        return text;
    },
    decrypt:function (encrypted) {
        return encrypted;
    },
    sendMessage:function (targetId,text,callback) {
        var req = WSChannel.newRequestMsg("sendMessage",{text:this.encrypt(text,Store.getFriend(targetId).publicKey),name:Store.getCurrentName()},(data,msgId)=>{
            Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        },targetId);
        Store.sendMessage(targetId,text,req.id,()=>{
            if(callback)
                callback();
            this._sendRequest(req,()=>{
                Store.updateMessageState(targetId,req.id,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
            });
        });

    },
    resendMessage:function (msgId,targetId,text) {
        Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SENDING);
        var req = WSChannel.newRequestMsg("resendMessage",{text:this.encrypt(text,Store.getFriend(targetId).publicKey),name:Store.getCurrentName()},(data)=>{
            Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        },targetId,null,msgId);
        this._sendRequest(req,()=>{
            Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
        });
    },
    sendMessageHandler:function(msg,callback){
        Store.receiveMessage(msg.uid,msg.cid,msg.id,this.decrypt(msg.data.text),callback);
    },
    resendMessageHandler:function(msg,callback){
        Store.receiveMessage(msg.uid,msg.cid,msg.id,this.decrypt(msg.data.text),callback);
    },
    sendImage:function (targetId,data,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendImage",{data:data,name:Store.getCurrentName()},(data,msgId)=>{
            Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        },targetId);
        Store.sendImage(targetId,data,req.id,()=>{
            if(callback)
                callback();
            this._sendRequest(req,()=>{
                Store.updateMessageState(targetId,req.id,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
            });
        });
    },
    resendImage:function (msgId,targetId,data) {
        Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SENDING);
        var req = WSChannel.newRequestMsg("resendImage",{data:data,name:Store.getCurrentName()},(data)=>{
            Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        },targetId,null,msgId);
        this._sendRequest(req,()=>{
            Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
        });
    },
    sendImageHandler:function(msg,callback){
        Store.receiveImage(msg.uid,msg.cid,msg.id,msg.data.data,callback);
    },
    resendImageHandler:function(msg,callback){
        Store.receiveImage(msg.uid,msg.cid,msg.id,msg.data.data,callback);
    },
    addGroup:function (groupId,groupName,members,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("addGroup",{groupId:groupId,groupName:groupName,members:members},callback);
        this._sendRequest(req,timeoutCallback);
    },
    addGroupHandler:function(msg,callback){
        Store.addGroup(msg.data.groupId,msg.data.groupName,msg.data.members);
        callback();
    },
    addGroupFromOtherDevice:function(msg){
        Store.addGroup(msg.data.groupId,msg.data.groupName,msg.data.members);
    },
    sendGroupMessage:function (groupId,groupName,text,callback) {
        var req = WSChannel.newRequestMsg("sendGroupMessage",{groupId:groupId,groupName:groupName,name:Store.getCurrentName(),text:this.encrypt(text,Store.getServerPublicKey())},(data,msgId)=>{
            Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        });
        Store.sendGroupMessage(groupId,text,req.id,()=>{
            if(callback)
                callback();
            this._sendRequest(req,()=>{
                Store.updateGroupMessageState(groupId,req.id,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
            });
        });
    },
    resendGroupMessage:function (msgId,groupId,groupName,text) {
        Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SENDING);
        var req = WSChannel.newRequestMsg("resendGroupMessage",{groupId:groupId,groupName:groupName,name:Store.getCurrentName(),text:this.encrypt(text,Store.getServerPublicKey())},(data)=>{
            Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        },null,null,msgId);
        this._sendRequest(req,()=>{
            Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
        });
    },
    sendGroupMessageHandler:function(msg,callback){
        Store.receiveGroupMessage(msg.uid,msg.cid,msg.id,msg.data.groupId,this.decrypt(msg.data.text),callback);
    },
    resendGroupMessageHandler:function(msg,callback){
        Store.receiveGroupMessage(msg.uid,msg.cid,msg.id,msg.data.groupId,this.decrypt(msg.data.text),callback);
    },
    sendGroupImage:function (groupId,groupName,data,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendGroupImage",{groupId:groupId,groupName:groupName,name:Store.getCurrentName(),data:data},(data,msgId)=>{
            Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        });
        Store.sendGroupImage(groupId,data,req.id,()=>{
            if(callback)
                callback();
            this._sendRequest(req,()=>{
                Store.updateGroupMessageState(groupId,req.id,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
            });
        });
    },
    resendGroupImage:function (msgId,groupId,groupName,data) {
        Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SENDING);
        var req = WSChannel.newRequestMsg("resendGroupImage",{groupId:groupId,groupName:groupName,name:Store.getCurrentName(),data:data},(data)=>{
            Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        },null,null,msgId);
        this._sendRequest(req,()=>{
            Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
        });
    },
    sendGroupImageHandler:function(msg,callback){
        Store.receiveGroupImage(msg.uid,msg.cid,msg.id,msg.data.groupId,msg.data.data,callback);
    },
    resendGroupImageHandler:function(msg,callback){
        Store.receiveGroupImage(msg.uid,msg.cid,msg.id,msg.data.groupId,msg.data.data,callback);
    },

    _sendRequest:function (req,timeoutCallback,ip,preventDefaultTimeout) {
        if(ip){
            this.applyChannel(ip,function (ws) {
                try{
                    ws.send(JSON.stringify(req));
                }catch(e){
                    console.info(e);
                }
            });
        }else{
            this.useChannel(function (ws) {
                try{
                    ws.send(JSON.stringify(req));
                }catch(e){
                    console.info(e);
                }
            });
        }

        this._timeoutHandler(req.id,timeoutCallback,preventDefaultTimeout);
    },
    msgReadStateReport:function (readMsgs,targetUid,targetCid) {
        var req = WSChannel.newRequestMsg("msgReadStateReport",{readMsgs:readMsgs,state:Store.MESSAGE_STATE_TARGET_READ},function (data,msgId) {
            Store.removeFromMQ(msgId);
        },targetUid,targetCid);
        Store.push2MQ(req,function () {
            WSChannel._sendRequest(req);
        });
    },
    msgReadStateReportHandler:function (msg,callback) {
        Store.updateMessageState(msg.uid,msg.data.readMsgs,msg.data.state,callback);
    },
    groupMsgReadStateReport:function (gid,readMsgs,targetUid,targetCid) {
        var req = WSChannel.newRequestMsg("groupMsgReadStateReport",{gid:gid,readMsgs:readMsgs,state:Store.MESSAGE_STATE_TARGET_READ},function (data,msgId) {
            Store.removeFromMQ(msgId);
        },targetUid,targetCid);
        Store.push2MQ(req,function () {
            WSChannel._sendRequest(req);
        });
    },
    groupMsgReadStateReportHandler:function (msg,callback) {
        Store.updateGroupMessageState(msg.data.gid,msg.data.readMsgs,msg.data.state,msg.uid,callback);
    },
    checkTimeoutMsg:function() {
        Store.eachTimeoutMsg(function (row) {
            if(row&&Store.getLoginState()&&WSChannel.ws){
                WSChannel.callbacks[row.id] = function (data,msgId) {
                    Store.removeFromMQ(msgId);
                };
                WSChannel._sendRequest(JSON.parse(row.req));
                Store.updateLastSendTime(row.id,Date.now())
            }
        },function (len) {
            setTimeout(WSChannel.checkTimeoutMsg,3*60*1000);
        })
    },
    sendFile:function (targetId,data,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendFile",{file:data,name:Store.getCurrentName()},(data,msgId)=>{
            Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        },targetId);
        Store.sendFile(targetId,data,req.id,()=>{
            if(callback)
                callback();
            this._sendRequest(req,()=>{
                Store.updateMessageState(targetId,req.id,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
            });
        });
    },
    resendFile:function (msgId,targetId,data) {
        Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SENDING);
        var req = WSChannel.newRequestMsg("resendFile",{file:data,name:Store.getCurrentName()},(data)=>{
            Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        },targetId,null,msgId);
        this._sendRequest(req,()=>{
            Store.updateMessageState(targetId,msgId,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
        });
    },
    sendFileHandler:function(msg,callback){
        Store.receiveFile(msg.uid,msg.cid,msg.id,msg.data.file,callback);
    },
    resendFileHandler:function(msg,callback){
        Store.receiveFile(msg.uid,msg.cid,msg.id,msg.data.file,callback);
    },
    sendGroupFile:function (groupId,groupName,data,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendGroupFile",{groupId:groupId,data:data,groupName:groupName,name:Store.getCurrentName()},(data,msgId)=>{
            Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        });
        Store.sendGroupFile(groupId,data,req.id,()=>{
            if(callback)
                callback();
            this._sendRequest(req,()=>{
                Store.updateGroupMessageState(groupId,req.id,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
            });
        });
    },
    resendGroupFile:function (msgId,groupId,groupName,data) {
        Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SENDING);
        var req = WSChannel.newRequestMsg("resendGroupFile",{groupId:groupId,data:data,groupName:groupName,name:Store.getCurrentName()},(data)=>{
            Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SERVER_RECEIVE);
        },null,null,msgId);
        this._sendRequest(req,()=>{
            Store.updateGroupMessageState(groupId,msgId,Store.MESSAGE_STATE_SERVER_NOT_RECEIVE);
        });
    },
    sendGroupFileHandler:function(msg,callback){
        Store.receiveGroupFile(msg.uid,msg.cid,msg.id,msg.data.groupId,msg.data.data,callback);
    },
    resendGroupFileHandler:function(msg,callback){
        Store.receiveGroupFile(msg.uid,msg.cid,msg.id,msg.data.groupId,msg.data.data,callback);
    },
    setPersonalPic:function (pic,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("setPersonalPic",{pic:pic},(data)=>{
            if(!data.err){
                Store.setPersonalPic(pic);
            }
            callback(data);
        });
        this._sendRequest(req,timeoutCallback);
    },

    setPersonalPicFromOtherDevice:function(msg){
        Store.setPersonalPic(msg.data.pic);
    },
    setPersonalPicHandler:function(msg,callback){
        Store.updateFriendPic(msg.uid,msg.data.pic);
        callback();
    },
    setPersonalName:function (name,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("setPersonalName",{name:name},(data)=>{
            if(!data.err){
                Store.setPersonalName(name);
            }
            callback(data);
        });
        this._sendRequest(req,timeoutCallback);
    },

    setPersonalNameFromOtherDevice:function(msg){
        Store.setPersonalName(msg.data.name);
    },
    setPersonalNameHandler:function(msg,callback){
        Store.updateFriendName(msg.uid,msg.data.name);
        callback();
    },
    addGroupMembers:function (gid,uids,errCallback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("addGroupMembers",{groupId:gid,groupName:Store.getGroup(gid).name,newMembers:uids},(data)=>{
            if(data.err){
                if(errCallback)
                    errCallback(data.err);
            }else{
                Store.addGroupMembers(gid,null,uids);
            }
        },null,null,null);
        this._sendRequest(req,timeoutCallback);
    },
    addGroupMembersHandler:function (msg,callback) {
        Store.addGroupMembers(msg.data.groupId,msg.data.groupName,msg.data.newMembers,msg.data.allMembers);
        callback();
    },
    leaveGroup:function (gid) {

    },
    deleteContact:function (uid) {

    },
    errReport:function (err) {
        var req = WSChannel.newRequestMsg("errReport",{err:err,time:Date.now()},function (data,msgId) {
            Store.removeFromMQ(msgId);
        });
        Store.push2MQ(req,function () {
            WSChannel._sendRequest(req);
        });
    },
};
Store.on("readChatRecords",function (data) {
    var uid = data.uid;
    var readNewMsgs = data.readNewMsgs;
    for(var cid in readNewMsgs){
        WSChannel.msgReadStateReport(readNewMsgs[cid],uid,cid);
    }

});
Store.on("readGroupChatRecords",function (data) {
    var gid = data.gid;
    var readNewMsgs = data.readNewMsgs;
    for(var uid in readNewMsgs){
        for(var cid in readNewMsgs[uid]){
            WSChannel.groupMsgReadStateReport(gid,readNewMsgs[uid][cid],uid,cid)
        }
    }
});
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
                try{
                    ws.send(JSON.stringify(WSChannel.newRequestMsg("ping",null,function () {
                        WSChannel._lastPongTime=Date.now();
                    })));
                }catch(e){
                    console.info(e);
                }

                //服务端收不到心跳会主动移除ws，尽管ws可能是可用的，而客户端还在使用该ws，有可能可以发出去但无法接收
            });
        }

    }
    setTimeout(ping,60000);
}
ping();//websocket timeout大概是30秒
module.exports=WSChannel

/**
 * Created by renbaogang on 2017/10/28.
 */
var Store = require("../store/Store")


var WSChannel={
    timeout:60000,
    _lastPongTime:null,
    seed:Date.now(),
    callbacks:{},
    generataMsgId : function () {
        return this.seed++;
    },
    newRequestMsg:function (action,data,callback,targetUid) {
        var id = this.generataMsgId();
        if(callback)
            this.callbacks[id] = callback;
        return  {id:id,action:action,data:data,uid:Store.getCurrentUid(),targetUid:targetUid};//id消息id uid 身份id
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
                    var isResponse = msg.isResponse;
                    if(isResponse){
                        if(WSChannel.callbacks[msg.id]){
                            WSChannel.callbacks[msg.id](msg.data);
                            delete WSChannel.callbacks[msg.id];
                        }
                    }else if(msg.fromOtherDevice){
                        WSChannel[action+"FromOtherDevice"](msg);
                    }
                    else{
                        WSChannel[action+"Handler"](msg);
                        WSChannel.ws.send(JSON.stringify({key:msg.key,isResponse:true}));
                    }

                };

                this.ws.onerror = function incoming(event) {
                    console.info("error: "+event.toString());

                };
                this.ws.onclose = (event)=>{
                    if(event.target.ip==WSChannel.ip){
                        delete WSChannel.ws;
                        setTimeout(()=>{
                            WSChannel.applyChannel(event.target.ip,function () {
                                if(Store.getLoginState()){
                                    WSChannel.login(Store.getCurrentName(),Store.getCurrentUid(),event.target.ip,(data, error)=>{
                                        if(error){
                                            //TODO 统一处理网络异常
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
                    if(callback)
                        callback(WSChannel.ws);
                };
            }
        }else{
            if(callback)
                callback(this.ws);
        }
    },
    register:function (ip,uid,name,publicKey,checkCode,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("register",{uid:uid,name:name,publicKey:publicKey,checkCode:checkCode},callback)
        this._sendRequest(req,timeoutCallback,ip);
    },
    _timeoutHandler : function (reqId,callback) {
        if(callback){
            setTimeout(function(){
                if(WSChannel.callbacks[reqId]){//如果还没有得到返回处理
                    callback();
                }

            },this.timeout);
        }

    },
    login:function (name,uid,ip,callback,timeoutCallback) {
        Store.setCurrentUid(uid) ;
        var req = WSChannel.newRequestMsg("login",{name:name,uid:uid},
            function (msg) {
                if(!msg.err){
                    Store.setLoginState(true);
                }
                WSChannel._lastPongTime = Date.now();
                if(msg.contacts){
                    msg.contacts.forEach(function (c) {
                        var f = Store.getFriend(c.id);
                        if(f){
                            for(var i in f){
                                c[i] = f[i];
                            }
                        }
                    });
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

                callback(msg);

            });
        this._sendRequest(req,timeoutCallback,ip);

    },
    searchFriends:function (searchText,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("searchFriends",{text:searchText},callback);
        this._sendRequest(req,timeoutCallback);
    },
    applyMakeFriends:function (targetId,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("applyMakeFriends",{name:Store.getCurrentName(),publicKey:Store.getPublicKey()},callback,targetId);
        this._sendRequest(req,timeoutCallback);
    },
    applyMakeFriendsHandler:function(msg){
        Store.receiveMKFriends(msg.uid,msg.data.name,msg.data.publicKey);
    },
    acceptMakeFriends:function (targetId,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("acceptMakeFriends",{name:Store.getCurrentName(),publicKey:Store.getPublicKey()},callback,targetId);
        this._sendRequest(req,timeoutCallback);
    },
    acceptMakeFriendsHandler:function(msg){
        Store.addFriend(msg.uid,msg.data.name,msg.data.publicKey);
    },
    acceptMakeFriendsFromOtherDevice:function(msg){
        Store.addFriend(msg.data.targetUid,msg.data.name,msg.data.publicKey);
    },
    sendMessage:function (targetId,text,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendMessage",{text:text},callback,targetId);
        this._sendRequest(req,timeoutCallback);

    },
    sendMessageHandler:function(msg){
        Store.receiveMessage(msg.uid,msg.data.text);
    },
    sendImage:function (targetId,uri,data,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendImage",{data:data},callback,targetId);
        this._sendRequest(req,timeoutCallback);
    },
    sendImageHandler:function(msg){
        Store.receiveImage(msg.uid,msg.data.data);
    },
    addGroup:function (groupId,groupName,members,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("addGroup",{groupId:groupId,groupName:groupName,members:members},callback);
        this._sendRequest(req,timeoutCallback);
    },
    addGroupHandler:function(msg){
        Store.addGroup(msg.data.groupId,msg.data.groupName,msg.data.members);
    },
    addGroupFromOtherDevice:function(msg){
        Store.addGroup(msg.data.groupId,msg.data.groupName,msg.data.members);
    },
    sendGroupMessage:function (groupId,text,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendGroupMessage",{groupId:groupId,text:text},callback);
        this._sendRequest(req,timeoutCallback);
    },
    sendGroupMessageHandler:function(msg){
        Store.receiveGroupMessage(msg.uid,msg.data.groupId,msg.data.text);
    },
    sendGroupImage:function (groupId,uri,data,callback,timeoutCallback) {
        var req = WSChannel.newRequestMsg("sendGroupImage",{groupId:groupId,data:data},callback);
        this._sendRequest(req,timeoutCallback);
    },
    sendGroupImageHandler:function(msg){
        Store.receiveGroupImage(msg.uid,msg.data.groupId,msg.data.data);
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
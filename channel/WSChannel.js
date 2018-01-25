/**
 * Created by renbaogang on 2017/10/28.
 */
var Store = require("../store/Store")
var WSChannel={
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
    getChannel : function(ip){
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
            console.info("start conn ");
            this.ws = new WebSocket(url);
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
                console.info("error: "+event.message+"::"+this.ws.readyState+":"+this.ws.OPEN+":"+this.ws.CONNECTING);

            };
            this.ws.onclose = (event)=>{
                var t = new Date();
                console.info("close "+t.getHours()+":"+t.getMinutes()+":"+t.getSeconds());
                if(event.target.ip==WSChannel.ip){
                    delete WSChannel.ws;
                    setTimeout(()=>{this.getChannel(event.target.ip)},5000);
                }

            }


            //error here
            this.ws.onopen = function () {
                console.log("open:"+Store.getCurrentClientId());
                if(Store.getCurrentClientId()){
                    WSChannel.login(Store.getName(),Store.getCurrentClientId(),ip,(data,error)=>{
                        if(error){
                            alert(error);
                        }
                    });
                }
            };

        }
        return this.ws;
    },
    //获取公钥私钥
    generateKey : function(name,ip,callback){
        var times=0;
        var ws = this.getChannel(ip);
        var tmp = function () {
            if(ws.readyState==ws.OPEN){
                ws.send(JSON.stringify(WSChannel.newRequestMsg("generateKey",{name:name},callback)));
            }
             else if(ws.readyState==ws.CONNECTING&&times<=5){
                times++;
                 setTimeout(tmp,2000);
             }
            else{
                callback(null,"无法连接服务器，请确认服务器ip是否正确");
            }
        }
        tmp();

    },
    //登录后服务端形成公钥和通道形成绑定
    login:function (name,clientId,ip,callback) {
        var times=0;
        var ws = this.getChannel(ip);
        var tmp = function () {
            if(ws.readyState==ws.OPEN){
                ws.send(JSON.stringify(WSChannel.newRequestMsg("login",{name:name},callback,clientId)));
            }
            else if(ws.readyState==ws.CONNECTING&&times<=3){
                times++;
                 setTimeout(tmp,2000);
            }
            else{
                callback(null,"无法连接服务器，请确认服务器ip是否正确");
            }
        }
        tmp();

    },
    searchFriends:function (searchText,callback) {
        this.ws.send(JSON.stringify(WSChannel.newRequestMsg("searchFriends",{text:searchText},callback)));
    },
    applyMakeFriends:function (targetId,callback) {
        this.ws.send(JSON.stringify(WSChannel.newRequestMsg("applyMakeFriends",{name:Store.getName(),publicKey:Store.getPublicKey()},callback,Store.getCurrentClientId(),targetId)));
    },
    applyMakeFriendsHandler:function(msg){
        Store.receiveMKFriends(msg.clientId,msg.data.name,msg.data.publicKey);
    },
    acceptMakeFriends:function (targetId,callback) {
        this.ws.send(JSON.stringify(WSChannel.newRequestMsg("acceptMakeFriends",{name:Store.getName(),publicKey:Store.getPublicKey()},callback,Store.getCurrentClientId(),targetId)));
    },
    acceptMakeFriendsHandler:function(msg){
        Store.addFriend(msg.clientId,msg.data.name,msg.data.publicKey);
    },
    sendMessage:function (targetId,text,callback) {
        this.ws.send(JSON.stringify(WSChannel.newRequestMsg("sendMessage",{text:text},callback,Store.getCurrentClientId(),targetId)));
    },
    sendMessageHandler:function(msg){
        Store.receiveMessage(msg.clientId,msg.data.text);
    },
    sendImage:function (targetId,uri,data,callback) {
        this.ws.send(JSON.stringify(WSChannel.newRequestMsg("sendImage",{data:data},callback,Store.getCurrentClientId(),targetId)));
    },
    sendImageHandler:function(msg){
        Store.receiveImage(msg.clientId,msg.data.data);
    },
    addGroup:function (groupId,groupName,members,callback) {
        this.ws.send(JSON.stringify(WSChannel.newRequestMsg("addGroup",{groupId:groupId,groupName:groupName,members:members},callback,Store.getCurrentClientId())));
    },
    addGroupHandler:function(msg){
        Store.addGroup(msg.data.groupId,msg.data.groupName,msg.data.members);
    },
    sendGroupMessage:function (groupId,members,text,callback) {
        this.ws.send(JSON.stringify(WSChannel.newRequestMsg("sendGroupMessage",{groupId:groupId,members:members,text:text},callback,Store.getCurrentClientId())));
    },
    sendGroupMessageHandler:function(msg){
        Store.receiveGroupMessage(msg.clientId,msg.data.groupId,msg.data.text);
    },
    sendGroupImage:function (groupId,members,uri,data,callback) {
        this.ws.send(JSON.stringify(WSChannel.newRequestMsg("sendGroupImage",{groupId:groupId,members:members,data:data},callback,Store.getCurrentClientId())));
    },
    sendGroupImageHandler:function(msg){
        Store.receiveGroupImage(msg.clientId,msg.data.groupId,msg.data.data);
    },


};
module.exports=WSChannel
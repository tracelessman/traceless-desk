
var Store = {
    MESSAGE_STATE_SENDING:0,
    MESSAGE_STATE_SERVER_NOT_RECEIVE:1,
    MESSAGE_STATE_SERVER_RECEIVE:2,
    MESSAGE_STATE_TARGET_RECEIVE:3,
    MESSAGE_STATE_TARGET_READ:4,
    MESSAGE_TYEP_TEXT:0,
    MESSAGE_TYPE_IMAGE:1,
    MESSAGE_TYPE_FILE:2,
    _groupSeed:Date.now(),
    uid:null,

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

    //----------------------------
    save2Local : function (key,value,callback) {

    },
    queryFromLocal:function (key,callback) {

    },
    //only recent record
    _deleteLocalRecords:function (chatId,callback) {

    },
    _getLocalRecords: function (id,callback) {

    },
    _insertRecord2Local:function (charId,record,callback) {

    },
    _updateLocalRecordState : function (chatId,msgIds,state,callback) {

    },
    _getLocalRecord : function (chatId,msgId,senderUid,callback) {

    },
    _updateLocalGroupRecordState:function (chatId,msgIds,state,callback,reporterUid) {

    },
    _clearLocalRecords:function (callback) {

    },
    _getLocalRecordStateReports:function (callback) {

    },
    //----------------------------

    _save :function (callback) {
        if(!this._suspendSave)
            this.save2Local("data",this.data?JSON.stringify(this.data):null,callback);
    },


    saveKey:function (name,server,id,publicKey,privateKey,serverPublicKey,cid) {
        if(!this.data){
            this.data = [];
        }
        var update = false;
        for(var i=0;i<this.data.length;i++){
            var keyData = this.data[i];
            if(keyData.id==id){
                keyData.name = name;
                keyData.server = server;
                keyData.publicKey = publicKey;
                keyData.privateKey = privateKey;
                keyData.serverPublicKey = serverPublicKey;
                keyData.clientId = cid;
                update = true;
                break;
            }
        }
        if(!update)
            this.data.splice(0,1,{name:name,server:server,id:id,publicKey:publicKey,privateKey:privateKey,serverPublicKey:serverPublicKey,clientId:cid});
        this._save();
    },
    fetchAllKeys : function (callback) {
        if(this.data){
            callback(this.data);
        }else{
            this.queryFromLocal("data",function (result) {
                if(result){
                    Store.data = JSON.parse(result);
                    callback(Store.data);
                }else{
                    callback(null);
                }
            })
        }
    },


    setCurrentUid:function (id) {
        for(var i=0;i<this.data.length;i++) {
            var keyData = this.data[i];
            if (keyData.id == id) {
                this.uid = id;
                this.keyData = keyData;
                this._fire("uidChanged",id);
            }
        }

    },
    setLoginState:function (b) {
        this.loginState = b;
    },
    getLoginState:function () {
        return this.loginState;
    },
    getCurrentUid:function () {
        return this.uid;
    },
    getCurrentName:function () {
        return this.keyData.name;
    },
    getCurrentServer:function () {
        return this.keyData.server;
    },
    getPublicKey:function () {
        return this.keyData.publicKey;
    },
    getPrivateKey:function () {
        return this.keyData.privateKey;
    },
    //是否有新的还要申请要处理
    hasNewReceivedMKFriends:function () {
        if(!this.keyData.mkfriends){
            this.keyData.mkfriends={};
        }
        return this.keyData.mkfriends.newReceive;
    },
    //接收交友请求
    receiveMKFriends : function (fromId,fromName,publicKey,pic) {
        for(var i=0;i<this.data.length;i++) {
            var keyData = this.data[i];
            if (keyData.id == this.uid) {
                if(!keyData.mkfriends){
                    keyData.mkfriends={};
                }
                if(!keyData.mkfriends.receive){
                    keyData.mkfriends.receive=[];
                }
                var all = keyData.mkfriends.receive;
                var update = false;
                for(var j=0;j<all.length;j++){
                    if(all[j].id==fromId){
                        all[j].name = fromName;
                        update=true;
                    }
                }
                if(!update){
                    keyData.mkfriends.receive.push({name:fromName,id:fromId,publicKey:publicKey,pic:pic,state:0});
                }
                keyData.mkfriends.newReceive = true;
                this._save();
                this._fire("receiveMKFriends",fromName)
                break;
            }
        }
    },
    fetchAllReceivedMKFriends:function () {
        for(var i=0;i<this.data.length;i++) {
            var keyData = this.data[i];
            if (keyData.id == this.uid) {
                if(!keyData.mkfriends){
                    keyData.mkfriends={};
                }
                if(!keyData.mkfriends.receive){
                    keyData.mkfriends.receive=[];
                }
                if(keyData.mkfriends.newReceive){
                    keyData.mkfriends.newReceive = false;
                    this._save();
                    this._fire("readNewMKFriends")
                }

                return keyData.mkfriends.receive;
            }
        }
    },

    acceptMKFriends : function (id,callback) {
        for(var i=0;i<this.data.length;i++) {
            var keyData = this.data[i];
            if (keyData.id == this.uid) {
                var all = keyData.mkfriends.receive;
                for(var j=0;j<all.length;j++){
                    if(all[j].id==id){
                        all[j].state=1;
                        this._save();
                        this.addFriend(all[j].id,all[j].name,all[j].publicKey);
                        callback();
                        break;
                    }
                }
            }
        }
    },

    addFriend : function (id,name,publicKey) {
        var all = this.getAllFriends();
        for(var j=0;j<all.length;j++){
            if(all[j].id==id){
                return;
            }
        }
        all.push({id:id,name:name,publicKey:publicKey});
        this._save();
        this._fire("addFriend",id);
    },
    getAllFriends : function () {
        if(!this.keyData.friends){
            this.keyData.friends = [];
        }
        return this.keyData.friends;
    },
    getAllRecent:function () {
        if(!this.keyData.recent){
            this.keyData.recent=[];
        }
        return this.keyData.recent;
    },
    deleteRecent:function (id,callback) {
        var recents = this.getAllRecent();
        for(var j=0;j<recents.length;j++){
            if(recents[j].id==id){
                recents.splice(j,1);
                this._save(()=>{
                    this._deleteLocalRecords(id,callback);
                });
                break;
            }
        }
    },

    getFriend:function (id) {
        var all = this.getAllFriends();
        for(var j=0;j<all.length;j++){
            if(all[j].id==id){
                return all[j];
            }
        }
    },
    truncateFriends:function (friends) {
        this.keyData.friends = friends;
        this._save();
    },
    getRecent:function (id,force) {
        var recents = this.getAllRecent();
        for(var j=0;j<recents.length;j++){
            if(recents[j].id==id){
                return recents[j];
            }
        }
        if(force){
            var recent = {id:id,newReceive:false,newMsgNum:0};
            recents.push(recent)
            return recent;
        }
    },
    readAllChatRecords : function (id,ignoreState,callback) {
        this._getLocalRecords(id,(records)=>{
            var recent = this.getRecent(id,true);
            if(recent.newReceive==true&&ignoreState!=true){
                var readNewNum = recent.newMsgNum;
                recent.newReceive=false;
                recent.newMsgNum=0;
                var readNewMsgs = {};
                for(var i=records.length-1;i>=records.length-readNewNum;i--){
                    if(!readNewMsgs[records[i].senderCid]){
                        readNewMsgs[records[i].senderCid] = [];
                    }
                    readNewMsgs[records[i].senderCid].push(records[i].msgId);
                }
                this._fire("readChatRecords",{uid:id,readNewMsgs:readNewMsgs});
                this._save();
            }
            callback(records);

        });
    },

    _markNewReceive:function (id) {
        var recent = this.getRecent(id,true);
        recent.newReceive=true;
        if(isNaN(recent.newMsgNum)){
            recent.newMsgNum = 0;
        }
        recent.newMsgNum++;
        this._save();
    },
    receiveMessage:function (fromId,fromCid,msgId,text,callback) {
        this._insertRecord2Local(fromId,{senderUid:fromId,senderCid:fromCid,text:text,msgId:msgId,time:Date.now()},()=>{
            this._markNewReceive(fromId);
            this._fire("receiveMessage",fromId);
            if(callback)
                callback();
        });
    },
    receiveImage:function (fromId,fromCid,msgId,img,callback) {
        this._insertRecord2Local(fromId,{senderUid:fromId,senderCid:fromCid,img:img,msgId:msgId,time:Date.now()},()=>{
            this._markNewReceive(fromId);
            this._fire("receiveMessage",fromId);
            if(callback)
                callback();
        });
    },
    receiveFile:function (fromId,fromCid,msgId,file,callback) {
        this._insertRecord2Local(fromId,{senderUid:fromId,senderCid:fromCid,file:file,msgId:msgId,time:Date.now()},()=>{
            this._markNewReceive(fromId);
            this._fire("receiveMessage",fromId);
            if(callback)
                callback();
        });
    },
    sendMessage:function (targetId,text,msgId,callback) {
        this._insertRecord2Local(targetId,{text:text,msgId:msgId,time:Date.now(),state:Store.MESSAGE_STATE_SENDING},()=>{
            if(callback)
                callback();
            this._fire("sendMessage",targetId);
        });
    },

    updateMessageState:function (targetId,msgIds,state,callback) {
        this._updateLocalRecordState(targetId,msgIds,state, () =>{
            if(callback)
                callback();
            this._fire("updateMessageState",targetId);
        });
    },

    getRecentChatRecord:function (targetId,msgId,uid,callback) {
        this._getLocalRecord(targetId,msgId,uid,callback);
    },

    sendImage:function (targetId,data,msgId,callback) {
        this._insertRecord2Local(targetId,{img:data,msgId:msgId,time:Date.now(),state:Store.MESSAGE_STATE_SENDING},()=>{
            if(callback)
                callback();
            this._fire("sendMessage",targetId);
        });
    },
    sendFile:function (targetId,data,msgId,callback) {
        this._insertRecord2Local(targetId,{file:data,msgId:msgId,time:Date.now(),state:Store.MESSAGE_STATE_SENDING},()=>{
            if(callback)
                callback();
            this._fire("sendMessage",targetId);
        });
    },
    truncateGroups:function (newGroups) {
        this.keyData.groups = newGroups;
        this._save();
    },
    getGroups:function () {

        var groups = this.keyData.groups;
        if(!groups){
            groups = [];
            this.keyData.groups = groups;
        }
        return groups;
    },
    addGroup:function (id,name,members) {
        this.getGroups().push({id:id,name:name,members:members,newReceive:false,newMsgNum:0});
        this._save();
        this._fire("addGroup");
    },
    generateGroupId:function () {
        return this.keyData.id+(this._groupSeed++);
    },
    _getGroup:function (id,force) {
        var groups = this.getGroups();
        for(var j=0;j<groups.length;j++){
            if(groups[j].id==id){
                return groups[j];
            }
        }
        if(force){
            var g = {id:id,members:[],newReceive:false,newMsgNum:0};
            groups.push(g)
            return g;
        }
    },
    getGroup:function (id) {
        return this._getGroup(id,false);
    },
    addGroupMembers:function (gid,newMembers,allMembers) {
        var group = this.getGroup(gid);
        console.log(group)
        console.log(newMembers)

        if(!group){
            this.addGroup(gid,group.name,allMembers);
        }
        if(group){

            if(allMembers)
                group.members = allMembers;
            else{
                newMembers.forEach( (m)=> {
                    var oldMember = this.getMember(gid,m.uid);
                    if(!oldMember){
                        var f = this.getFriend(m.uid);
                        m.name = f.name;
                        m.pic = f.pic;
                        group.members.push(m);
                    }
                });
            }
            this._fire("groupMembersChanged",gid);
        }
    },
    readGroupChatRecords:function (id,ignoreState,callback) {
        this._getLocalRecords(id, (records) =>{
            var g = this._getGroup(id,true);
            if(g.newReceive==true&&ignoreState!=true){
                var readNewNum = g.newMsgNum;
                g.newReceive=false;
                g.newMsgNum=0;
                var readNewMsgs = {};
                for(var i=records.length-1;i>=records.length-readNewNum;i--){
                    if(!readNewMsgs[records[i].senderUid]){
                        readNewMsgs[records[i].senderUid] = {};
                    }
                    if(!readNewMsgs[records[i].senderUid][records[i].senderCid]){
                        readNewMsgs[records[i].senderUid][records[i].senderCid] = [];
                    }
                    readNewMsgs[records[i].senderUid][records[i].senderCid].push(records[i].msgId);
                }
                this._fire("readGroupChatRecords",{gid:id,readNewMsgs:readNewMsgs});
                this._save();
            }
            callback(records);
        });
    },
    getMembersBaseInfo:function (gid) {
        var g = this._getGroup(gid,true);
        var  ms = [];
        for(var i=0;i<g.members.length;i++){
            var m = g.members[i];
            ms.push({id:m.uid,name:m.name});
        }
        return ms;
    },
    getMember:function (gid,mid) {
        var g = this._getGroup(gid,true);
        for(var i=0;i<g.members.length;i++){
            if(g.members[i].uid==mid){
                return g.members[i];
            }
        }
    },
    _markNewGroupReceive:function (gid) {
        var g = this._getGroup(gid,true);
        if(g){
            g.newReceive=true;
            if(isNaN(g.newMsgNum)){
                g.newMsgNum = 0;
            }
            g.newMsgNum++;
            this._save();
        }
    },
    receiveGroupMessage:function (fromId,fromCid,msgId,groupId,text,callback) {
        this._insertRecord2Local(groupId,{senderUid:fromId,senderCid:fromCid,text:text,msgId:msgId,time:Date.now()},()=>{
            this._markNewGroupReceive(groupId);
            this._fire("receiveGroupMessage",groupId);
            if(callback)
                callback();
        });
    },
    sendGroupMessage:function (gid,text,msgId,callback) {
        this._insertRecord2Local(gid,{text:text,msgId:msgId,time:Date.now(),state:Store.MESSAGE_STATE_SENDING},()=>{
            if(callback)
                callback();
            this._fire("sendGroupMessage",gid);
        })
    },

    updateGroupMessageState:function (gid,msgIds,state,fromUid,callback) {
        this._updateLocalGroupRecordState(gid,msgIds,state,()=>{
            if(callback)
                callback();
            this._fire("updateGroupMessageState",gid);
        },fromUid);
    },
    getGroupChatRecord:function (gid,msgId,uid,callback) {
        this._getLocalRecord(gid,msgId,uid,callback);
    },
    receiveGroupImage:function (fromId,fromCid,msgId,groupId,img,callback) {
        this._insertRecord2Local(groupId,{senderUid:fromId,senderCid:fromCid,img:img,msgId:msgId,time:Date.now()},()=>{
            this._markNewGroupReceive(groupId);
            this._fire("receiveGroupMessage",groupId);
            if(callback)
                callback();
        });
    },
    receiveGroupFile:function (fromId,fromCid,msgId,groupId,file,callback) {
        this._insertRecord2Local(groupId,{senderUid:fromId,senderCid:fromCid,file:file,msgId:msgId,time:Date.now()},()=>{
            this._markNewGroupReceive(groupId);
            this._fire("receiveGroupMessage",groupId);
            if(callback)
                callback();
        });
    },
    sendGroupImage:function (gid,data,msgId,callback) {
        this._insertRecord2Local(gid,{img:data,msgId:msgId,time:Date.now(),state:Store.MESSAGE_STATE_SENDING},()=>{
            if(callback)
                callback();
            this._fire("sendGroupMessage",gid);
        });
    },
    sendGroupFile:function (gid,data,msgId,callback) {
        this._insertRecord2Local(gid,{file:data,msgId:msgId,time:Date.now(),state:Store.MESSAGE_STATE_SENDING},()=>{
            if(callback)
                callback();
            this._fire("sendGroupMessage",gid);
        });
    },
    getRecordStateReports:function (gid,msgId,callback) {
        this._getLocalRecordStateReports(gid,msgId,callback);
    },
    reset:function (callback) {
        this.data = null;
        this.uid = null;
        this.keyData = null;
        this.loginState = false;
        this._save(callback);
        this._clearLocalRecords()
    },
    clear:function (callback) {
        var recent = this.getAllRecent();
        recent.forEach(function (r) {
            r.newReceive=false;
        });
        var groups = this.getGroups();
        groups.forEach(function (r) {
            r.newReceive=false;
        });
        this.keyData.mkfriends={};
        this.loginState = false;
        this.uid = null;
        this.keyData = null;
        this._save(callback);
        this._clearLocalRecords();
    },
    getTotalNewMSgNum:function () {
        var recent = this.getAllRecent();
        var total=0;
        recent.forEach(function (r) {
            if(!isNaN(r.newMsgNum)){
                total += r.newMsgNum;
            }
        });
        var groups = this.getGroups();
        groups.forEach(function (r) {
            if(!isNaN(r.newMsgNum)){
                total += r.newMsgNum;
            }
        });
        return total;
    },
    getTheme:function () {
        return this.keyData._theme||"left";
    },
    changeTheme:function () {
        if(this.getTheme()=="left"){
            this.keyData._theme = "bottom";
        }else{
            this.keyData._theme = "left";
        }
        this._save();
    },
    truncateServerPublicKey:function (key) {
        this.keyData.serverPublicKey = key;
        this._save();
    },
    getServerPublicKey:function () {
        return this.keyData.serverPublicKey;
    },
    getClientId:function () {
        if(this.keyData)
            return this.keyData.clientId;
    },
    suspendAutoSave:function(){
        this._suspendSave = true;
    },
    resumeAutoSave:function () {
        this._suspendSave = false;
    },
    foreSave:function (callback) {
        this._save(callback);
    },
    setPersonalPic:function (pic) {
        this.keyData.pic = pic;
        this._save();
    },
    getPersonalPic:function () {
        return this.keyData.pic;
    },
    updateFriendPic:function (uid,pic) {
        var f = getFriend(uid);
        if(f){
            f.pic = pic;
        }
    }
    // rejectMKFriends : function (index) {
    //     for(var i=0;i<this.data.length;i++) {
    //         var keyData = this.data[i];
    //         if (keyData.id == this.uid) {
    //             keyData.mkfriends.receive[index].state=2;
    //             this._save();
    //             break;
    //         }
    //     }
    // }
};

//获取本地key，无key就引导下载，有则到主界面
module.exports=Store

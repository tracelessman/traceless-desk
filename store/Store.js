/**
 * Created by renbaogang on 2017/10/30.
 */

var Store = {
    _groupSeed:Date.now(),
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

    uid:null,

    _save :function () {
        this.save2Local("data",JSON.stringify(this.data));
    },
    save2Local : function (key,value) {

    },

    saveKey:function (name,server,id,publicKey,privateKey) {
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
                update = true;
                break;
            }
        }
        if(!update)
            this.data.splice(0,1,{name:name,server:server,id:id,publicKey:publicKey,privateKey:privateKey});
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

    queryFromLocal:function (key,callback) {

    },
    setCurrentUid:function (id) {
        for(var i=0;i<this.data.length;i++) {
            var keyData = this.data[i];
            if (keyData.id == id) {
                this.uid = id;
                this.keyData = keyData;
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
        for(var i=0;i<this.data.length;i++) {
            var keyData = this.data[i];
            if (keyData.id == this.uid) {
                return keyData.publicKey;
            }
        }
    },
    //是否有新的还要申请要处理
    hasNewReceivedMKFriends:function () {
        if(!this.keyData.mkfriends){
            this.keyData.mkfriends={};
        }
        return this.keyData.mkfriends.newReceive;
    },
    //接收交友请求
    receiveMKFriends : function (fromId,fromName,publicKey) {
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
                    keyData.mkfriends.receive.push({name:fromName,id:fromId,publicKey:publicKey,state:0});
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
    deleteRecent:function (id) {
        var recents = this.getAllRecent();
        for(var j=0;j<recents.length;j++){
            if(recents[j].id==id){
                recents.splice(j,1);
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
            var recent = {id:id,records:[],newReceive:false,newMsgNum:0};
            recents.push(recent)
            return recent;
        }
    },
    readAllChatRecords : function (id,ignoreState) {
        var recent = this.getRecent(id,true);
        if(recent.newReceive==true&&ignoreState!=true){
            recent.newReceive=false;
            recent.newMsgNum=0;
            this._save();
            this._fire("readChatRecords",id)
        }
        return recent.records;
    },
    _getChatRecords:function (id, force, newMsg) {
        var recent = this.getRecent(id,force);
        if(recent){
            if(newMsg){
                recent.newReceive=true;
                if(isNaN(recent.newMsgNum)){
                    recent.newMsgNum = 0;
                }
                recent.newMsgNum++;
            }
            return recent.records;
        }
    },
    receiveMessage:function (fromId,text) {
        var records = this._getChatRecords(fromId,true,true);
        records.push({id:fromId,text:text});
        this._save();
        this._fire("receiveMessage",fromId);
    },
    receiveImage:function (fromId,img) {
        var records = this._getChatRecords(fromId,true,true);
        records.push({id:fromId,img:img});
        this._save();
        this._fire("receiveMessage",fromId);
    },
    sendMessage:function (targetId,text) {
        var records = this._getChatRecords(targetId,true);
        records.push({text:text});
        this._save()
        this._fire("sendMessage",targetId);
    },
    sendImage:function (targetId,uri,data) {
        var records = this._getChatRecords(targetId,true);
        records.push({img:uri});
        this._save()
        this._fire("sendMessage",targetId);
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
        this.getGroups().push({id:id,name:name,members:members,records:[],newReceive:false,newMsgNum:0});
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
            var g = {id:id,members:[],records:[],newReceive:false,newMsgNum:0};
            groups.push(g)
            return g;
        }
    },
    getGroup:function (id) {
        return this._getGroup(id,false);
    },
    readGroupChatRecords:function (id,ignoreState) {
        var g = this._getGroup(id,true);
        if(g.newReceive==true&&ignoreState!=true){
            g.newReceive=false;
            g.newMsgNum=0;
            this._save();
            this._fire("readGroupChatRecords",id);
        }
        return g.records;
    },
    getMembersBaseInfo:function (gid) {
        var g = this._getGroup(gid,true);
        var  ms = [];
        for(var i=0;i<g.members.length;i++){
            var m = g.members[i];
            ms.push({id:m.id,name:m.name});
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
    receiveGroupMessage:function (fromId,groupId,text) {
        var records = this._getGroupChatRecords(groupId,true,true);
        records.push({id:fromId,text:text});
        this._save();
        this._fire("receiveGroupMessage",groupId);
    },
    _getGroupChatRecords:function (gid, force, newMsg) {
        var g = this._getGroup(gid,force);
        if(g){
            if(newMsg){
                g.newReceive=true;
                if(isNaN(g.newMsgNum)){
                    g.newMsgNum = 0;
                }
                g.newMsgNum++;
            }
            return g.records;
        }
    },
    sendGroupMessage:function (gid,text) {
        var records = this._getGroupChatRecords(gid,true);
        records.push({text:text});
        this._save()
        this._fire("sendGroupMessage",gid);
    },
    receiveGroupImage:function (fromId,groupId,img) {
        var records = this._getGroupChatRecords(groupId,true,true);
        records.push({id:fromId,img:img});
        this._save();
        this._fire("receiveGroupMessage",groupId);
    },
    sendGroupImage:function (gid,uri,data) {
        var records = this._getGroupChatRecords(gid,true);
        records.push({img:uri});
        this._save()
        this._fire("sendGroupMessage",gid);
    },
    reset:function () {
        this.data = null;
        this.uid = null;
        this.keyData = null;
        this.loginState = false;
        this._save();
    },
    clear:function () {
        var recent = this.getAllRecent();
        recent.forEach(function (r) {
            r.newReceive=false;
            r.records=[];
        });
        var groups = this.getGroups();
        groups.forEach(function (r) {
            r.newReceive=false;
            r.records=[];
        });
        this.keyData.mkfriends={};
        this.loginState = false;
        this.uid = null;
        this.keyData = null;
        this._save();
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
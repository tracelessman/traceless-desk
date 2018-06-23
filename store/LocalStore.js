
var Store = require("../store/Store");
// var sqlite3 = require('sqlite3');
var sqlite3 = require("../asars/sqlite3.asar");
var db = new sqlite3.cached.Database(path.join(__dirname, '/traceless.db').replace('/app.asar',''));
db.serialize(function () {
    db.run("create table if not exists traceless(id INTEGER PRIMARY KEY NOT NULL,data TEXT)", [], function (err) {
        if (err) {
            console.info(err);
        } else {

        }
    });
    db.run("create table if not exists mq(id INTEGER PRIMARY KEY NOT NULL,req TEXT NOT NULL,lastSendTime INTEGER)", [], function (err) {
        if (err) {
            console.info(err);
        } else {

        }
    });
    //recent&group
    db.run("create table if not exists record(chatId TEXT NOT NULL,senderUid TEXT,senderCid TEXT,type INTEGER,content TEXT,time INTEGER,msgId INTEGER,state INTEGER)", [], function (err) {
        if (err) {
            console.info(err);
        } else {

        }
    });
    //group message
    db.run("create table if not exists record_state_report(chatId TEXT NOT NULL,msgId INTEGER ,reporterUid TEXT NOT NULL,state INTEGER)", [], function (err) {
        if (err) {
            console.info(err);
        } else {

        }
    });
});
var exists = false;
function _update(data,callback) {
    db.run("update traceless set data=? where id=1",[data],function (err) {
        if(err){
            console.info(err);
        }else{
            if(callback)
                callback();
        }
    });
}
Store.save2Local =function (key,data,callback) {
    if(!exists){
        db.get("select * from traceless where id=1",[],function (err,row) {
            if(err){
                console.info(err);
            }else{
                if(row){
                    _update(data,callback);
                }else{
                    db.run("insert into traceless(id,data) values(1,?)",[data],function (err) {
                        if(err){
                            console.info(err);
                        }else{
                            exists = true;
                            if(callback)
                                callback();
                        }
                    });
                }
            }

        });
    }else{
        _update(data,callback);
    }
    // localStorage.setItem(key,value);
};
Store.queryFromLocal=function (key,callback) {
    db.get("select * from traceless where id=1",[],function (err,row) {
        if(err){
            console.info(err);
        }else{
            if(row){
                callback(row.data);
            }else{
                callback(null);
            }
        }

    });
    // var result = localStorage.getItem("data");
    // callback(result);
};
Store.registerFromOther=function (data,cid) {
    if(!this.data){
        this.data = [];
    }
    data.clientId = cid;
    this.data.splice(0,1,data);
    this._save();
};
Store.push2MQ=function (req,callback) {
    db.run("insert into mq(id,req,lastSendTime) values(?,?,?)",[req.id,JSON.stringify(req),Date.now()],function (err) {
        if(err){
            console.info(err);
        }else{
            if(callback)
                callback();
        }
    });
};
Store.removeFromMQ=function (reqId) {
    db.run("delete from mq where id=?",[reqId],function (err) {
        if(err){
            console.info(err);
        }else{

        }
    });
};
Store.eachTimeoutMsg=function (callback,complete) {
    var n = Date.now();
    db.each("select * from mq where lastSendTime is not null and "+n+"-lastSendTime>180000 order by id",[],callback,complete);
};
Store.updateLastSendTime=function (id,time,callback) {
    db.run("update mq set lastSendTime=? where id=?",[time,id],callback);
};

Store._deleteLocalRecords=function (chatId,callback) {
    db.run("delete from record where chatId=?",[chatId],function (err) {
        if(err){
            console.info(err);
        }else{
            callback();
        }
    });
};
Store._getLocalRecords = function (chatId,callback) {
    db.all("select * from record where chatId=? order by time",[chatId],function (err,rows) {
        if(err){
            console.info(err);
        }else{
            callback(rows);
        }
    });
};
Store._insertRecord2Local = function (chatId,record,callback) {
    var type = -1;
    var content = null;
    var state = -1;
    if(record.text){
        type = Store.MESSAGE_TYEP_TEXT;
        content = record.text;
    }else if(record.img){
        type = Store.MESSAGE_TYPE_IMAGE;
        content = JSON.stringify(record.img);
    }else if(record.file){
        type = Store.MESSAGE_TYPE_FILE;
        content = JSON.stringify(record.file);
    }
    state = isNaN(record.state)?-1:record.state;
    db.run("insert into record(chatId,senderUid,senderCid,type,content,time,msgId,state) values(?,?,?,?,?,?,?,?) ",[chatId,record.senderUid||null,record.senderCid||null,type,content,record.time,record.msgId,state],function (err) {
        if(err){
            console.info(err);
        }else{
            callback();
        }
    });
};
Store._updateLocalRecordState = function (chatId,msgIds,state,callback,senderCid) {
    var doit = function () {
        if(msgIds){
            var sql = "update record set state=? where chatId=? and msgId ";
            var update = false;
            if(isNaN(msgIds.length)){
                sql += "='"
                sql += msgIds;
                sql += "'";
                update = true;
            }else{
                sql += "in (";
                for(var i=0;i<msgIds.length;i++){
                    sql+="'";
                    sql+=msgIds[i];
                    sql+="'";
                    if(i<msgIds.length-1){
                        sql+=",";
                    }
                }
                sql+=")";
                update = true;
            }
            if(update)
                db.run(sql,[state,chatId],(err)=>{
                    if(err){
                        console.info(err);
                    }else{
                        callback();
                    }
                });
        }
    }
    if(senderCid&&senderCid!=Store.getClientId()){
        var sql = "select msgId from record where chatId=? and senderUid is null and senderCid=? and msgId ";
        var num = 0;
        if(isNaN(msgIds.length)){
            sql += "='"
            sql += msgIds;
            sql += "'";
            num = 1;
        }else{
            sql += "in (";
            for(var i=0;i<msgIds.length;i++){
                sql+="'";
                sql+=msgIds[i];
                sql+="'";
                if(i<msgIds.length-1){
                    sql+=",";
                }
                num++;
            }
            sql+=")";
        }
        db.all(sql,[chatId,senderCid],function (err,rows) {
            if(err){
                console.info(err);
            }else{
                if(rows&&rows.length==num){
                    doit();
                }
            }
        });

    }else{
        doit();
    }
};
Store._getLocalRecord = function (chatId,msgId,senderUid,callback) {
    var sql = "select * from record where chatId=? and msgId=? and ";
    if(senderUid)
        sql+="senderUid='"+senderUid+"' ";
    else
        sql+="senderUid is null ";
    sql+= "order by time";
    db.get(sql,[chatId,msgId],function (err,row) {
        if(err){
            console.info(err);
            callback()
        }else{
            callback(row);
        }
    });
};
Store._updateLocalGroupRecordState = function (chatId,msgIds,state,callback,reporterUid) {
    if(msgIds){
        var updateRS = function () {
            var sql = "update record set state=? where chatId=? ";
            sql+="and state<? ";
            sql+="and msgId "
            var update = false;
            if(isNaN(msgIds.length)){
                sql += "='"
                sql += msgIds;
                sql += "'";
                update = true;
            }else{
                sql += "in (";
                for(var i=0;i<msgIds.length;i++){
                    sql+="'";
                    sql+=msgIds[i];
                    sql+="'";
                    if(i<msgIds.length-1){
                        sql+=",";
                    }
                }
                sql+=")";
                update = true;
            }
            if(update)
                db.run(sql,[state,chatId,state],function (err) {
                    if(err)
                        console.info(err);
                    else
                        callback();
                });
        }
        if(reporterUid){
            var sql;
            var params=[];
            if(isNaN(msgIds.length)){
                sql = "insert into record_state_report(chatId,msgId,reporterUid,state) values(?,?,?,?)"
                params[chatId,msgIds,reporterUid,state];

            }else{
                sql = "insert into record_state_report(chatId,msgId,reporterUid,state) values ";
                var params=[];
                for(var i=0;i<msgIds.length;i++){
                    var m = msgIds[i];
                    sql += "(?,?,?,?)";
                    if(i<msgIds.length-1){
                        sql +=",";
                    }
                    params.push(chatId);
                    params.push(m);
                    params.push(reporterUid);
                    params.push(state);
                }
            }
            db.run(sql,params,(err)=>{
                if(err){
                    console.info(err)
                }else{
                    updateRS();
                }
            });
        }else{
            updateRS();
        }




    }

};

Store._clearLocalRecords=function (callback) {
    db.run("delete from record");
    db.run("delete from record_state_report");
};
Store._getLocalRecordStateReports=function (chatId,msgId,callback) {
    db.all("select * from record_state_report where chatId=? and msgId=?",[chatId,msgId],(err,rows)=>{
        if(err){
            console.info(err)
        }else{
            callback(rows);
        }
    });
};
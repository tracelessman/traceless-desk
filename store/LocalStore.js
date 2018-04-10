/**
 * Created by renbaogang on 2018/1/22.
 */
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
Store.registerFromOther=function (data) {
    if(!this.data){
        this.data = [];
    }
    data.clientId = UUID();
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
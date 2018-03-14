/**
 * Created by renbaogang on 2018/1/22.
 */
var Store = require("../store/Store");
var UUID = require('uuid/v4');
var sqlite3 = require('sqlite3');
var db = new sqlite3.cached.Database('traceless.db');
db.serialize(function () {
    db.run("create table if not exists traceless(id INTEGER PRIMARY KEY NOT NULL,data TEXT)", [], function (err) {
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
}
/**
 * Created by renbaogang on 2018/1/22.
 */
var Store = require("../store/Store");
var UUID = require('uuid/v4');
Store.save2Local =function (key,value) {
    localStorage.setItem(key,value);
};
Store.queryFromLocal=function (key,callback) {
    var result = localStorage.getItem("data");
    callback(result);
};
Store.registerFromOther=function (data) {
    if(!this.data){
        this.data = [];
    }
    data.clientId = UUID();
    this.data.splice(0,1,data);
    this._save();
}
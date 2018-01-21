const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
const ipc = require('electron').ipcMain

const path = require('path')
const url = require('url')
const fs = require('fs');
const nativeImage = require('electron').nativeImage;
const net = electron.net
const dialog = electron.dialog


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
    checkUpdate();
    // Create the browser window.
    mainWindow = new BrowserWindow({width: 800, height: 600})
    mainWindow.webContents.openDevTools();
    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, '/index/index.html'),
        protocol: 'file:',
        slashes: true
    }))

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
})

let imageBrowser;
ipc.on('openImageBrowser', function (event, arg) {
    global.imageHtml = arg.html;
    if(!imageBrowser){
        imageBrowser = new BrowserWindow();

        imageBrowser.on('closed', function () {
            // Dereference the window object, usually you would store windows
            // in an array if your app supports multi windows, this is the time
            // when you should delete the corresponding element.
            imageBrowser = null
        })
    }
    imageBrowser.loadURL(url.format({
        pathname: path.join(__dirname, '/recent/showImage.html'),
        protocol: 'file:',
        slashes: true
    }))
    imageBrowser.setSize(arg.width+100,arg.height+100);
    imageBrowser.center();
    imageBrowser.setAlwaysOnTop(true)
    imageBrowser.show();
})


if(app.dock){
    var image = nativeImage.createFromPath(path.join(__dirname, "/images/traceless.png"));
    app.dock.setIcon(image);
}


let newMsgNotifyTimes=0;
ipc.on('messageReceive',function (event,arg) {
    newMsgNotifyTimes++;
    if(app.dock){
        app.dock.setBadge("new");
    }
})
ipc.on('messageRead',function (event,arg) {
    newMsgNotifyTimes--;
    if(app.dock&&newMsgNotifyTimes<=0){
        app.dock.setBadge("");
    }
})
let hasNewVersion = false;
function checkUpdate(){
    let request = net.request("https://raw.githubusercontent.com/tracelessman/traceless-desk/master/upgrade.json");
    request.on('response', (response) => {
        let text="";
        if(response.statusCode==200){
            response.on('data', (chunk) => {
                text+=chunk;
            })
            response.on('end', () => {
                let des = JSON.parse(text);
                let remoteVersion = parseInt(des.version.replace(/\./ig,""));
                let curVersion = parseInt(app.getVersion().replace(/\./ig,""));
                if(remoteVersion>curVersion){
                    hasNewVersion=true;
                    dialog.showMessageBox(null,{type:"info",message:"更新中..."})
                    let changeList = des.changeList;
                    let files = [];
                    for(var i=0;i<changeList.length;i++){
                        var change = changeList[i];
                        if(parseInt(change.version.replace(/\./ig,""))<=remoteVersion){
                            var _cfs = change.files;
                            _cfs.forEach(function (f) {
                                if(files.indexOf(f)==-1){
                                    files.push(f);
                                }
                            })
                        }
                    }
                    let counter=0;
                    files.forEach(function (path) {
                        let req = net.request("https://raw.githubusercontent.com/tracelessman/traceless-desk/master/"+path);
                        let index = path.lastIndexOf("/");
                        let dir;
                        if(index!=-1){
                            dir = path.substring(0,path.lastIndexOf("/"));
                        }


                        req.on("response",(rep)=>{
                            var txt="";
                            if(rep.statusCode==200){
                                rep.on("data",(chunk)=>{
                                    txt+=chunk;
                                });
                                rep.on("end",()=>{
                                    if(dir){
                                        var nd = path.join(__dirname, dir)
                                        if(!fs.existsSync(nd)){
                                            fs.mkdirSync(nd);
                                        }
                                    }
                                    fs.writeFile(path.join(__dirname,path),txt,function (err) {
                                        if(err){
                                            console.info(err);
                                        }else{
                                            counter++;
                                            if(counter==files.length){//所有下载成功
                                                app.relaunch();
                                                app.exit(0);
                                            }
                                        }
                                    });
                                });
                                rep.on('error', (err) => {
                                    console.info(err);
                                });
                            }else{
                                console.info(path+" download err:"+rep.statusCode);
                            }
                        });
                        req.end();
                    })
                }
            })
        }
    })
    request.end();
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
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

function isDev(){
    const getFromEnv = parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;
    const isEnvSet = 'ELECTRON_IS_DEV' in process.env;
    return isEnvSet ? getFromEnv : (process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath));
}
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
function createWindow () {

    // Create the browser window.
    mainWindow = new BrowserWindow({width: 800, height: 600,titleBarStyle: 'hidden',frame:true});
    global.mainWindow = mainWindow;
    global.appVersion = app.getVersion();
    // mainWindow.webContents.openDevTools();
    // and load the index.html of the app.
    checkUpdate(function (hasNew) {
        if(hasNew){
            mainWindow.loadURL(url.format({
                pathname: path.join(__dirname, '/index/update.html'),
                protocol: 'file:',
                slashes: true
            }))

        }else{
            mainWindow.loadURL(url.format({
                pathname: path.join(__dirname, '/index/index.html'),
                protocol: 'file:',
                slashes: true
            }))
        }

    })


    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

    mainWindow.on("focus",function () {
        mainWindow.webContents.send("mainWindow-focus");
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


ipc.on('messageReceive',function (event,arg) {
    if(app.dock){
        app.dock.setBadge(arg.total+"");
    }
})
ipc.on('messageRead',function (event,arg) {
    if(app.dock){
        if(arg.total){
            app.dock.setBadge(arg.total+"");
        }else{
            app.dock.setBadge("");
        }
    }
})
let hasNewVersion = false;
let latestVersion;
let files = [];
function checkUpdate(callback){

    let request = net.request("https://raw.githubusercontent.com/tracelessman/traceless-desk/master/upgrade.json");
    request.on('response', (response) => {
        let text="";
        if(response.statusCode==200){
            response.on('data', (chunk) => {
                text+=chunk;
            })
            response.on('end', () => {
                let des = JSON.parse(text);
                latestVersion = des.version;
                let remoteVersion = parseInt(latestVersion.replace(/\./ig,""));
                let curVersion = parseInt(app.getVersion().replace(/\./ig,""));
                if(remoteVersion>curVersion){
                    hasNewVersion=true;
                    callback(true);
                    let changeList = des.changeList;
                    files = ["package.json"];
                    for(var i=0;i<changeList.length;i++){
                        var change = changeList[i];
                        var vChange = parseInt(change.version.replace(/\./ig,""));
                        if(vChange>curVersion&&vChange<=remoteVersion){
                            var _cfs = change.files;
                            _cfs.forEach(function (f) {
                                if(files.indexOf(f)==-1){
                                    files.push(f);
                                }
                            })
                        }
                    }
                }else{
                    callback(false);
                }

            })
        }else{
            callback(false);
            console.info("check update response.statusCode:"+response.statusCode);
        }
    })
    request.on("error",function (err) {
        console.info(err.toString());
    });
    request.end();

}

ipc.on("remoteVersion-request",function (event,arg) {
    checkUpdate(function (hasNew) {
        event.sender.send('remoteVersion-response', latestVersion||app.getVersion());
    })
})

ipc.on("upgrade-request",function (event,arg) {
    checkUpdate(function (hasNew) {
        if(hasNew){
            mainWindow.loadURL(url.format({
                pathname: path.join(__dirname, '/index/update.html'),
                protocol: 'file:',
                slashes: true
            }))

        }else{
            mainWindow.loadURL(url.format({
                pathname: path.join(__dirname, '/index/index.html'),
                protocol: 'file:',
                slashes: true
            }))
        }

    })
})
let upgradeMessages = new Map();

ipc.on('start-download', function (event, arg) {
    download(files);
})

ipc.on('restart', function (event, arg) {
    app.relaunch();
    app.exit(0);
})

function getUpgradeMessages() {
    var html = "";
    upgradeMessages.forEach(function (v,k) {
        html += k+"---------------------"+v+"<br>";
    })
    return html;
}
function download(files) {
    var baseURI = "https://raw.githubusercontent.com/tracelessman/traceless-desk/master/";
    var index = baseURI.length;

    var count = 0;
    var count2=0;
    function changeMsg(f,m) {
        upgradeMessages.set(f,m);
        global.upgradeMessage = getUpgradeMessages();
        mainWindow.webContents.executeJavaScript("update()");
    }
    var tmpDir = path.join(__dirname, "_tmp");

    function deleteFolder(p) {
        var files = [];
        if( fs.existsSync(p) ) {
            files = fs.readdirSync(p);
            files.forEach(function(file){
                var curPath = path.join(p, file);
                if(fs.statSync(curPath).isDirectory()) {
                    deleteFolder(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            try{
                fs.rmdirSync(p);
            }catch(e){
                var _files = fs.readdirSync(p);
                _files.forEach(function(file){
                    dialog.showMessageBox({message:file});
                });
            }
        }
    }
    deleteFolder(tmpDir);
    function copyFiles(srcDir,targetDir){
        var files = fs.readdirSync(srcDir);
        files.forEach(function (file) {
            var curPath = path.join(srcDir, file);
            var targetPath = path.join(targetDir, file);

            if(fs.statSync(curPath).isDirectory()) { // recurse
                if(!fs.existsSync(targetPath)){
                    fs.mkdirSync(targetPath);
                }
                copyFiles(curPath,targetPath);
            } else {
                //fs.copyFileSync(curPath,targetPath);
                // var srcS = fs.createReadStream(curPath);
                // var targetS = fs.createWriteStream(targetPath);
                // srcS.pipe(targetS);
                // srcS.destroy();
                // targetS.destroy();
                fs.renameSync(curPath,targetPath);
            }
        })
    }

    mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
        //设置文件存放位置
        var f = item.getURL().substring(index);
        item.setSavePath(path.join(tmpDir, f));
        item.on('updated', (event, state) => {
            if (state === 'interrupted') {
                changeMsg(f,"interrupted");
            } else if (state === 'progressing') {
                if (item.isPaused()) {
                    changeMsg(f,"paused");
                } else {
                    changeMsg(f,Math.round((item.getReceivedBytes()/item.getTotalBytes())*100)+"%");
                }
            }
        })
        item.once('done', (event, state) => {
            count++;
            if (state === 'completed') {
                count2++;
                changeMsg(f,"100%");
            } else {
                changeMsg(f,`Download failed: ${state}`);
            }
            if(count == files.length){
                if(count2==count){
                    var targetDir = __dirname;
                    if(isDev()){
                        targetDir = path.join(__dirname,"_tmp2");

                        if(!fs.existsSync(targetDir)){
                            fs.mkdirSync(targetDir)
                        }
                    }
                     copyFiles(tmpDir, targetDir);
                     deleteFolder(tmpDir);
                }
                mainWindow.webContents.executeJavaScript("complete()");

            }
        })
    })

    files.forEach(function (f) {
        changeMsg(f,"downloading");
        mainWindow.webContents.downloadURL(baseURI+f);
    })
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
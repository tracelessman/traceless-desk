module.exports=function(e){function n(o){if(t[o])return t[o].exports;var r=t[o]={i:o,l:!1,exports:{}};return e[o].call(r.exports,r,r.exports,n),r.l=!0,r.exports}var t={};return n.m=e,n.c=t,n.d=function(e,t,o){n.o(e,t)||Object.defineProperty(e,t,{configurable:!1,enumerable:!0,get:o})},n.r=function(e){Object.defineProperty(e,"__esModule",{value:!0})},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,n){return Object.prototype.hasOwnProperty.call(e,n)},n.p="",n(n.s=5)}([function(e){e.exports=require("electron")},function(e){e.exports=require("original-fs")},function(e){e.exports=require("fs")},function(e){e.exports=require("url")},function(e){e.exports=require("path")},function(e,n,t){function o(){const e=1===parseInt(process.env.ELECTRON_IS_DEV,10);return"ELECTRON_IS_DEV"in process.env?e:process.defaultApp||/node_modules[\\/]electron[\\/]/.test(process.execPath)}function r(){(_=new l({width:1024,height:768,titleBarStyle:"hidden",frame:!0})).loadURL(f.format({pathname:u.join(__dirname,"/index/loading.html"),protocol:"file:",slashes:!0})),global.mainWindow=_,global.appVersion=c.getVersion(),_.webContents.openDevTools(),i(function(e){e?_.loadURL(f.format({pathname:u.join(__dirname,"/index/update.html"),protocol:"file:",slashes:!0})):_.loadURL(f.format({pathname:u.join(__dirname,"/index/index.html"),protocol:"file:",slashes:!0}))}),_.on("closed",function(){_=null}),_.on("focus",function(){_.webContents.send("mainWindow-focus")})}function i(e){let n=h.request("https://raw.githubusercontent.com/tracelessman/traceless-desk/publish/upgrade.json");n.on("response",n=>{let t="";200==n.statusCode?(n.on("data",e=>{t+=e}),n.on("end",()=>{let n=JSON.parse(t);if(1==function(e,n){for(var t=e.split("."),o=n.split("."),r=0;3>r;r++){var i=parseInt(t[r]),a=parseInt(o[r]);if(i>a)return 1;if(i!=a)return-1}return 0}(y=n.version,c.getVersion())){S=!0,e(!0);let t=n.changeList;b=["package.json"];for(var o=0;o<t.length;o++){t[o].files.forEach(function(e){-1==b.indexOf(e)&&b.push(e)})}}else e(!1)})):(e(!1),console.info("check update response.statusCode:"+n.statusCode))}),n.on("error",function(n){e(!1),console.info(n.toString())}),n.end()}function a(e){function n(e,n){j.set(e,n),global.upgradeMessage=function(){var e="";return j.forEach(function(n,t){e+=t+"---------------------"+n+"<br>"}),e}(),_.webContents.executeJavaScript("update()")}function t(e){if(p.existsSync(e)){p.readdirSync(e).forEach(function(n){var o=u.join(e,n);p.statSync(o).isDirectory()&&!o.endsWith(".asar")?t(o):p.unlinkSync(o)});try{p.rmdirSync(e)}catch(n){p.readdirSync(e).forEach(function(e){g.showMessageBox({message:e})})}}}var r="https://raw.githubusercontent.com/tracelessman/traceless-desk/publish/",i=r.length,a=0,s=0,c=u.join(__dirname,"_tmp");t(c),_.webContents.session.on("will-download",(r,l)=>{var d=l.getURL().substring(i);l.setSavePath(u.join(c,d)),l.on("updated",(e,t)=>{"interrupted"===t?n(d,"interrupted"):"progressing"===t&&(l.isPaused()?n(d,"paused"):n(d,Math.round(l.getReceivedBytes()/l.getTotalBytes()*100)+"%"))}),l.once("done",(r,i)=>{if(a++,"completed"===i?(s++,n(d,"100%")):n(d,`Download failed: ${i}`),a==e.length){if(s==a){var l=__dirname;o()&&(l=u.join(__dirname,"_tmp2"),!p.existsSync(l)&&p.mkdirSync(l)),function e(n,t){p.readdirSync(n).forEach(function(o){var r=u.join(n,o),i=u.join(t,o);p.statSync(r).isDirectory()?r.endsWith(".asar")?w.writeFileSync(i,w.readFileSync(r)):(!p.existsSync(i)&&p.mkdirSync(i),e(r,i)):p.renameSync(r,i)})}(c,l),t(c)}_.webContents.executeJavaScript("complete()")}})}),e.forEach(function(e){n(e,"downloading"),_.webContents.downloadURL(r+e)}),0==e.length&&_.webContents.executeJavaScript("complete()")}const s=t(0),c=s.app,l=s.BrowserWindow,d=t(0).ipcMain,u=t(4),f=t(3),p=t(2),m=t(0).nativeImage,h=s.net,g=s.dialog;var w=t(1);let _,x;if(c.on("ready",r),c.on("window-all-closed",function(){"darwin"!==process.platform&&c.quit()}),c.on("activate",function(){null===_&&r()}),d.on("openImageBrowser",function(e,n){global.imageHtml=n.html,x||(x=new l).on("closed",function(){x=null}),x.loadURL(f.format({pathname:u.join(__dirname,"/recent/showImage.html"),protocol:"file:",slashes:!0})),x.setSize(n.width+100,n.height+100),x.center(),x.setAlwaysOnTop(!1),x.show()}),c.dock){var v=m.createFromPath(u.join(__dirname,"/images/traceless.png"));c.dock.setIcon(v)}d.on("messageReceive",function(e,n){c.dock&&c.dock.setBadge(n.total+"")}),d.on("messageRead",function(e,n){c.dock&&(n.total?c.dock.setBadge(n.total+""):c.dock.setBadge(""))});let y,S=!1,b=[];d.on("remoteVersion-request",function(e){i(function(){e.sender.send("remoteVersion-response",y||c.getVersion())})}),d.on("upgrade-request",function(){i(function(e){e||o()?_.loadURL(f.format({pathname:u.join(__dirname,"/index/update.html"),protocol:"file:",slashes:!0})):_.loadURL(f.format({pathname:u.join(__dirname,"/index/index.html"),protocol:"file:",slashes:!0}))})});let j=new Map;d.on("start-download",function(){a(b)}),d.on("restart",function(){c.relaunch(),c.exit(0)})}]);
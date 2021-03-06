# web接口集成调用

**框架引用**
> 1.webappdemo引用地址<br>
> * git：https://github.com/xavier0509/newWebappdemo.git<br>
> * 将该目录下的所有文件复制到工作目录下（开发仅仅是对index.html页面以及相对应的css和js进行更改）

> 2.重写html页面以及js脚本
> * html内容需要包含在一个id = "deviceready" 的div中【此id名可进行更改，但需要在js中进行监听】，在js文件中，将对其进行监听 <br>
> * demo中的js/index.js可作为一个完整的参考例子，包含所有的接口调用方式<br>
> * 开发的重点在于对triggleButton:function()函数的重写/修改<br>
> *  在此之前的函数可归结为事件的监听加载过程，针对返回、主页键等进行自定义处理<br>
（receivedEvent: function(id)的内容根据需求进行增减）<br>

> 在完成页面开发之后，先自行在本地服务器上进行测试，代码上传到服务器上，在电视上通过CordovaTest.apk进行测试。在确认没有问题之后，发出邮件给运维人员进行正式环境(http://webapp.skysrt.com) 的部署。

- **接口调用方法【建议在酷开5.5（含）以上的版本使用】**
<table>
  <tr>
    <th width=40%, bgcolor=yellow >调用方法</th>
    <th width=10%, bgcolor=yellow>功能说明</th>
    <th width=30%, bgcolor=yellow>所需参数</th>
    <th width="20%", bgcolor=yellow>结果/备注</th>
  </tr>
  <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startLocalMedia(function(message) {console.log(message); },function(error) {console.log(error);}); </td>
    <td> 启动本地媒体  </td>
    <td>   </td>
    <td>  打开本地媒体界面 4.x的版本不支持</td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startTVSetting(function(message)  {console.log(message); },function(error){console.log(error);}); </td>
    <td> 启动电视设置 </td>
    <td>   </td>
    <td> 打开电视设置界面  4.x的版本不支持</td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startSourceList( function(message){console.log(message);},function(error){console.log(error); });</td>
    <td> 启动信号源  </td>
    <td>   </td>
    <td>  打开信号源选择界面 4.x的版本不支持</td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startMovieHistory(function(message) {console.log(message); },function(error) { console.log(error);}) </td>
    <td> 启动影视历史 </td>
    <td>   </td>
    <td> 打开影视历史界面  4.x的版本不支持</td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startMyGames(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动我的游戏  </td>
    <td>   </td>
    <td>  打开我的游戏界面 4.x的版本不支持</td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startMyApps(mode,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动我的应用 </td>
    <td> mode: child / 其他，代表启动的是哪个模式下的程序  </td>
    <td> 启动我的应用界面 4.x的版本不支持 </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startUserSetting(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动账户中心  </td>
    <td>   </td>
    <td>  启动用户账户中心 </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startNetSetting(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动网络设置 </td>
    <td>   </td>
    <td> 打开网络设置界面  </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startBlueToothSetting(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动蓝牙设置  </td>
    <td>   </td>
    <td>  打开蓝牙设置界面 </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startMessageBox(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动消息盒子 </td>
    <td>   </td>
    <td> 酷开5.5版本以上才具有消息盒子功能  </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startSystemUpgrade(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动系统升级  </td>
    <td>   </td>
    <td>  打开系统的升级页面 </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.getDeviceLocation(function(message) {},function(error) { console.log(error);}) </td>
    <td> 获取定位信息 </td>
    <td>   </td>
    <td> 设备定位信息的json串  </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.getUserAccessToken(function(message) {},function(error) { console.log(error);}) </td>
    <td> 获取accesstoken  </td>
    <td>   </td>
    <td>  用户的token值 登录前提下才有token </td>
  </tr>
  
  <tr>
    <td bgcolor=#eeeeee> coocaaosapi.getDeviceInfo(function(message) {             },function(error) { console.log(error);})</td>
    <td> 获取设备信息  </td>
    <td>   </td>
    <td> 含有屏幕尺寸（panel）、机芯（chip）、机型（model）、mac地址、安卓版本（androidsdk）、酷开版本（version）、激活id（activeid）、电视id（devid）、chipid等信息的json串 </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.isNetConnected(function(message){  },function(error) { console.log(error);}) </td>
    <td> 获取网络连接状态 </td>
    <td>   </td>
    <td> true（联网状态）/false（无网络状态）  </td>
 </tr>
 
  <tr>
    <td bgcolor=#eeeeee> coocaaosapi.hasCoocaaUserLogin(function(message) {          },function(error) { console.log(error);}) </td>
    <td> 用户是否登录  </td>
    <td>   </td>
    <td>  true：已经登录        false：未登录 </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.getUserInfo(function(message) { },function(error) { console.log(error);}) </td>
    <td> 获取用户信息 </td>
    <td>   </td>
    <td> 当前用户的信息json串  </td>
 
 
  </table>
  
  
  **应用圈相关**
  <table>
  <tr>
    <th width=40%, bgcolor=yellow >调用方法</th>
    <th width=10%, bgcolor=yellow>功能说明</th>
    <th width=30%, bgcolor=yellow>所需参数</th>
    <th width="20%", bgcolor=yellow>结果/备注</th>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startAppStore(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动应用圈	 </td>
    <td>   </td>
    <td> 打开应用圈  </td>
 </tr>
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startAppStoreBD(1,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动应用圈榜单	  </td>
    <td>   </td>
    <td>  跳转打开应用圈榜单页面 </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startAppStoreSort(sortid,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> id跳转应用圈分类	 </td>
    <td> sortid为输入/获取到的应用圈分类id  </td>
    <td> 跳转到该id对应的应用圈分类页面  </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startAppStoreList(listid,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> id跳转应用圈列表  </td>
    <td>  参数listid为输入/获取到的应用圈列表id </td>
    <td>  跳转到该id对应的应用圈列表 </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startAppStoreDetail(detailid,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> id跳转应用圈详情 </td>
    <td>  detailid为输入/获取到的应用圈详情id </td>
    <td> 跳转到该id对应的应用圈详情页面  </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startAppStoreZone(zoneid,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> id跳转应用圈专题  </td>
    <td>  zoneid为输入/获取到的应用圈专题id </td>
    <td>  跳转到该id对应的应用圈专题页面 </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startOrCreateDownloadTask(                           
  "https://qd.myapp.com/myapp/qqteam/AndroidQQ/mobileqq_android.apk",
  '',
  'qq移动版',
  'com.tencent.mobileqq',
  '123123', 
  'http://img.zcool.cn/community/01559e565d84d832f875964706920d.png',
function(message) {console.log(message); },
function(error) { console.log(error);});</td>
    <td> 下载一个任务 </td>
    <td>  1.下载路径
2.MD5校验值
3.下载文件名称
4.下载的包名
5.appid
6.icon图片地址 </td>
    <td> 在应用圈中进行下载  </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startGameCenter(function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 启动酷游吧  </td>
    <td>   </td>
    <td>  打开酷游吧界面 </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startGameArsenal(function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 启动游戏军火库 </td>
    <td>   </td>
    <td> 打开酷游吧游戏军火库页面  </td>
 </tr>
 </table>
 
 **影视相关**
  <table>
  <tr>
    <th width=40%, bgcolor=yellow >调用方法</th>
    <th width=10%, bgcolor=yellow>功能说明</th>
    <th width=30%, bgcolor=yellow>所需参数</th>
    <th width="20%", bgcolor=yellow>结果/备注</th>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startMovieList(listid,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> id跳转影视列表	 </td>
    <td>  参数listid为输入/获取到的影视id </td>
    <td> 跳转打开该id的影视列表  </td>
 </tr>
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startMovieDetail(detailid,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> id跳转影视详情	  </td>
    <td> 参数detailid为输入/获取到的影视详情id  </td>
    <td>  跳转打开该id的影视详情 </td>
  </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startMovieMemberCenter(function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 启动影视会员中心  </td>
    <td>   </td>
    <td>  启动打开影视会员中心 </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startMovieHome(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动影视主页 </td>
    <td>   </td>
    <td> 打开影视主页面  </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startMovieTopic(topicid,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 参数topicid为输入/获取到的影视专题的id	  </td>
    <td>   </td>
    <td>  跳转打开该id对应的影视专题页 </td>
  </tr>
  </table>
  
  
   **监听调用**
  <table>
  <tr>
    <th width=40%, bgcolor=yellow >调用方法</th>
    <th width=10%, bgcolor=yellow>功能说明</th>
    <th width=30%, bgcolor=yellow>所需参数</th>
    <th width="20%", bgcolor=yellow>结果/备注</th>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.addPurchaseOrderListener(function(message) {}) </td>
    <td> 支付状态监听	 </td>
    <td> </td>
    <td>   </td>
 </tr>
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.addUserChanggedListener(function(message) {}) </td>
    <td> 账户状态变更监听	  </td>
    <td>   </td>
    <td>   </td>
  </tr>
 
 <tr>
    <td bgcolor=#00FF00> coocaaosapi.addUSBChangedListener(function(message) {}) </td>
    <td> USB状态监听	 </td>
    <td> </td>
    <td>   </td>
 </tr>
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.addNetChangedListener(function(message) {}) </td>
    <td> 网络状态变更监听	  </td>
    <td>   </td>
    <td>   </td>
  </tr><tr>
    <td bgcolor=#00FF00> coocaaosapi.addAppTaskListener(function(message) {})</td>
    <td> APK下载监听	 </td>
    <td> </td>
    <td>   </td>
 </tr>
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.addCommonListener(function(message){
            console.log("commonListen=="+JSON.stringify(message));
        }) </td>
    <td> 通用监听【新浏览器】	  </td>
    <td>   </td>
    <td>   </td>
  </tr>
  </table>
  
  
  
   **商城相关**
  <table>
  <tr>
    <th width=40%, bgcolor=yellow >调用方法</th>
    <th width=10%, bgcolor=yellow>功能说明</th>
    <th width=30%, bgcolor=yellow>所需参数</th>
    <th width="20%", bgcolor=yellow>结果/备注</th>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startAppShop(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动酷开商城首页	 </td>
    <td>  </td>
    <td>   </td>
 </tr>
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startAppShopList(detailid,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动酷开商城列表页	  </td>
    <td> 参数detailid为输入/获取到的商城列表id  </td>
    <td>   </td>
  </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startAppShopDetail(id,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 启动购物图文详情页  </td>
    <td>  id为图文详情页id </td>
    <td>   </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startAppShopZone(id,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动酷开商城专题页 </td>
    <td>   专题页id</td>
    <td>   </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startAppShopZoneList(function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 启动酷开商城专题列表页	  </td>
    <td>   </td>
    <td>   </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startAppShopVideo(id,url,name,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动酷开商城视频详情页 </td>
    <td>   视频页id，url，名称</td>
    <td>   </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startAppShopBUYING(id,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 启动购物酷开商城活动列表页	  </td>
    <td> 活动列表页id  </td>
    <td>   </td>
  </tr>
  </table>
  
  
  
   **其他【新增】**
  <table>
  <tr>
    <th width=40%, bgcolor=yellow >调用方法</th>
    <th width=10%, bgcolor=yellow>功能说明</th>
    <th width=30%, bgcolor=yellow>所需参数</th>
    <th width="20%", bgcolor=yellow>结果/备注</th>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.notifyJSMessage(webInfoStr,function(message)
{  },function(error) { console.log(error);})</td>
    <td> Web页面消息上传	 </td>
    <td>webInfoStr为字符串  </td>
    <td>   </td>
 </tr>
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.notifyJSLogInfo(eventId,ddata,function(message)
{  },function(error) { console.log(error);})</td>
    <td> Web日志提交上传	  </td>
    <td> eventId为字符串，是日志项名称
Ddata是json形式的字符串。允许为空，但必须传”{}”  </td>
    <td>   </td>
  </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.getPropertiesValue(data,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 获取属性  </td>
    <td>  propertiesKey的属性名 </td>
    <td>   </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.getSpaceInfo(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 获取space </td>
    <td>   </td>
    <td>   获取设备的空间 </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startMyCoupon(sign,openId,appId,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 启动我的优惠券	  </td>
    <td>  不同业务线有固定的sign和appid </td>
    <td>   </td>
  </tr>
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startAppShopVideo(id,url,name,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动酷开商城视频详情页 </td>
    <td>   视频页id，url，名称</td>
    <td>   </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startCommonWebview(id,uri,tips,height,width,call_url,type,name,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 启动web播放器	  </td>
    <td>   </td>
    <td>   </td>
  </tr>
  
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startNewBrowser(url,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动新版本浏览器 </td>
    <td>   视频页id，url，名称</td>
    <td>   </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.startCommonWebview(id,uri,tips,height,width,call_url,type,name,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 启动web播放器	  </td>
    <td>   </td>
    <td>   </td>
  </tr>
  
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.notifyJSLogResumeInfo(eventId,ddata,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 用于活动中心的曝光事件，可采集时长，与notifyJSLogPauseInfo成对出现</td>
    <td> eventId日志项名称、ddata拓展参数</td>
    <td>   </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.notifyJSLogPauseInfo(eventId,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 用于活动中心的曝光事件，可采集时长，与notifyJSLogResumeInfo成对出现  </td>
    <td> 只有 eventId日志项名称 </td>
    <td>   </td>
  </tr>
  
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.hasApk(pkgname,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 检测是否装有apk</td>
    <td> pkgname为应用包名</td>
    <td>   </td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.getAppInfo(packageList,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 获取app相关信息  </td>
    <td> 参数传递一个对象，key为"pkgList",value为应用包名的数组。即{pkgList:["com.tianci.user","com.tianci.movieplatform"]} </td>
    <td>   </td>
  </tr>
  
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.getBaseInfo(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 获取基础信息(内存、存储空间等)</td>
    <td></td>
    <td></td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.setBusinessData(cc_type,cc_data,function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 设置Business相关信息  </td>
    <td> cc_type区分同步、异步。默认为异步（async）,只有传sync时才会更改;cc_data为json形式的字符串 </td>
    <td> 如 需要得到返回结果，采用getBusinessData</td>
  </tr>
  
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.getBusinessData(function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 获取Business相关信息</td>
    <td>cc_type区分同步、异步。默认为异步（async）,只有传sync时才会更改;cc_data为json形式的字符串</td>
    <td></td>
 </tr>
 
 <tr>
    <td bgcolor=#eeeeee> coocaaosapi.setCoocaaUserLogout(function(message) {console.log(message); },function(error) { console.log(error);});</td>
    <td> 退出用户登录状态  </td>
    <td></td>
    <td></td>
  </tr>
  
  <tr>
    <td bgcolor=#00FF00> coocaaosapi.startParamAction(pkname,version,activity,action,param,str,function(message) {console.log(message); },function(error) { console.log(error);}); </td>
    <td> 启动传参action页面</td>
    <td>包名、版本号、startActivity、action、action名、拓展参数[{key1:"value1"},{key2:"value2"}]</td>
    <td></td>
 </tr>
  
  </table>
  

const QQMapWX = require('../utils/qqmap-wx-jssdk.min');
var qqMapConfig = module.exports ={
    qqmapsdk: new QQMapWX({ //创建实例
        //腾讯位置服务：   https://lbs.qq.com/console/mykey.html
        key: 'HKOBZ-L6BKU-AOLVX-BAPXB-ABC6Q-PKF34', //这里自己的key秘钥进行填充，该key是腾讯位置服务中申请的
    }),
}
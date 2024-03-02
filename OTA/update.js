const {
  file
} = require('./edition.js')
//ota的版本号
const LASTEST_VSERSION = 'lastest_version'
const VERSION_2 = 2;
const VERSION_1 = 1; //版本1.0
//版本号从小到大
const OTA_EDITION = [VERSION_1, LASTEST_VSERSION];
//ota的更新,发送数据包的间隔时间100ms
const OTA_UPDATE_SEND_INTERVAL = 100;
const OTAVersion = new Map([
  [LASTEST_VSERSION,
    {
      "version": VERSION_2, //更新的number用于比较是否更新
      "err": "",
      "state": true, // 是否禁用
      "msg": "success",
      "updateTime": "2023-09-10",
      "desc": ["1.修复了", "2.更新了"],
      "file": file[LASTEST_VSERSION]
    }
  ]
])
module.exports = {
  OTAVersion,
  LASTEST_VSERSION,
  OTA_EDITION,
  OTA_UPDATE_SEND_INTERVAL,
}
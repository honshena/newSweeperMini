const {
  file
} = require('./edition.js')
//ota的版本号
const LASTEST_VSERSION = 'lastest_version'
const VERSION_1 = '1'; //版本1.0
//版本号从小到大
const OTA_EDITION = [VERSION_1, LASTEST_VSERSION]
const OTAVersion = new Map([
  [LASTEST_VSERSION,
    {
      "version": 2,
      "err": "",
      "state": true,
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
  OTA_EDITION
}
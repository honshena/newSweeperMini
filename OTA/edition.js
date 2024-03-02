const {
    version2
} = require('./version2')

//不能互相require
const file = {
    // 测试使用
    lastest_version: version2,
    //新增的版本写下边
    ['qds']: []
}

module.exports = {
    file,
}
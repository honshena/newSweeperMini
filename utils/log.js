const {
    version,
    version_develop,
} = require('../config/bluetooth');
const log = wx.getRealtimeLogManager ? wx.getRealtimeLogManager() : null
/**
 * 一般消息使用info
 * 非重要报错,不影响小程序使用,使用warn
 * 重要报错,影响小程序使用,使用error
 * 调试使用debug
 */
var logUtils = module.exports = {
    debug() {
        if (!log) return
        log.debug.apply(log, arguments)
    },
    info() {
        if (!log) return
        log.info.apply(log, arguments)
    },
    warn() {
        if (!log) return
        log.warn.apply(log, arguments)
    },
    error() {
        if (!log) return
        log.error.apply(log, arguments)
    },
    setFilterMsg(msg) { // 从基础库2.7.3开始支持
        if (!log || !log.setFilterMsg) return
        if (typeof msg !== 'string') return
        log.setFilterMsg(msg)
    },
    addFilterMsg(msg) { // 从基础库2.8.1开始支持
        if (!log || !log.addFilterMsg) return
        if (typeof msg !== 'string') return
        log.addFilterMsg(msg)
    },
    logCount: 1,
    // 只在开发模式下显示详情
    /* 
    {
        debug: boolean, //只在develop下显示
        info: 显示的信息
    }*/
    logDebugInfo(...args) {
        let info = [];
        args.forEach(v => {
            if (typeof v === 'object') {
                if (v.debug && version_develop === version) {
                    Array.isArray(v.info) ? info.push(...v.info) : info.push(v.info)
                }
            } else {
                info.push(v);
            }
        })
        logUtils.logInfo(...info);
    },
    logDebug(...args) {
        logUtils.debug(`debug ${logUtils.logCount}: `, ...args)
        console.debug(`debug ${logUtils.logCount}: `, ...args)
        logUtils.logCount += 1
    },
    logInfo(...args) {
        logUtils.info(`info ${logUtils.logCount}: `, ...args)
        console.log(`info ${logUtils.logCount}: `, ...args)
        logUtils.logCount += 1
    },
    logWarn(...args) {
        logUtils.warn(`warn ${logUtils.logCount}: `, ...args)
        console.warn(`warn ${logUtils.logCount}: `, ...args)
        logUtils.logCount += 1
    },
    logError(...args) {
        logUtils.error(`error ${logUtils.logCount}: `, ...args)
        console.error(`error ${logUtils.logCount}: `, ...args)
        logUtils.logCount += 1
    },
}
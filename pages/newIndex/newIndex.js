const {
    DEVICENAME,
    UNKNOWNDEVICE
} = require('../../config/const.js')
const {
    OTAVersion,
    LASTEST_VSERSION
} = require('../../OTA/update.js')
const {
    logInfo,
    logWarn,
    logError,
    logDebug,
} = require('../../utils/log.js')
const {
    BluetoothManager
} = require("../../BluetoothController.js")
const {
    deviceConfig,
    isAcceptDataValid,
    warningH,
    warningL,
    acceptMAXInterval,
    acceptInterval,
    awaitInterval,
} = require('../../config/bluetooth.js')
const {
    showLoading,
    hideLoading,
    getLocation,
    getLocationStorage,
    getInputStorage,
    getLatesDeviceStorage,
    showToast,
    resAndInfo,
    requestJSONFile,
    ab2str,
    ab2hex,
} = require('../../utils/utils.js'),
    app = getApp();
var buletoothManager; //适合全局直接访问


Page({
    data: {

        isConnect: false,
        lastestConnecteddevice: {
            services: [{
                characterics: ""
            }],
            deviceId: '',
            name: '',
            deviceName: '',
        },
        model_select: ["双体", "单体", "爬墙"],
        model: "双体",
        devices: [], //存放用于渲染的设备列表
        //显示隐私协议
        showPrivacy: false,
        //隐私协议名称
        privacyContractName: '',
        isSearchHidden: !0,
        isDelay: !0,
        refresh: !1,
        isInput: !1,
        inputInd: "",
        inputPlaceholder: '',
        //记录每个操作数据
        /**各索引对应数据意义
         * 1: 左电机
         * 2: 灵敏度
         * 3: 右电机
         * 4: 安全时间
         * 5: 机型
         * 6: 定时,
         * 7: 左电机电流
         * 8: 泵电机电流
         * 9: 右电机电流
         */
        input: [],
        marginTop: 0,
        marginBtm: 0,
        titleHidden: !1,
        //导航栏高度
        navigationBarHeight: 0,
        //手机的状态栏高度
        statusBarHeight: 0,
        //页面内容高度
        pageContenHeight: 0,
        //小程序当前版本信息
        appInfo: {},
        envVersion: '',
        version: '',
        //弹窗属性
        modalProps: {
            type: 'input',
            isHidden: true,
            hideCancel: false,
            mask: true,
            placeholder: '',
        }
    },
    defauleModalProps: {
        type: 'input',
        isHidden: true,
        hideCancel: false,
        mask: true,
        placeholder: '',
    },
    //持续发送字符串定时器id
    keepSend: "",

    async onLoad(onLoadInfo) {
        logInfo("[newIndex.onLoad]", onLoadInfo)
        //获取手机信息
        const sysInfo = wx.getSystemInfoSync()
        logInfo(`手机型号: [${sysInfo.brand} ${sysInfo.model}], 手机系统: [${sysInfo.system}]`, sysInfo)

        //初始化导航栏高度,要在onload执行,onshow执行会有页面异常跳动
        this.initNavBar()

        buletoothManager = new BluetoothManager(sysInfo.system)

        const
            lastestConnecteddevice = getLatesDeviceStorage(),
            input = getInputStorage()

        logInfo(`硬件配置, 安全时间: [${input[4]?input[4]:'无'}], 左电机转速: [${input[1]?input[1]:'无'}], 右电机转速: [${input[3]?input[3]:'无'}], 灵敏度: [${input[2]?input[2]:'无'}], 机型: [机型${input[5]?input[5]:'无'}], 硬件配置数组: `, input)

        this.setData({
            lastestConnecteddevice,
            isConnect: false, //初始化未连接设备
            input, //设备配置

        })


    },

    async onShow() {
        //解包测试: 升级和通讯故障测试
        //this.resolvePackage([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

        //初始化附件设备列表
        this.devicesMap = new Map()
        //获取小程序版本信息
        this.getMiniProgramInfo()
        //检查隐私协议
        this.showPrivacy()
        //判断是否开启了蓝牙和位置信息
        //const prepared =await 
        this.isBuletoothAndLocationPrepared()

        //如果开启了则重连上次设备,重连上次设备是不是不需要位置信息???
        // prepared && lastestConnecteddevice && lastestConnecteddevice.deviceId && this.connectBLEDevice(lastestConnecteddevice, true) //重连上次设备参数二为true
    },
    //设置界面高度和内容区域高度
    initNavBar() {
        const {
            statusBarHeight,
            windowHeight,
            platform
        } = wx.getSystemInfoSync() || {}
        const {
            top,
            height
        } = wx.getMenuButtonBoundingClientRect() || {}
        let navigationBarHeight = 0
        // 判断胶囊按钮信息是否成功获取
        if (top && top !== 0 && height && height !== 0) {
            navigationBarHeight = (top - statusBarHeight) * 2 + height

        } else {

            navigationBarHeight = platform === 'android' ? 48 : 40

        }
        this.setData({
            navigationBarHeight,
            statusBarHeight,
            pageContenHeight: windowHeight - navigationBarHeight - statusBarHeight
        })
    },

    //获取小程序版本信息及版本号
    getMiniProgramInfo() {
        const appInfo = wx.getAccountInfoSync();
        let envVersion = appInfo.miniProgram.envVersion || '';
        if (envVersion == 'develop')
            envVersion = '开发版'
        else if (envVersion == 'trial')
            envVersion = '体验版'
        else
            envVersion = '正式版'
        //根据不同的版本在日志中打印不同的信息
        envVersion != '正式版' ?
            logWarn(`当前小程序使用: [${envVersion} ${appInfo.miniProgram.version}]`, appInfo) :
            logInfo(`当前小程序使用: [${envVersion} ${appInfo.miniProgram.version}]`, appInfo)

        this.setData({
            appInfo,
            envVersion,
            version: appInfo.miniProgram.version || ' '
        })
    },
    //弹出隐私协议
    showPrivacy() {
        wx.getPrivacySetting({
            success: res => {
                console.log(res) // 返回结果为: res = { needAuthorization: true/false, privacyContractName: '《xxx隐私保护指引》' }
                if (res.needAuthorization) {
                    // 需要弹出隐私协议
                    this.setData({
                        showPrivacy: true,
                        privacyContractName: res.privacyContractName
                    })
                } else {
                    // 用户已经同意过隐私协议，所以不需要再弹出隐私协议，也能调用隐私接口
                }
            },
            fail: () => {},
            complete: () => {}
        })
    },
    //打开隐私协议
    handleOpenPrivacyContract() {
        // 打开隐私协议页面
        wx.openPrivacyContract({
            success: () => {}, // 打开成功
            fail: () => {}, // 打开失败
            complete: () => {}
        })
    },
    //用户同意隐私协议
    handleAgreePrivacyAuthorization() {
        this.setData({
            showPrivacy: false
        })
    },
    //用户拒绝隐私协议
    handleCancelPrivacyAuthorization() {
        showToast('用户拒绝隐私协议')
        this.setData({
            showPrivacy: false
        })
        wx.exitMiniProgram()
    },
    //经纬度转地理位置
    async locationToRealPlace() {
        //位置信息location缓存由BluetoothController类缓存在本地
        const location = getLocationStorage()
        //获取小程序定位并查看定位是否打开
        if (location.latitude && location.longitude)
            try {
                const res = await getLocation(location.latitude, location.longitude)
                this.isReportRealPlace = true
                logInfo("qqmap api正常运行,获取地理位置成功: ", res)
            } catch (err) {
                logWarn("qqmap api运行出错,获取地理位置失败: ", res)
            }

    },
    //重连设备并重置连接状态
    /**
     * 
     * @param {*} e:{deviceid:'...',connected: true} 
     */
    BLEStateChangeCallback(e) {
        this.setData({
            isConnect: e.connected,
        })
        if (!e.connected) {
            this.releaseBluetooth()
        }
        //buletoothManager.keepBLEConnectionCallback(e)
    },
    //蓝牙拆包
    packageErrorCount: 0, //接受包出错计数器
    acceptPackagetInterval: null, //检查接受包的定时器
    lastAcceptPackage: new Date(), //最后一次接受包的时间
    alreadyWarnController: false, //是否显示控制器异常
    BLEresolvepackage(arr) {
        logInfo('BLEresolvepackage: ', arr)
        let check = isAcceptDataValid(arr)
        if (!check && !this.alreadyWarnController) {
            this.packageErrorCount += 1;
            if (this.packageErrorCount >= 3) {
                showToast('控制器异常，请重启控制器', {
                    duration: 2000
                })
                this.alreadyWarnController = true;
                logWarn(`[控制器异常],接收包校验: ${check?'通过':'不通过'},包检查出错:${this.packageErrorCount}次,lastAcceptPackage: ${this.lastAcceptPackage.toISOString()}`)
                this.packageErrorCount = 0
            }

        }

        //启动发送数据监测
        if (!this.acceptEeptInterval) {
            this.acceptPackagetInterval = setInterval(() => {
                let now = new Date()
                if (now - this.lastAcceptPackage > acceptMAXInterval && !this.alreadyWarnController) {
                    logWarn(`[控制器异常]: 接收包的时间超时`)
                    showToast('控制器异常，请重启控制器', {
                        duration: 2000
                    })
                    this.alreadyWarnController = true
                    clearInterval(this.acceptPackagetInterval)
                    this.acceptPackagetInterval = null
                }
            }, acceptMAXInterval)
        }
        //拆包
        this.resolvePackage(arr)
        //重置接收包的时间
        this.lastAcceptPackage = new Date()
    },
    alreadyWarnH: new Array(8), //报警位是否报警标识
    alreadyWarnL: new Array(8), //报警位是否报警标识
    alreadyUpdate: false, //升级提示
    //todo 应该把提醒用户的放到一个函数里,只执行一次,之后解包不走这个函数
    resolvePackage(arr = []) {
        //解包的文档看document
        let ota = OTAVersion.get(LASTEST_VSERSION)
        if (ota.version > arr[1] && !this.alreadyUpdate) {
            this.showWarn('有新的版本是否升级', {
                hideCancel: false,
                handleSure: 'otaUpdate',
                handleCancel: 'hideModal'
            })
            ota.version = arr[1]
            this.alreadyUpdate = true
        }
        //报警位H和L
        let warnH = arr[10], //报警H是数组下标10
            warnL = arr[11] //报警L是数组下标11
        // logInfo('arr-pag: ', arr, this.alreadyWarnH, this.alreadyWarnL)
        for (let i = 0; i < 8; i++) {
            //todo: 正式上线需要全部都显示
            if ((warnH & 1) && !this.alreadyWarnH[i]) {
                this.showWarn(warningH[i])
                this.alreadyWarnH[i] = true
            }
            if ((warnL & 1) && !this.alreadyWarnL[i]) {
                this.showWarn(warningL[i])
                this.alreadyWarnL[i] = true
            }
            warnL = warnL >> 1
            warnH = warnH >> 1
        }
        // logInfo('arr-after: ', arr, this.alreadyWarnH, this.alreadyWarnL)

        //记录每个操作数据
        /**各索引对应数据意义
         * 1: 左电机
         * 2: 灵敏度
         * 3: 右电机
         * 4: 安全时间
         * 5: 机型
         * 6: 定时
         * 7: 左电机电流
         * 8: 泵电机电流
         * 9: 右电机电流
         */
        let input = [0, arr[3], arr[8], arr[4], arr[9], arr[2], this.data.input[6], arr[5], arr[7], arr[6]]
        this.setData({
            input: [...input]
        })
    },
    //显示提示,是否需要上传日志
    showWarn(text, op) {
        if (!text) return;
        logWarn('[showWarn]故障: ', text)
        const prop = {
            isHidden: false,
            type: 'text',
            placeholder: text,
            hideCancel: true,
            handleSure: 'hideModal', //调用this.hideModal()
            ...op,
        }
        this.modalStack.push(prop)
        this.setData({
            modalProps: prop
        })
    },
    //读取蓝牙数据
    BLEValueChangeCallback(value) {
        //logInfo('BLEValueChangeCallback: ',value.toLocaleString(),value.byteLength)
        //需要校验包的合法性
        if (value.byteLength === 18) {
            //发送的是数据包
            this.BLEresolvepackage(ab2hex(value))
        } else {
            //发送的是字符串
            let str = ab2str(value)
            //发送的是
            if (str === "boot ok") {
                this.otaUpdateSend()
                this.updateErrorCount = 0;
                clearInterval(this.updateConnectIntarl)
            }
            if (str === 'program ok') {
                showToast('ota成功升级')
            }
        }

    },
    updateErrorCount: 0, //更新出错计数器
    updateConnectIntarl: null, //建立连接定时器
    otaUpdate() {
        logInfo('click [otaUpate]: ', this.updateErrorCount)
        this.hideModal()
        if (!this.updateConnectIntarl) {
            this.updateConnectIntarl = setInterval(() => {
                this.updateErrorCount += 1;
                if (this.updateErrorCount >= 3) {
                    clearInterval(this.updateConnectIntarl)
                    this.updateConnectIntarl = null
                    this.showWarn('ota 更新出错')
                }
                buletoothManager.writeBLECharacteristicValue("k 01")
            }, awaitInterval)
        }
        this.updateErrorCount = 0;
    },

    async otaUpdateSend() {
        setTimeout(async () => {
            const ota = OTAVersion.get(LASTEST_VSERSION)
            //向上取整
            const length = Math.ceil(ota.file.length / 20)
            let arr = []
            const timers = []
            for (let i = 0; i < length; i++) {
                let timer = setTimeout(async () => {
                    arr = ota.file.slice(i * 20, i * 20 + 20)
                    //仅在50%和100%时上传日志
                    this.setData({
                        modalProps: {
                            placeholder: `OTA升级进度: ${Math.floor((i+1)/length*100)}%`,
                            hideCancel: true,
                            type: 'text',
                            handleSure: i == length - 1 ? 'hideModal' : '',
                            okText: i == length - 1 ? '升级成功' : '请等待',

                        }
                    })
                    const writeRes = await buletoothManager.writeBLECharacteristicValue(arr)
                    if (!writeRes.res) {
                        this.hideModal()
                        this.showWarn('升级失败,请稍后重试')
                        timers.forEach(v => clearTimeout(v))
                    }
                }, i * acceptInterval)
                timers.push(timer)
            }
            //等待主板准备2s
        }, 2000)
    },
    //连接蓝牙设备
    async connectBLEDevice(lastestConnecteddevice, reconnect) {
        //连接设备并禁止操作
        const prepared = await this.isBuletoothAndLocationPrepared()
        if (!prepared) {
            return
        }
        showLoading(`${reconnect?'自动重连':'连接'}` + (lastestConnecteddevice.deviceName ? lastestConnecteddevice.deviceName : UNKNOWNDEVICE))
        setTimeout(() => {
            hideLoading()
        }, 5000) //test
        const isConnect = await buletoothManager.initConnect(lastestConnecteddevice, reconnect,
            this.BLEStateChangeCallback,
            this.BLEValueChangeCallback
        )
        hideLoading()
        if (!isConnect.res) {
            showToast(isConnect.msg)
            return false
        }


        showToast('连接成功')

        this.setData({
            isConnect: true,
            lastestConnecteddevice,
        })

        //获取此设备的所有服务号和特征值
        const servicesAndCharacteristics = await buletoothManager.getBLEServiceToCharacteristicsAll()
        if (servicesAndCharacteristics.res) {
            logInfo(`成功获取[${lastestConnecteddevice.deviceName}]所有服务号和特征值:`, servicesAndCharacteristics, ` 设备显示名称: ${lastestConnecteddevice.name}, 设备MAC地址: ${lastestConnecteddevice.deviceId}`)
        } else {
            logInfo(`失败获取[${lastestConnecteddevice.deviceName}]所有服务号和特征值:`, servicesAndCharacteristics, ` 设备显示名称: ${lastestConnecteddevice.name}, 设备MAC地址: ${lastestConnecteddevice.deviceId}`)
        }

    },

    isReportRealPlace: false, //本次启动小程序是否上报过用户地理位置
    //检查蓝牙和位置信息是否正常开启
    async isBuletoothAndLocationPrepared(onlyBluetooth = true) {
        const self = this
        return new Promise(async (resolve, reject) => {
            const prepared = onlyBluetooth ?
                await buletoothManager.isBluetoothAdapterOpen() : await buletoothManager.isBuletoothAndLocationPrepared()
            //位置信息和蓝牙未正常打开
            //prepared.res = true; //test
            if (!prepared.res) {
                showToast(prepared.msg)
                logError(prepared.msg, prepared)
                return resolve(false)
            }
            if (onlyBluetooth)
                logInfo("[蓝牙正常打开]", prepared)
            else
                logInfo("[位置信息与蓝牙正常打开]", prepared)
            //上报用户位置,只上报一次
            if (!self.isReportRealPlace) {
                //获取用户实际地理位置
                self.locationToRealPlace()
            }
            return resolve(true)
        })

    },

    //点击选择设备触发,并显示附近的蓝牙设备列表
    async chooseDevice() {
        logInfo("用户[点击]选择设备, index.chooseDevice")
        wx.authorize({
            scope: 'scope.userLocation',
        })
        //todo 需要改为await this.isBuletoothAndLocationPrepared(false)
        if (await this.isBuletoothAndLocationPrepared())
            this.refresh()

        //显示列表
        this.setData({
            isDelay: false,
            isSearchHidden: false
        })
    },

    //点击连接设备
    async connect(e) {
        if (this.data.isConnect)
            return;

        const deviceInfo = e.currentTarget.dataset,
            deviceId = deviceInfo.deviceid,
            name = deviceInfo.name,
            localName = deviceInfo.localname,
            deviceName = deviceInfo.devicename || name || localName || UNKNOWNDEVICE, //设备的显示名称
            lastestConnecteddevice = {
                deviceId: deviceId,
                name,
                deviceName,
                localName,
            };
        //console.log(lastestConnecteddevice);
        await this.connectBLEDevice(lastestConnecteddevice, false) //连接新设备

    },

    //隐藏设备列表
    hideSearchlist: async function () {
        logInfo('用户[点击]关闭选择设备, index.hideSearchlist')
        const self = this;
        this.setData({
            isSearchHidden: true
        });
        setTimeout(function () {
            self.setData({
                isDelay: self.data.isSearchHidden
            });
        }, 600)
        //清理自动更新的定时器
        this.clearUpdateDeviceListIntervalId()

        //关闭发现和更新设备列表
        const stop = await buletoothManager.stopSearchAndUpdateBluetoothDevice();

        if (stop.res)
            logInfo("已经停止搜索蓝牙设备和更新设备列表: ", stop)
        else
            logWarn(stop.msg, stop)


    },

    //刷新显示设备列表的定时器id,updateDevicesList定时更新设备列表clearUpdateDeviceListIntervalId清除定时器
    updateDeviceListIntervalId: "", //更新设备列表的定时器
    devicesMap: '', //存放设备列表->转换为devices
    clearUpdateDeviceListIntervalId() {
        clearInterval(this.updateDeviceListIntervalId)
        this.updateDeviceListIntervalId = null
    },

    //更新设备列表list
    async updateDevicesList(updateTime = 1000) {
        this.clearUpdateDeviceListIntervalId()
        const self = this
        if (this.updateDeviceListIntervalId == null)
            this.updateDeviceListIntervalId = setInterval(() => {
                const devices = []
                self.devicesMap.forEach(device => {
                    devices.push(device)
                })
                console.log("设备列表长度: ", devices.length, "设备列表: ", devices)
                self.setData({
                    devices,
                })
            }, updateTime);

    },

    //更新设备列表的map,map用于过滤保留每一个设备的信息,以deviceid区分
    updateDevicesMap(e) {

        this.devicesMap.set(e.deviceId, e)
        //console.log("设备列表长度: ", devicesMap.size, "设备列表: ", devicesMap)
    },

    //点击刷新或者通过选择设备调用
    refresh() {
        logInfo("index.refresh刷新设备列表")
        showToast('正在刷新列表')
        const self = this;
        return new Promise(async (resolve, reject) => {
            //防止误触
            if (self.data.refresh) {
                showToast('正在刷新列表')
                return resolve(true, {}, "正在刷新中")
            }

            //正常打开蓝牙和定位后开启列表显示
            self.setData({
                refresh: true,
            })
            //2s后关闭动画
            setTimeout(function () {
                self.setData({
                    refresh: false
                });
            }, 2000)



            //修改设备列表显示的名字为吸污机
            let isStartSearchAndUpdate = await buletoothManager.startSearchAndUpdateBluetoothDevice((e) => {
                //修改显示名称
                if (deviceConfig.get(e.name))
                    e.deviceName = DEVICENAME
                else
                    e.deviceName = UNKNOWNDEVICE

                //有些设备没有名称需要统一一下也有可能连localName都没有
                if (!e.name)
                    e.name = e.localName

                //更新设备列表map
                self.updateDevicesMap(e)
                return
            });

            //未能启用搜索和发现附近设备
            //isStartSearchAndUpdate.res = true //test
            if (!isStartSearchAndUpdate.res) {
                logError(isStartSearchAndUpdate.msg, isStartSearchAndUpdate)
                showToast("搜索附近设备失败")
                return resolve(resAndInfo(false, isStartSearchAndUpdate))

            }

            //更新显示设备列表
            showToast("正在刷新列表")
            this.updateDevicesList()

            return resolve(resAndInfo(true, "正在发现设备并更新设备列表"))
        })

    },

    //用户点击按钮,并发送数据
    sendStr: function (e) {
        //振动
        wx.vibrateShort({
            type: 'light'
        })
        let data = e.currentTarget.dataset.str,
            {
                input
            } = this.data
        //日志上报用户点击行为
        switch (data) {
            case '1':
                logInfo(`用户[点击]${this.data.model == this.data.model_select[2] ? '爬墙' : '清理'}`);
                break;
            case '2':
                if (input[6] == 3)
                    input[6] = 5
                else if (input[6] == 5)
                    input[6] = 8
                else if (input[6] == 8)
                    input[6] = 3
                else
                    input[6] = 5
                this.setData({
                    input
                })
                logInfo(`用户[点击]定时: ${input[6]}h`);
                break;
            case '3':
                logInfo("用户[点击]前进");
                break;
            case '5':
                logInfo("用户[点击]停止");
                break;
            case '7':
                logInfo("用户[点击]后退");
                break;
        }



        if (!this.data.isConnect)
            return showToast("请先连接蓝牙");

        buletoothManager.writeBLECharacteristicValue(data)
    },
    //用户点击左转和右转
    keepSendStr: async function (e) {
        //振动
        wx.vibrateShort({
            type: 'light'
        })
        if (!this.data.isConnect) {
            showToast("请先连接蓝牙")
            return
        }
        const sendData = e.target.dataset.str
        if (sendData == '4')
            logInfo('用户[点击]左转');
        else
            logInfo('用户[点击]右转');
        buletoothManager.startIntervalSendData(sendData, 200);



    },
    cancleSendStr: async function () {

        buletoothManager.startIntervalSendData(0);
        logInfo('结束触摸转向');
    },

    //发送输入的设置到硬件
    handleInput() {
        const {
            input,
            inputInd,
            isConnect
        } = this.data;
        if (!isConnect) {
            showToast("请先连接蓝牙")
            return
        }
        if (isNaN(parseInt(input[inputInd]))) {
            showToast("请输入正确数值")
            return
        }
        wx.setStorage({
            key: "input",
            data: input
        });
        const prefix = "f".charAt().charCodeAt() + parseInt(inputInd) - 1;
        let data = parseInt(input[inputInd])

        //安全时间需要除以10取整
        if (inputInd == 4) {
            if (data < 10) data = 1;
            else data /= 10;
        }

        data = parseInt(data)

        //console.log([prefix, data]);
        buletoothManager.writeBLECharacteristicValue([prefix, data])

        setTimeout(() => {
            if (input[inputInd] === this.data.input[inputInd]) {
                showToast('更改设置成功')
                this.hideModal()
            } else {
                showToast('更改设置失败')
            }
        }, 500)
    },

    //用户点击选择机型
    changeModel(e) {
        var data = parseInt(e.detail.value) + 1;
        logInfo(`用户[点击]选择机型, 更改机型为: [${this.data.model_select[data-1]}], index.changeModel`);
        let input = this.data.input;
        input[5] = data
        this.setData({
            input,
            inputInd: 5,
            model: this.data.model_select[data - 1]
        })

        //机型为3时不发数据
        this.handleInput();
    },

    //修改配置
    chageInput: function (value) {
        const {
            model,
            model_select
        } = this.data
        const inputInd = parseInt(this.data.inputInd),
            input = [...this.data.input];
        let errFlag = false;
        input[inputInd] = value
        //判断是否错误修改,输入汉字等
        if (!input[inputInd] && input[inputInd] != 0) {
            showToast("输入数据错误")
            return
        }
        if ((input[inputInd] > 100 && 1 == inputInd) ||
            (input[inputInd] < 0 && 1 == inputInd)) {
            showToast("左边电机转速范围: 0 ~ 100")
            errFlag = true
        }
        if (input[inputInd] > 100 && 3 == inputInd || input[inputInd] < 0 && 3 == inputInd) {
            showToast("右边电机转速范围: 0 ~ 100")
            errFlag = true
        }
        if (input[inputInd] > 100 && 2 == inputInd || input[inputInd] < 0 && 2 == inputInd) {
            if (model == model_select[2])
                showToast("爬墙时间范围: 0 ~ 100")
            else
                showToast("灵敏度范围: 0 ~ 100")
            errFlag = true
        }
        if (input[inputInd] > 1000 && 4 == inputInd || input[inputInd] < 1 && 4 == inputInd) {
            showToast("时间范围: 1 ~ 1000")
            errFlag = true
        }
        //记录修改的配置
        logInfo(`硬件配置更改, 安全时间: [${input[4]?input[4]:'无'}], 左电机转速: [${input[1]?input[1]:'无'}], 右电机转速: [${input[3]?input[3]:'无'}], 灵敏度: [${input[2]?input[2]:'无'}], 机型: [${input[5]?input[5]:'默认机型'}], 硬件配置数组: `, input)
        if (errFlag)
            return
        this.setData({
            input: [...input]
        });
    },
    changeAndHandleInput(e) {
        this.chageInput(parseInt(e.detail))
        this.handleInput()
    },
    //修改安全时间
    changeTime(e) {
        let {
            input
        } = this.data, index = e.currentTarget.dataset.i
        switch (input[4]) {
            case 3:
                input[4] = 5;
                break
            case 5:
                input[4] = 8;
                break;
            case 8:
                input[4] = 3;
                break;
            default:
                input[4] = 3
        }
        this.setData({
            input: [...input],
            inputInd: index
        })
        this.handleInput()

    },
    //弹窗栈 数组
    modalStack: [],
    getModalTop() {
        return this.modalStack[this.modalStack.length - 1]
    },
    //显示输入框
    showInput(e) {
        const index = e.currentTarget.dataset.i;
        let {
            inputPlaceholder,
            model,
            model_select
        } = this.data;
        //上报用户点击输入框按钮的行为
        switch (index) {
            case '1':
                inputPlaceholder = '输入左电机转速: 0-100'
                logInfo('用户[点击]设置左电机转速');
                break;
            case '2':
                if (model === model_select[2]) {
                    inputPlaceholder = '输入爬墙时间: 1-100'
                    logInfo('用户[点击]设置爬墙时间');
                } else {
                    inputPlaceholder = '输入灵敏度: 1-100'
                    logInfo('用户[点击]设置灵敏度');
                }
                break;
            case '3':
                inputPlaceholder = '输入右电机转速: 0-100'
                logInfo('用户[点击]设置右电机');
                break;
            case '4':

                inputPlaceholder = '请输入安全时间: 1-1000秒'
                logInfo('用户[点击]设置安全时间');


                break;
            case '5':
                inputPlaceholder = '请输入机型'
                logInfo('用户[点击]设置机型');
                break;


        }
        this.setData({
            isInput: true,
            inputInd: index,
            inputPlaceholder,
            modalProps: {
                isHidden: false,
                type: 'input',
                placeholder: inputPlaceholder,
                handleCancel: 'hideModal', //调用this.hideModal()
                handleSure: 'changeAndHandleInput', //调用this.changeAndHandleInput()
            }
        });
    },

    //隐藏当前modal,并显示下一个modal
    hideModal: function () {
        let prop = this.modalStack?.pop() || this.defauleModalProps || {}

        if (this.modalStack?.length) {
            prop = this.getModalTop()
            this.setData({
                modalProps: {
                    ...prop,
                    isHidden: false
                },
            })
        } else {
            this.setData({
                modalProps: {
                    ...prop,
                    isHidden: true
                }
            });
        }
    },
    //连接蓝牙和断开蓝牙
    deviceControl() {
        const {
            isConnect
        } = this.data
        if (isConnect) {
            //弹窗确认是否要断开连接
            this.showWarn('是否要断开连接?', {
                hideCancel: false,
                handleCancel: 'hideModal',
                handleSure: 'releaseBluetooth'
            })
        } else {
            this.chooseDevice()
        }

    },
    //断开蓝牙连接
    releaseBluetooth: function () {
        logInfo('用户[点击]释放蓝牙资源, index.releaseBluetooth')
        buletoothManager.relaseBluetoothAll()
        this.setData({
            isConnect: false
        });
        this.hideModal()
    },

    //下拉重连设备
    onPullDownRefresh: async function () {
        logInfo('用户[下拉]界面, index.onPullDownRefresh')
        const lastestConnecteddevice = this.data.lastestConnecteddevice,
            {
                deviceId
            } = lastestConnecteddevice;

        if (!deviceId) {
            showToast('未能连接设备')
            wx.stopPullDownRefresh();
            return
        }

        this.connectBLEDevice(lastestConnecteddevice, true)
        wx.stopPullDownRefresh();
    },
});
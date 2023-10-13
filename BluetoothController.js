const {
  deviceConfig,
  getDeviceConfig,
  hideOtherDevices,
  sendDataMeaning,
  sendInterval0,
  acceptData,
  acceptInterval,
  warningH,
  warningL,

} = require('./config/bluetooth')
const {
  ab2hex,
  ab2hexStr,
  resAndInfo,
  clearLocationStorage,
  setLocationStorage,
  setLatestDeviceStorage,
  ab2str



} = require('./utils/utils')
const {
  logInfo,
  logError,
  logWarn
} = require('./utils/log')


/**
 * BluetoothManager使用数据传递格式为: 
  return {
            res, //结果变量 一般为bool值
            msg, //结果信息 一般为字符串,用于补充说明结果变量的意义
            info, //结果对象 一般为对象,用于记录回调的成功或失败信息
            ...args //其他参数一般不使用
        }
 */

class BluetoothManager {
  constructor(phoneModel) {
    //该手机的型号
    this.phoneModel = phoneModel;
    //设备的显示名称和本地名称和名称
    this.deviceName = '',
      this.deviceLocalName = '',
      this.name = ''

    //设备id,要使用的服务号及特征值id
    this.deviceId = '',
      this.read = {
        characteristicId: '',
        serviceId: '',
      },
      this.write = {
        characteristicId: '',
        serviceId: '',
      }



    //定时发送数据的id
    this.sendIntervalId = '',
      //蓝牙设备服务号和其对应的特征值
      this.servicesAndCharacteristics = new Map()

    //记录发送数据的个数和错误次数,错误原因
    this.logSendData = new Map(),
      //定时上报发送数据日志的id
      this.logSendDataId = '',
      //定时上报日志的间隔时间5000ms,和最大间隔时间
      this.logSendDataInterval = 5000,
      this.logSendDataMaxInterval = 20000,
      //记录日志的输出次数
      this.logSendDataTimes = 0,


      //是否开启发现附近蓝牙设备wx.startBluetoothDevicesDiscovery
      this.isStartBluetoothDevicesDiscovery = false,
      //是否开启更新蓝牙设备列表
      this.onUpdateBluetoothDevice = false,
      //是否开启监听蓝牙适配器的改变
      this.isBluetoothAdapterStateChange = false,
      //是否已经与硬件设备监理连接
      this.isCreateBLEConnection = false,
      //是否监听蓝牙发送数据
      this.isCharacteristicChange = false,
      //监听蓝牙发送数据函数句柄,用于清除监听器
      this.valueChangeListener = null,
      //是否开启监听蓝牙设备的连接改变
      this.isOnBLEConnectionStateChange = false
  }

  /**
   * 
   * @param {*} device device: {deviceName:'',deviceId:''}
   * @param {*} reconnect     reconnect为true表示重连上次设备为false表示此次连接新设备
   * @param {*} BLEStateChangeCallback 监听蓝牙连接变化的回调函数
   * @param {*} time     定时发送0
   */

  initConnect(device = {}, reconnect = false, BLEStateChangeCallback, BLEValueChangeCallback, time = sendInterval0) {
    const self = this
    return new Promise(async (resolve, reject) => {
      //开始连接设备前先清除已有连接
      if (this.isCreateBLEConnection && this.deviceId)
        await this.closeBLE()
      //初始化配置
      self.deviceId = device.deviceId
      self.deviceName = device.deviceName
      self.deviceLocalName = device.localName
      self.name = device.name
      let config = getDeviceConfig(device)
      self.write = config.write
      self.read = config.read
      logInfo(`${reconnect?'重连上次设备':'连接新设备' }名称: [${self.deviceName}], 设备显示名称: [${self.name}], 设备MAC地址: [${self.deviceId}], 设备读: `, self.read, '设备写: ', self.write)


      //开始连接设备
      const isConnected = await this.connectBLEAndListenStateChange(BLEStateChangeCallback.bind(this))
      //console.log(isConnected)

      if (isConnected.res) {
        const deviceInfo = this.getConnectedBLEInfo()
        setLatestDeviceStorage(deviceInfo)
        //设置上次连接设备
        logWarn(`连接设备[${self.deviceName}]成功, 设备显示名称: ${self.name}, 设备本地名称 ${self.deviceLocalName}, 设备MAC地址: ${self.deviceId}, 设备读: `, self.read, '设备写: ', self.write, '设备详细信息: ', deviceInfo, '连接结果: ', isConnected)

      } else {
        logError(`连接设备[${self.deviceName}]失败, 设备显示名称: ${self.name},  设备本地名称 ${self.deviceLocalName}, 设备MAC地址: ${self.deviceId}, 设备读:`, self.read, '设备写:', self.write, '连接失败信息: ', isConnected)
        return resolve(resAndInfo(false, isConnected, isConnected.msg))
      }

      /**
       * 查询服务号和特征值
       * 如果是已经连接过的可以直接传入device相关参数进行连接
       * 未连接的通过点击连接后传入device进行连接
       */
      this.clearServicesAndCharacteristics()
      //安卓端可以不需要获取服务号就发数据,但是ios需要先拿服务号和特征值
      //if(this.phoneModle.include("ios"))//单独分机型处理
      const serviceAndCharacteristic = await this.getBLEServiceToCharacteristics()
      //未能成功获取特征值和服务号
      if (!serviceAndCharacteristic.res) {
        logInfo(serviceAndCharacteristic.msg, serviceAndCharacteristic)
        return resolve(resAndInfo(false, serviceAndCharacteristic, serviceAndCharacteristic.msg))
      }
      //成功获取到服务号和特征值
      logInfo(`成功获取写服务号: [${this.write.serviceId}] 和其对应特征值: [${serviceAndCharacteristic.info.characteristics.characteristics[0].uuid}]`, serviceAndCharacteristic)

      //启动持续发送0
      this.startIntervalSendData(0, time)
      //logInfo(`开始定时发送: [0], 定时器id: [${this.sendIntervalId}]`)

      //监听值改变
      this.notifyBLEValueChange(BLEValueChangeCallback.bind(this))

      //启动日志记录
      this.logToService()
      logInfo(`启动日志记录,定时器id: [${this.logSendDataId}], 定时时间: [${this.logSendDataInterval}ms]`)
      resolve(resAndInfo(true, {}, "设置定时器为： ", this.sendIntervalId))
    })

  }

  //检测蓝牙适配器是否打开
  isBluetoothAdapterOpen() {
    return new Promise((resolve, reject) => {
      wx.openBluetoothAdapter({
        success: function (res) {
          return resolve(resAndInfo(true, res, '蓝牙正常打开'));
        },
        fail: function (err) {
          return resolve(resAndInfo(false, err, '蓝牙未正常打开'));
        }
      })
    })
  }

  //检测位置信息是否打开
  isAllowGettingLocation() {
    return new Promise((resolve, reject) => {
      // todo change!!!
      return resolve(resAndInfo(true, {}, '地理位置已经禁用,默认返回ok'))
      wx.getSetting({
        success: (res) => {
          //成功获取到小程序的设置
          if (res.authSetting && res.authSetting["scope.address"] == true) {
            //尝试查看是否开启了位置信息
            wx.getLocation({
              type: "wgs84",
              altitude: !1,
              success: function (res) {
                setLocationStorage(res)
                return resolve(resAndInfo(true, res))

              },
              fail: function (err) {
                //超出接口调用次数限制默认返回ok
                //频繁调用会增加电量损耗说明不久前调用过,已经成功获取了位置信息,得出位置信息是打开的
                if (err.errMsg.includes('频繁调用会增加电量损耗'))
                  return resolve(resAndInfo(true, err))
                else { //已经取得定位权限但获取定位失败

                  clearLocationStorage()
                  return resolve(resAndInfo(false, err, "小程序取得位置授权但尝试使用位置信息失败"))
                }

              }
            });
          } else
            return resolve(resAndInfo(false, res.authSetting, "未取得位置授权"))
        },
        fail: (err) => {
          return resolve(resAndInfo(false, err, "获取权限设置失败"))
        }
      })
    })

  }

  //检测蓝牙和位置信息是否正常打开
  async isBuletoothAndLocationPrepared() {
    let bluetoothPrepared = await this.isBluetoothAdapterOpen();
    let locationPrepared = await this.isAllowGettingLocation();

    if (bluetoothPrepared.res && locationPrepared.res)
      return resAndInfo(true, {
        "bluetoothPrepared": bluetoothPrepared.info,
        "locationPrepared": locationPrepared.info
      }, "蓝牙与位置信息正常开启")

    //蓝牙正常开启位置信息未开启
    if (bluetoothPrepared.res)

      return resAndInfo(false, {
        "bluetoothPrepared": bluetoothPrepared.info,
        "locationPrepared": locationPrepared.info
      }, "位置信息未正常开启")


    //位置信息开启蓝牙未开启
    if (locationPrepared.res)
      return resAndInfo(false, {
        "bluetoothPrepared": bluetoothPrepared.info,
        "locationPrepared": locationPrepared.info
      }, "蓝牙未正常开启")

    //位置信息和蓝牙都未开启
    return resAndInfo(false, {
      "bluetoothPrepared": bluetoothPrepared.info,
      "locationPrepared": locationPrepared.info
    }, "蓝牙和位置信息未开启")
  }

  //开始搜索附近蓝牙设备
  startSearchBluetoothDeviceAround() {
    const self = this
    return new Promise((resolve, reject) => {
      if (self.isStartBluetoothDevicesDiscovery)
        return resolve(true, {}, '已开始搜索附近蓝牙设备')

      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: true, //是否允许重复上报同一设备。如果允许重复上报，则 wx.onBlueToothDeviceFound 方法会多次上报同一设备，但是 RSSI 值会有不同。
        success: function (res) {
          self.isStartBluetoothDevicesDiscovery = true
          resolve(resAndInfo(true, {
            'startBluetoothDevicesDiscovery_success': res
          }, 'startBluetoothDevicesDiscovery成功'))
        },
        fail: function (err) {
          resolve(resAndInfo(false, {
            'startBluetoothDevicesDiscovery_error': err
          }, 'startBluetoothDevicesDiscovery失败'))
        }
      });
    })
  }

  //停止搜索附近蓝牙设备
  stopSearchBluetoothDevicesAround() {
    const self = this
    return new Promise((resolve, reject) => {
      wx.stopBluetoothDevicesDiscovery({
        success: function (res) {
          self.isStartBluetoothDevicesDiscovery = false
          return resolve(resAndInfo(true, {
            'stopBluetoothDevicesDiscovery_success': res
          }, 'stopBluetoothDevicesDiscovery成功'))
        },
        fail: function (err) {
          return resolve(resAndInfo(false, {
            'stopBluetoothDevicesDiscovery_error': err
          }, 'stopBluetoothDevicesDiscovery失败'))
        }
      })

    })

  }

  //回调函数用于更新外部的设备列表
  startUpdateSearchBluetoothDeviceAround(callback, ishideOtherDevices) {
    ishideOtherDevices = ishideOtherDevices || hideOtherDevices
    if (this.onUpdateBluetoothDevice)
      return true
    const self = this
    //清除设备列表
    wx.onBluetoothDeviceFound(function (e) {
      self.onUpdateBluetoothDevice = true
      if (ishideOtherDevices) {
        //隐藏其他设备
        if (deviceConfig.get(e.devices[0].name)) {
          //console.log('是吸污机',e);
          typeof (callback) == "function" && callback(e.devices[0])
        }
        //console.log("已隐藏: ",e)

      } else {
        //console.log("未隐藏: ",e);
        typeof (callback) == "function" && callback(e.devices[0])
      }




    });
  }

  //停止更新设备列表
  stopUpdateSearchBluetoothDeviceAround() {
    const self = this
    return new Promise((resolve, reject) => {
      wx.offBluetoothDeviceFound()
      self.onUpdateBluetoothDevice = false
      resolve(resAndInfo(true, {
        'offBluetoothDeviceFound_success': 'stopUpdateSearchBluetoothDeviceAround ok'
      }, '已停止更新设备列表并清除所有回调函数'))
    })

  }

  //搜索附近设备并更新设备列表
  async startSearchAndUpdateBluetoothDevice(callback) {


    const startSearchPrepared = await this.startSearchBluetoothDeviceAround()

    if (startSearchPrepared.res) {
      this.startUpdateSearchBluetoothDeviceAround(callback)
      return resAndInfo(true, {
        'startSearchBluetoothDeviceAround_success': startSearchPrepared
      }, "启用搜索附近蓝牙设备成功 ")
    } else
      return resAndInfo(false, {
        'startSearchBluetoothDeviceAround_error': startSearchPrepared
      }, '启用搜索附近蓝牙设备失败')
  }

  //停止搜索和更新设备列表
  async stopSearchAndUpdateBluetoothDevice() {
    //更新设备在调用后是必停止的
    const stopSearch = await this.stopSearchBluetoothDevicesAround()
    const stopUpdate = await this.stopUpdateSearchBluetoothDeviceAround()


    //更新和搜索都停止
    if (stopUpdate.res && stopSearch.res)
      return resAndInfo(true, {
        stopUpdateDeviceList: stopUpdate,
        stopSearchDevice: stopSearch
      }, "已停止搜索和更新设备")


    //发现设备停止但更新未停止
    if (stopUpdate.res)
      return resAndInfo(false, {
        stopUpdateDeviceList: stopUpdate,
        stopSearchDevice: stopSearch
      }, "已停止更新设备,但搜索设备未停止")


  }

  //连接蓝牙
  connectBLE(deviceId = this.deviceId, timeout = 5000) {
    const self = this
    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId,
        timeout,
        success: (res) => {
          //console.log(res); //test
          //todo 第一次下拉时自动重连可以正常触发resolve
          //第二次无法触发resolve
          self.isCreateBLEConnection = true;

          return resolve(resAndInfo(true, {
            'createBLEConnection_success': res
          }, '连接成功'))
        },
        fail: (err) => {
          //console.log(err);//test
          if (err.errCode == -1) {
            self.isCreateBLEConnection = true;
            return resolve(resAndInfo(true, {
              'createBLEConnection_success': err
            }, "蓝牙已连接"))
          } else {
            return resolve(resAndInfo(false, {
              'createBLEConnection_error': err
            }, "蓝牙连接超时"))
          }
        }
      });

    })

  }

  //关闭与设备的连接
  closeBLE(deviceId = this.deviceId) {
    const self = this
    return new Promise((resolve, reject) => {
      wx.closeBLEConnection({
        deviceId,
        success(res) {
          return resolve(resAndInfo(true, {
            'closeBLEConnection_success': res
          }, '成功关闭连接'))
        },
        fail(err) {
          return resolve(resAndInfo(false, {
            'closeBLEConnection_error': err
          }, "未能成功关闭连接"))
        }
      })
    })
  }
  /**
   * 避免连接出现故障,当连接成功后,蓝牙掉线可以使用此回调函数保持蓝牙设备的连接
   * 监听听蓝牙设备连接状态的回调参数为device对象 device:{connected:false,deviceId:'....'} 
   */
  async keepBLEConnectionCallback(device) {
    //console.log('keepBLEConnectionCallback: ', device);//debug
    if (device.connected) //已经连接上蓝牙了
      return
    //当断开连接时重新连接
    await this.closeBLE(device.deviceId)
    this.connectBLE(device.deviceId)
  }

  //监听已连接的蓝牙状态改变
  startListenBLEConnectionStateChange(callback) {
    if (this.onBLEConnectionStateChange)
      return
    const self = this
    wx.onBLEConnectionStateChange(function (e) {
      self.isOnBLEConnectionStateChange = true
      typeof (callback) == "function" && callback(e)
    })

  }

  //连接蓝牙并监听蓝牙状态改变,回调函数用于监听蓝牙断开的情况
  async connectBLEAndListenStateChange(callback, deviceId) {

    const connected = await this.connectBLE(deviceId)
    if (connected.res) {
      this.startListenBLEConnectionStateChange(callback)
      return resAndInfo(true, {
        'connectBLE_success': connected
      }, connected.msg)
    } else
      return resAndInfo(false, {
        'connectBLE_error': connected
      }, connected.msg)

  }

  //获取连接设备的信息
  getConnectedBLEInfo(services) {
    const {
      deviceId,
      deviceName,
      deviceLocalName,
      name,
      phoneModel,
      read,
      write,
    } = this
    return {
      deviceId,
      deviceName,
      deviceLocalName,
      name,
      phoneModel,
      read,
      write,
    }

  }


  //停止监听蓝牙状态改变
  stopBLEConnectionStateChange() {

  }

  //删除服务号和特征值用于重新赋值
  clearServicesAndCharacteristics() {
    this.servicesAndCharacteristics = new Map()
  }

  //获取硬件设备的服务号
  getBLEDeviceServices(deviceId) {
    const self = this
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({
        deviceId: deviceId || self.deviceId,
        success: function (res) {
          //console.log(res); //test
          for (let r = 0; r < res.services.length; r++)
            self.servicesAndCharacteristics.set(res.services[r].uuid, '');
          resolve(resAndInfo(true, res))

        },
        fail: function (err) {
          resolve(false, err)
        }
      });

    })

  }

  //获取硬件设备的特征值
  getBLEDeviceCharacteristics(deviceId = this.deviceId, serviceId = this.write.serviceId) {
    const self = this
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: function (res) {
          self.servicesAndCharacteristics.set(serviceId, res.characteristics);
          resolve(resAndInfo(true, res))
        },
        fail: function (err) {
          resolve(resAndInfo(false, err))
        }
      });
    })
  }

  //仅获取当前首发数据的服务号和特征值
  async getBLEServiceToCharacteristics() {
    let servicesId = await this.getBLEDeviceServices()
    let characteristicsId = await this.getBLEDeviceCharacteristics()
    //发送数据前要先获取服务号和特征值
    if (servicesId.res && characteristicsId.res)
      return resAndInfo(true, {
        services: servicesId.info,
        characteristics: characteristicsId.info
      }, "成功获取服务号和特征值")
    //有服务号但是没有获取到特征值
    if (servicesId.res)
      return resAndInfo(false, {
        services: servicesId.info,
        characteristics: characteristicsId.info
      }, "未能获取特征值")
    //通过已有的服务号获取到发送数据需要的特征值,此做法不一定能发数据
    if (characteristicsId.res)
      return resAndInfo(false, {
        services: servicesId.info,
        characteristics: characteristicsId.info
      }, "未能获取服务号")
  }

  //订阅蓝牙设备发送数据的特征值
  async notifyBLECharacteristicValueChange(deviceId = this.deviceId, serviceId = this.read.serviceId, characteristicId = this.read.characteristicId) {
    return new Promise((resolve, reject) => {
      wx.notifyBLECharacteristicValueChange({
        //读的deviceid
        characteristicId,
        deviceId,
        serviceId,
        state: true,
        success: (res) => {
          return resolve(resAndInfo(true, res, '监听特征值改变成功'))
        },
        fail: (err) => {
          return resolve(resAndInfo(false, err, '监听特征值改变失败'))
        }
      })
    })
  }
  //监听蓝牙值的改变
  onBLECharacteristicValueChange(callback) {
    this.isCharacteristicChange = true
    if (this.valueChangeListener)
      wx.offBLECharacteristicValueChange(this.valueChangeListener)
    this.valueChangeListener = callback
    return wx.onBLECharacteristicValueChange(callback)
  }

  //订阅并监听蓝牙值改变并处理
  async notifyBLEValueChange(callback) {
    const notify = await this.notifyBLECharacteristicValueChange()
    if (notify.res) {
      this.onBLECharacteristicValueChange((res) => {
        //res.vaule是一个array budffer
        // logInfo('onBLECharacteristicValueChange: ', ab2hex(res.value), typeof callback === 'function', callback)
        typeof (callback) === 'function' && callback(res.value)
      })
      return resAndInfo(true, notify, notify.msg)
    } else return resAndInfo(false, notify, notify.msg)
  }

  //获取每个服务号对应的特征值
  async getBLEServiceToCharacteristicsAll() {
    const self = this,
      getCharacteristicTask = [],

      fn = async (value, key, map) => {
        await self.getBLEDeviceCharacteristics(self.deviceId, key)
      }
    // console.log("开始: ", Object.fromEntries(this.servicesAndCharacteristics.entries()));//test
    this.servicesAndCharacteristics.forEach(async (value, key, map) => {
      getCharacteristicTask.push(fn(value, key, map))
    })
    await Promise.all(getCharacteristicTask);
    return resAndInfo(true, Object.fromEntries(this.servicesAndCharacteristics.entries()), "获取所有的服务号和特征值成功")
  }

  //发送单个数据
  writeBLECharacteristicValue(data, deviceId = this.deviceId, serviceId = this.write.serviceId, characteristicId = this.write.characteristicId) {
    const self = this
    return new Promise((resolve, reject) => {

      let length = data.length || String(data).length,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer);
      if (data instanceof Array) {
        for (let i = 0; i < data.length; i++)
          view.setUint8(i, parseInt(data[i]))
      } else
        for (let i = 0; i < data.length; i++)
          view.setUint8(i, data.charAt(i).charCodeAt());
      //     logInfo('数据缓冲DataView: ',view,'ArrayBuffer字节大小: ',buffer.byteLength);
      //     logInfo('ArrayBuffer如下:');
      //     logInfo(buffer);
      //     logInfo( 'deviceId:', o||  v.deviceId );

      //    logInfo( "serviceId:" ,i || v.serviceId,);
      //   logInfo( "characteristicId:", c || v.characteristicId,);

      wx.writeBLECharacteristicValue({
        deviceId,
        serviceId,
        characteristicId,
        // writeType: 'writeNoResponse',
        value: buffer,
        success: function (res) {
          //  console.log('succ: ',res);
          //console.log(data[0]);

          self.logSendDataInfo(data, true, res)
          resolve(resAndInfo(true, res))
        },
        fail: async function (err) {
          // console.log('err: ',err);

          self.logSendDataInfo(data, false, err)
          resolve(resAndInfo(false, err))

        }
      });
    })
  }
  //定时上报后台的函数
  //将本地的记录发送的数据上报后台
  logToService(intervalTime) {
    const self = this
    if (this.sendIntervalId)
      this.stopLogToService()
    if (!intervalTime) //初始化为默认时间
      intervalTime = this.logSendDataInterval
    if (this.logSendDataId == null)
      this.logSendDataId = setInterval(() => {
        self.logSendDataTimes += 1; //记录日志上报次数

        // Object.fromEntries(this.logSendData.entries())将map转对象是为了手机开发调试也能看到
        let logSendDataObject = Object.fromEntries(this.logSendData.entries()),
          modelStr = `蓝牙传输数据上报[${self.logSendDataTimes}], 定时时间: [${intervalTime}ms] `

        //console.log(logSendDataObject); //test
        Object.keys(logSendDataObject).forEach(key => {
          modelStr += `-发送数据: [${key}], 含义: [${logSendDataObject[key].meaning}], ${logSendDataObject[key].isArray?'设置值: ['+logSendDataObject[key].lastSend[1]+'],':''} 成功次数: [${logSendDataObject[key].successTimes}], 失败次数: [${logSendDataObject[key].failTimes}], 失败原因: [${logSendDataObject[key].failInfo.errMsg?logSendDataObject[key].failInfo.errMsg:'无'}]`
        })

        logInfo(modelStr, logSendDataObject)
        if (self.logSendDataTimes % 5 == 0 && intervalTime < self.logSendDataMaxInterval)
          self.logToService(intervalTime * 2)

      }, intervalTime)

  }

  //停止日志记录
  stopLogToService() {
    clearInterval(this.logSendDataId)
    this.logSendDataId = null
  }

  //记录发送数据过程
  logSendDataInfo(data, succ, info) {
    //flag记录是否发送的是数组

    const flag = data instanceof Array,
      tag = flag ? String(data[0]) : String(data),
      logCount = this.logSendData.get(tag)
    //console.log(data);
    let successTimes = 0,
      successInfo = {},
      failTimes = 0,
      failInfo = {},
      meaning = logCount ? logCount.meaning : '',
      isArray = flag,
      lastSend = data
    if (!logCount) {
      //首次记录发送该数据
      meaning = sendDataMeaning.get(tag)
      succ ? (successTimes = 1, successInfo = info) : (failTimes = 1, failInfo = info)
    } else
      succ ? (successTimes = logCount.successTimes + 1, failTimes = logCount.failTimes, successInfo = info, failInfo = logCount.failInfo) :
      (successTimes = logCount.successTimes, failTimes = logCount.failTimes + 1, failInfo = info, successInfo = logCount, successInfo)

    //创建日志数据
    this.logSendData.set(tag, {
      successTimes,
      failTimes,
      successInfo,
      failInfo,
      meaning,
      isArray,
      lastSend,
    })
  }

  //释放蓝牙资源
  relaseBluetoothAll() {
    const self = this;
    //取消定时发送
    this.stopIntervalSendData()

    //关闭设备列表的更新
    if (this.onUpdateBluetoothDevice) {
      this.stopUpdateSearchBluetoothDeviceAround()
      this.onUpdateBluetoothDevice = false
    }

    //关闭搜索附近设备
    if (this.isStartBluetoothDevicesDiscovery) {
      this.stopSearchBluetoothDevicesAround()
      this.isStartBluetoothDevicesDiscovery = false
    }

    //关闭与蓝牙设备的连接
    if (this.isCreateBLEConnection) {
      wx.closeBLEConnection({
        deviceId: self.deviceId
      }).catch(e => console.log("释放资源BluetoothController.relaseBluetoothAll:", e))
      this.isCreateBLEConnection = false
    }

    //关闭监听蓝牙状态改变
    //蓝牙状态的改变需要放在后面关闭,需要让其执行一次断开连接的回调
    if (this.isOnBLEConnectionStateChange) {
      wx.offBLEConnectionStateChange()
      this.isOnBLEConnectionStateChange = false
    }
    if (this.isCharacteristicChange) {
      wx.offBLECharacteristicValueChange()
    }


    //关闭监听蓝牙适配器
    if (this.isBluetoothAdapterStateChange) {
      wx.offBluetoothAdapterStateChange()
      this.isOnBLEConnectionStateChange = false
    }

    //清除设备服务号和特征值列表
    this.clearServicesAndCharacteristics()

    //关闭已经初始化的蓝牙适配器
    wx.closeBluetoothAdapter()

    //停止日志记录
    this.stopLogToService()
  }

  //开始持续发送数据
  async startIntervalSendData(data, time = 200) {
    if (this.sendIntervalId != null)
      this.stopIntervalSendData()
    const self = this
    if (this.sendIntervalId == null) {
      this.sendIntervalId = setInterval(() => {
        //console.log("定时发送数据成功启动", this.sendIntervalId);
        self.writeBLECharacteristicValue(data)
      }, time)
      return this.sendIntervalId
    }
    return null

  }

  //停止持续发送数据
  stopIntervalSendData() {

    clearInterval(this.sendIntervalId)
    this.sendIntervalId = null

  }
}
module.exports = {
  BluetoothManager: BluetoothManager,
}
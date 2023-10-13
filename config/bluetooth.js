/**
 * 这两个常量导入即是没有使用也不要删
 * 写蓝牙配置时,当没有告知读写的特征值或者服务号的id时使用此常量进行占位,可以在调试时发现问题
 * */
const {
  logInfo
} = require('../utils/log')
const {
  NEED_CHARACTER_ID,
  NEED_SERVICE_ID
} = require('./const')
//测试使用的蓝牙配置信息
const testDeviceConfig = {
  //测试设备的蓝牙硬件的名称
  name: 'test_device',
  read: {
    serviceId: '' || NEED_SERVICE_ID,
    characteristicId: '' || NEED_CHARACTER_ID,
  },
  write: {
    serviceId: "0000FF10-0000-1000-8000-00805F9B34FB",
    characteristicId: "0000FF12-0000-1000-8000-00805F9B34FB",
  }

}

//蓝牙配置列表
const
  /**
   * 当新增设备时 !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
   * 都是更新在数组的末尾!!!!!!!!!!!!
   * 不同设备的配置信息
   * 新加的设备配置加到数组device_config末尾
   * 蓝牙设备使用哪个配置通过deviceConfig.get('蓝牙设备的硬件名称')获取
   * map初始化传入二维数组
   */
  deviceConfig = new Map([
    //新增的设备配置按照[key,value]的形式
    //key为蓝牙设备的名称,value为蓝牙设备的使用配置
    //默认设备
    ["default",
      {
        name: 'default',
        read: {
          serviceId: '0000FFF0-0000-1000-8000-00805F9B34FB',
          characteristicId: '0000FFF1-0000-1000-8000-00805F9B34FB'
        },
        write: {
          serviceId: "0000FFF0-0000-1000-8000-00805F9B34FB",
          characteristicId: "0000FFF2-0000-1000-8000-00805F9B34FB"
        }
      }
    ],
    //测试使用设备
    [testDeviceConfig.name,
      {
        name: testDeviceConfig.name,
        ...testDeviceConfig,
      }
    ],
    //此后为厂商自定义的设备
    ["XWJv2",
      {
        name: "XWJv2",
        read: {
          serviceId: '0000FFF0-0000-1000-8000-00805F9B34FB',
          characteristicId: '0000FFF1-0000-1000-8000-00805F9B34FB'
        },
        write: {
          serviceId: "0000FFF0-0000-1000-8000-00805F9B34FB",
          characteristicId: "0000FFF2-0000-1000-8000-00805F9B34FB"
        }
      }
    ],
    ["XWJv3",
      {
        name: "XWJv3",
        read: {
          serviceId: '0000FFF0-0000-1000-8000-00805F9B34FB',
          characteristicId: '0000FFF1-0000-1000-8000-00805F9B34FB'
        },
        write: {
          serviceId: "0000FFF0-0000-1000-8000-00805F9B34FB",
          characteristicId: "0000FFF2-0000-1000-8000-00805F9B34FB"
        }
      }
    ],
  ]),
  //获取设备对应的配置信息
  getDeviceConfig = (device) => {
    if (device && device.name)
      return deviceConfig.get(device.name) || Object.assign(deviceConfig.get("default"), {
        name: device.name
      })
    return deviceConfig.get("default")
  },
  //是否隐藏除吸污机以外的其他设备
  version = wx.getAccountInfoSync().miniProgram.envVersion,
  hideOtherDevices = (version == 'develop') ? false : (version == 'trial') ? false : true,
  //发送数据的含义
  sendDataMeaning = new Map([
    ['0', '时序对齐'],
    ['1', '清理或爬墙'],
    ['2', '定时'],
    ['3', '前进'],
    ['4', '左转'],
    ['5', '停止'],
    ['6', '右转'],
    ['7', '后退'],
    ['102', '左电机'],
    ['103', '灵敏度或爬墙时间'],
    ['104', '右电机'],
    ['105', '安全时间'],
    ['106', '机型'],

  ]),

  /**
   * 接收数据的含义如以下object array 
   * 接收数据是一个数据包,长度为18个字节,类似数组
   * 数组的第0个元素是包头协商为0XEE,第17个元素为包尾为0XDD
   * object包含数组每个元素的描述信息(desc),值(value),校验规则(validator),等
   * */
  acceptData = [
    //indx: 0
    {
      desc: '包头',
      value: 0XEE,
    }, //接收数据包的包头: '0XEE'
    //index: 1
    {
      desc: '版本号',
      //主板的版本号 0-200
      validator: (value) => {
        return value >= 0 && value <= 200
      }
    },
    //index: 2
    {
      desc: '机型',
      //使用的机型
      validator: (value) => {
        return value >= 0 && value <= 10
      }
    },
    //index: 3
    {
      desc: '速度(左)',
      //硬件的速度
      validator: (value) => {
        return value >= 0 && value <= 100
      }
    },
    //index: 4
    {
      desc: '速度(右)',
      //硬件的速度
      validator: (value) => {
        return value >= 0 && value <= 100
      }
    },
    //index: 5
    {
      //硬件的电流
      desc: '电流(左)',
      validator: (value) => {
        return value >= 0 && value <= 100
      }
    },
    //index: 6
    {
      //硬件的电流
      desc: '电流(右)',
      validator: (value) => {
        return value >= 0 && value <= 100
      }
    },
    //index: 7
    {
      desc: '电流(泵)',
      validator: (value) => {
        return value >= 0 && value <= 100
      }
    },
    //index: 8
    {
      desc: '灵敏度',
      validator: (value) => {
        return value >= 0 && value <= 100
      }
    },
    //index: 9
    {
      desc: '安全时间',
      validator: (value) => {
        return value >= 0 && value <= 100
      }
    },
    //index: 10
    {
      desc: '报警位(H)',
    },
    //index: 11
    {
      desc: '报警位(L)',
    },
    //index: 12
    {
      //保留位置暂无功能
      desc: '保留位',
    },
    //index: 13
    {
      //保留位置暂无功能
      desc: '保留位',
    },
    //index: 14
    {
      //保留位置暂无功能
      desc: '保留位',
    },
    //index: 15
    {
      //保留位置暂无功能
      desc: '保留位',
    },
    //index: 16
    {
      //校验数据一致性
      desc: '校验位',
    },
    //index: 17
    {
      //数据包尾部
      desc: '包尾',
      value: 0XDD
    },
  ],
  //校验接收的数据
  isAcceptDataValid = (arr) => {
    if (arr[0] !== 0XEE) return false; //包头校验
    if (arr[17] !== 0XDD) return false; //包尾校验
    let check = 0x00;
    for (let i = 0; i < 16; i++) {
      check += arr[i] & 0XFF;
    }
    check &= 0XFF;
    if (check !== arr[16]) return false;
    if (arr[1] > 200) return false;
    if (arr[2] > 10) return false;
    if (arr[3] > 100) return false;
    if (arr[4] > 100) return false;
    if (arr[5] > 100) return false;
    if (arr[6] > 100) return false;
    if (arr[7] > 100) return false;
    if (arr[8] > 100) return false;
    if (arr[9] > 100) return false;
    return true
    // let flag = -2; //check位的flag定义为-1
    // if (arr[0] !== 0XEE) flag = 0; //包头校验
    // if (arr[17] !== 0XDD) flag = 17; //包尾校验
    // let check = 0x00;
    // for (let i = 0; i < 16; i++) {
    //   check += arr[i] & 0XFF;
    // }
    // check &= 0XFF;
    // logInfo('check: ', check)
    // if (check !== arr[16]) flag = 16;
    // if (arr[1] > 200) flag = 1;
    // if (arr[2] > 10) flag = 2;
    // if (arr[3] > 100) flag = 3;
    // if (arr[4] > 100) flag = 4;
    // if (arr[5] > 100) flag = 5;
    // if (arr[6] > 100) flag = 6;
    // if (arr[7] > 100) flag = 7;
    // if (arr[8] > 100) flag = 8;
    // if (arr[9] > 100) flag = 9;
    // logInfo('falg: ', flag)
    // return flag === -2
  }
//报警位H
warningH = ['继电器故障', 'can通讯故障', '泵电机欠流', '右电机欠流', '左电机欠流', '过滤系统满', '右电机过流', '左电机过流'],
  //报警位L
  warningL = ['', '', '', '', '', '', '陀螺仪故障', '蓝牙电源故障'],
  //定时发送0的时间(ms)
  sendInterval0 = 200,
  //定时接收主板报文时间(ms)
  acceptInterval = 500,
  //虽然主板是500ms发送报文,但可能存在粘包,因此最大发送时间应该是主板报文2倍以上
  acceptMAXInterval = 2.1 * acceptInterval,
  //主板ota升级的等待时间
  awaitInterval = 2000
//新增变量在上一个变量后加逗号,
//形式为 const v1 = ... ,v2 = ...,v3 = ..., ....

module.exports = {
  deviceConfig,
  getDeviceConfig,
  hideOtherDevices,
  sendDataMeaning,
  sendInterval0,
  acceptData,
  acceptInterval,
  warningH,
  warningL,
  isAcceptDataValid,
  acceptMAXInterval,
  awaitInterval,
}
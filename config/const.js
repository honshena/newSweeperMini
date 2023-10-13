//常量配置
module.exports = {
  /**
   * 微信位置信息读取所需常量: location
   * wx.setStorageSync('location', t)
   *  */
  LOCATION: 'location',
  /**
   * 硬件配置读取所需常量: location
   * wx.setStorageSync('input', t)
   *  */
  INPUTCONFIG: 'input',
  /**
   * 最近连接设备缓存所需常量: location
   * wx.setStorageSync('latestConnectedDevice', t)
   *  */
  LATESTCONNECTEDDEVICE: 'latestConnectedDevice',
  /**
   * 当设备为吸污机时显示设备名称为吸污机
   * 当设备不是吸污机时显示未知设备
   */
  DEVICENAME: '吸污机',
  UNKNOWNDEVICE: '未知设备',
  NEED_SERVICE_ID: '需要输入serviceId',
  NEED_CHARACTER_ID: '需要输入character id',
}
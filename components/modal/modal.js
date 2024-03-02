// components/modal/modal.js
const sysInfo = wx.getSystemInfoSync()
Component({
    // observers: {
    //     'isHidden': (value)=>{
    //         console.log('111',value)
    //     }
    // },
    /**
     * 组件的属性列表
     */
    properties: {
        isHidden: {
            type: Boolean,
        },
        type: {
            type: String,
            value: 'input'
        },
        placeholder: {
            type: String
        },
        hideCancel: {
            type: Boolean
        },
        okText: {
            type: null,
        },
        mask: {
            type: Boolean
        },
        openType: {
            type: String
        },
        cancelText: {
            type: null,
        },
        value : {
            type: null,
        }
    },

    /**
     * 组件的初始数据
     */
    data: {
        pageHeight: sysInfo.windowHeight,
        pageWidth: sysInfo.windowWidth,
        isInput: false,
    },
    //输入框的值
    inputValue: '',
    //防止多次点击
    isHandleSure: false,
    /**
     * 组件的方法列表
     */
    methods: {
        chageInput(e) {
            let value = e.detail.value || ''
            this.inputValue = value
        },
        inputFocus() {
            this.setData({
                isInput: true
            })
        },
        inputBlur() {
            this.setData({
                isInput: false
            })
        },
        handleAgreePrivacyAuthorization() {
            this.triggerEvent('handleAgreePrivacyAuthorization')
        },
        async handleSure() {
            //防止多次点击
            if (this.isHandleSure) return;
            this.isHandleSure = true
            try {
                await this.triggerEvent('handleSure', this.inputValue)
            } catch (e) {}
            this.isHandleSure = false
        },
        handleCancel() {
            this.triggerEvent('handleCancel')
        }
    }
})
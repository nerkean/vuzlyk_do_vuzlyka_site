const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderItemSchema = new Schema({
    productId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: { 
        type: Number,
        required: true
    },
    quantity: { 
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    image: { 
        type: String
    },

    customImageUrl: { 
        type: String
    },
    customizationDetails: {
        type: String
    }
}, { _id: false }); 

const orderSchema = new Schema({
    customerName: {
        type: String,
        required: [true, 'Ім\'я клієнта є обов\'язковим']
    },
    customerEmail: {
        type: String,
        required: [true, 'Email клієнта є обов\'язковим'],
    },
    customerPhone: {
        type: String,
        required: [true, 'Телефон клієнта є обов\'язковим']
    },

    shippingMethod: {
        type: String,
        required: [true, 'Спосіб доставки є обов\'язковим'],
        enum: ['np_branch', 'np_courier', 'ukrposhta', 'pickup'] 
    },
    shippingAddress: {
        fullName: { type: String, required: true }, 
        city: { type: String, required: true },
        addressLine1: { type: String }, 
        postalCode: { type: String }, 
        npWarehouse: { type: String }, 
        country: { type: String, default: 'Україна' }
    },

    items: [OrderItemSchema],

    subtotal: { 
        type: Number,
        required: true
    },
    totalAmount: { 
        type: Number,
        required: true
    },

    status: { 
        type: String,
        required: true,
        enum: ['Нове', 'В обробці', 'Очікує підтвердження', 'Відправлено', 'Доставлено', 'Скасовано'],
        default: 'Нове'
    },
    paymentMethod: {
        type: String,
        required: true,
        default: 'LiqPay'
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ['Очікує оплати', 'Оплачено', 'Помилка оплати', 'Повернено'],
        default: 'Очікує оплати'
    },
    paymentId: { 
        type: String
    },

    customerComment: {
        type: String
    },

}, { timestamps: true }); 

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
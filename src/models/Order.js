const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const orderSchema = new Schema({
user_id: Number,
username: String,
cart_id: String,
price: Number,
shipping : {
    city:String,
    street: String,
    date: Date
},
credit_card:Number
});
module.exports = mongoose.model('orders',orderSchema);
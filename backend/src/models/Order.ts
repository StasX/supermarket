import mongoose from 'mongoose';
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
export = mongoose.model('orders',orderSchema);

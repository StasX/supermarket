import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const orderSchema = new Schema({
  user_id: Number,
  username: String,
  cart_id: String,
  price: Number,
  shipping: {
    city: String,
    street: String,
    date: Date,
  },
  created_at: Date,
  products: [],
  invoiceKey: String,
  payment: {
    mode: String,
    method: String,
    last4: String,
  },
});
orderSchema.index(
  { cart_id: 1 },
  {
    unique: true,
    partialFilterExpression: { 'payment.mode': 'demo' },
    name: 'one_demo_order_per_cart',
  },
);
export = mongoose.model('orders', orderSchema);

import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const productSchema = new Schema({
  /*_id : {
        type : Number,
        sparce : true  
    },*/
  name: {
    type: String,
    unique: true,
  },
  category: String,
  price: Number,
  image: {
    type: String,
    unique: true,
  },
});
export = mongoose.model('products', productSchema);

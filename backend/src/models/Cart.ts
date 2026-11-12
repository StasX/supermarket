import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const cartSchema = new Schema({
    user_id : Number,
    products : [],
    created_at : Date,
    status: { 
        type : Number,
        default : 1 /* 1:  opepened. 0: closed */
    }
});

export = mongoose.model('carts', cartSchema);

const mongoose =  require('mongoose');
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

module.exports = mongoose.model('carts', cartSchema);
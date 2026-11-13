import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const cartSchema = new Schema({
    user_id : Number,
    products : [],
    created_at : Date,
    checkout: { type: Schema.Types.Mixed, default: undefined },
    status: { 
        type : Number,
        default : 1 /* 1:  opepened. 0: closed */
    }
});

cartSchema.index({ user_id: 1 }, {
    unique: true,
    partialFilterExpression: { status: 1 },
    name: 'one_open_cart_per_user',
});

export = mongoose.model('carts', cartSchema);

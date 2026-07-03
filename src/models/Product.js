const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const productSchema = new Schema({
    /*_id : {
        type : Number,
        sparce : true  
    },*/
    name : String,
    category : String,
    price : Number,
    image : {
        type : String,
        unique : true
    }
});
module.exports = mongoose.model("products",productSchema);
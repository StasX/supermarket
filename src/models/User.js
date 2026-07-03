const mongoose = require("mongoose");
const bcrypt = require('bcrypt-nodejs');
const Schema = mongoose.Schema;
const User = new Schema({
    id : {
        type : Number,
        unique : true,
    },
    name : {  
        first_name : String,
        last_name : String
    },
    username : {
        type : String,
        unique : true,
        required : true,
        trim : true    
    },
    
    password : {
        type : String,
        required : true
    },
    address : {
        city : String,
        street : String
    },
    role : {
        type : Number,
        default : 0 /* 0: regular user, 1: administrator */
    }
});
module.exports =  mongoose.model('users', User);
module.exports.signup = (newUser, callback) => {
    newUser.password = bcrypt.hashSync(newUser.password, bcrypt.genSaltSync(12));
    newUser.save(callback);
}
const jwt = require('jsonwebtoken');
const fs = require('fs');
const User = require('../models/User');
const path = require('path');

module.exports = ('/', (req, res, next) => {
    const token = req.cookies['SESSIONID'];
    if((token !== undefined) && fs.existsSync(path.join(__dirname, '/../key.pem'))){
        var key = fs.readFileSync(path.join(__dirname, '/../key.pem'));
        jwt.verify(token, key, function (err, user) {
            if(err) {
                res.json({success : false});
                throw err;
            }
            const exp = new Date(0);
            exp.setUTCMilliseconds(user.exp);
            const now = new Date(0);
            now.setUTCMilliseconds(Date.now());
            if(exp.getUTCDate >= now.getUTCDate){
                user = JSON.parse(user.data);
                User.find({
                    _id : user._id,
                    username : user.username,
                    password : user.password
                }, (err, users) => {
                    if(err){
                        res.json({success : false});
                        throw err;
                    } 
                    if(users.length === 1){  
                        req.user_data = users[0];
                        next();
                    }   else{
                        res.json({success : false});
                    }
                });
            }   else{
                res.json({success : false});
            }
        });
    }   else{
        res.json({success : false});
    }
});
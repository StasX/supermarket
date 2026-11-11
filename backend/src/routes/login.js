const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const router = require('express').Router();
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
router.post('/', (req, res, next) => {
    req.checkBody('username','invalid username').isEmail();
    req.checkBody('password','password length is not enought').isLength({min:8});
    let errors = req.validationErrors();
    if(errors){
        res.json({success:false});
    }   else{
        let user = req.body.username;
        const pass = req.body.password;
        User.find({'username' : user}, (err, users) => {
            if (err) {
                res.json({success:false});
                throw err;
            }   else {
                if(users.length !== 1) {
                    res.json({success:false}); 
                } else{
                    user = users[0];
                    
                    bcrypt.compare(pass, user.password , (err,result) => {
                    if (result) {
                        const keyPath = process.env.JWT_KEY_PATH || path.join(__dirname, '/../key.pem');
                        if(fs.existsSync(keyPath)){
                            const key = fs.readFileSync(keyPath, 'utf8');
                            const token = jwt.sign({
                                data:JSON.stringify(user)
                            }, key, {
                                expiresIn: '9h'
                            });
                            res.cookie('SESSIONID', token, {httpOnly : true, secure: false});
                        }   else{
                            console.log('private key not exists');
                        }
                        
                            const name = `${user.name.first_name} ${user.name.last_name}`;
                            
                            
                            res.json({success : true, role : user.role, name, user : user._id});
                        }else {
                            res.json({success : false});
                        }
                    });
                }  
            } 
        });
    }
});
module.exports = router;

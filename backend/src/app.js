require('./load-env.cjs');

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const User = require('./models/User');
const mongoose  = require('mongoose');
const expressValidator = require('express-validator');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shop');
mongoose.Promise = global.Promise;
mongoose.connection.on('error', (err) => {
    console.log(err);
    throw err;
})
const app  = express();
app.use(bodyParser()); 
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'src')));

app.use(expressValidator());

const login = require('./routes/login');
const signup = require('./routes/signup');
const logout = require('./routes/logout');
const addProduct = require('./routes/add-product');
const editProduct = require('./routes/edit-product');
const findProduct = require('./routes/find-product');
const getProductsByCategory = require('./routes/get-products-by-category');
const lastOrder = require('./routes/get-last-order');
const totalOrders = require('./routes/tototal-orders');
const totalProducts = require('./routes/tototal-products');
const getAllProducts = require('./routes/get-all-products');
const updateCart = require('./routes/update-cart');
const createCart = require('./routes/create-cart');
const getCart = require('./routes/get-cart');/* get active cart */

const reconect = require('./routes/reconect');

app.use('/login', login);
app.use('/logout', logout);
app.use('/sign-up', signup);
app.use('/add-product',addProduct);
app.use('/edit-product',editProduct);
app.use('/find-product',findProduct);
app.use('/get-products-by-category',getProductsByCategory);
app.use('/get-last-order',lastOrder);
app.use('/total-orders', totalOrders);
app.use('/total-products', totalProducts);
app.use('/get-all-products', getAllProducts);
app.use('/create-cart', createCart);
app.use('/update-cart', updateCart);
app.use('/get-cart',getCart);
app.use('/reconect', reconect);
  
const port = process.env.PORT || 3000;
onError = (error) => {
    console.error(error);
      throw error;
}
app.listen(port);

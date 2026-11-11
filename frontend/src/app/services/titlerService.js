"use strict";
app.service("titlerService", function(){
    this.state = function(url){
        var title;
        switch(url){
            case '/login' : {
                title = 'Login to Dragon shop';
                break;
            }   case '/sign-up' : {
                title = 'Sign up to Dragon shop';
                break;
            }   case '/about' : {
                title = 'About us';
                break;
            }   case '/info' : {
                title = 'Info';
                break;
            }   case '/welcome' : {
                title = 'Welcome to Dragon shop';
                break;
            }   case '/order' : {
                title = 'Order';
                break;
            }   case '/management' : {
                title = 'Product manager';
                break;
            }   default : {
                title = 'Dragon shop';
            }
        }
        $('title')[0].text = title;
    }
});

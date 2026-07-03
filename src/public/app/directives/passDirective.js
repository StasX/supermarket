app.directive('passDirective',function(){
    return {
        require: 'ngModel',
        link: function (scope, el, attr, mCtrl){
            function passValidation(value){
                mCtrl.$setValidity('pass', (value.length >= 8));
                return value;
            }
            mCtrl.$parsers.push(passValidation);
        }
    };
});
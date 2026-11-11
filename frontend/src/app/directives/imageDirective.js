app.directive('imageDirective',function(){
    return {
        require: 'ngModel',
        link: function (scope, el, attr, mCtrl){
            function imageValidation(value){
                mCtrl.$setValidity('productImage', /^(http(s?)\:\/\/)(([0-9a-z])*([.-]?([0-9a-z])*)*(\.)([a-z]){2}([a-z])*(\/))([/.%:@&\w_,'"-]|\(|\)|\[|\])*(\.(jpg|gif|png))$/.test(value));
                return value;
            }
            mCtrl.$parsers.push(imageValidation);
        }
    };
});

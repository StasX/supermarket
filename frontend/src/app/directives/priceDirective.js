app.directive('priceDirective',function(){
    return {
        require: 'ngModel',
        link: function (scope, el, attr, mCtrl){
            function priceValidation(value){
                mCtrl.$setValidity('price', /^\d+(\.)\d{2}$/.test(value));
                return value;
            }
            mCtrl.$parsers.push(priceValidation);
        }
    };
});

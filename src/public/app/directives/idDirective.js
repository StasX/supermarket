app.directive('idDirective',function(){
    return {
        require: 'ngModel',
        link: function (scope, el, attr, mCtrl){
            function idValidation(value){
                mCtrl.$setValidity('id', /^\d{9}$/.test(value));
                return value;
            }
            mCtrl.$parsers.push(idValidation);
        }
    };
});
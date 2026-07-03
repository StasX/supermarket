app.directive('confirmDirective',function(){
    return {
        require: 'ngModel',
        link: function ($scope, el, attr, mCtrl){
            function passConfirmValidation(value){
                mCtrl.$setValidity('passConfirm', ($scope.$parent.form.pass.$modelValue === value));
                return value;
            }
            mCtrl.$parsers.push(passConfirmValidation);
        }
    };
});
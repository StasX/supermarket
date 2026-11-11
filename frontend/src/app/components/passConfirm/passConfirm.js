app.component("passConfirm", {
    bindings: {
        className: "<"
    },
    templateUrl: '/app/components/passConfirm/passConfirm.html',
    controller: function($scope){
        $scope.className = "fa fa-info-circle";
        $scope.blur = function(){
            if($scope.$parent.form.passConfirm.$dirty){
                $scope.className = ($scope.$parent.form.passConfirm.$valid) ? "fa fa-check" : "fa fa-times";
            }
        }
    }
});

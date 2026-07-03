app.component("aPass", {
    bindings: {
        className: "<"
    },
    templateUrl: '/app/components/aPass/aPass.html',
    controller: function($scope){
        $scope.className = "fa fa-info-circle";
        $scope.blur = function(){
            if($scope.$parent.form.pass.$dirty){
                $scope.className = ($scope.$parent.form.pass.$valid) ? "fa fa-check" : "fa fa-times";
            }
        }
    }
});
app.component("idNumber", {
    bindings: {
        className: "<"
    },
    templateUrl: '/app/components/idNumber/idNumber.html',
    controller: function($scope){
        $scope.className = "fa fa-info-circle";
        $scope.blur = function(){
            if($scope.$parent.form.id.$dirty){
                $scope.className = ($scope.$parent.form.id.$valid) ? "fa fa-check" : "fa fa-times";
            }
        }
    }
});
app.component("lastName", {
    bindings: {
        className: "<"
    },
    templateUrl: '/app/components/lastName/lastName.html',
    controller: function($scope){
        $scope.className = "fa fa-info-circle";
        $scope.blur = function(){
            console.log($scope.$parent)
            if($scope.$parent.form["last-name"].$dirty){
                $scope.className = ($scope.$parent.form["last-name"].$valid) ? "fa fa-check" : "fa fa-times";
            }
        }
    }
});

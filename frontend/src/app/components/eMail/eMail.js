app.component("eMail", {
    bindings: {
        className: "<"
    },
    templateUrl: '/app/components/eMail/eMail.html',
    controller: function($scope){
        $scope.className = "fa fa-info-circle";
        $scope.blur = function(){
            if($scope.$parent.form.email.$dirty){
                $scope.className = ($scope.$parent.form.email.$valid) ? "fa fa-check" : "fa fa-times";
            }
        }
    }
});

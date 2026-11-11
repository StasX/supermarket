app.component("aStreet",{
    bindings:{
        className: "<"
    },
    templateUrl: '/app/components/aStreet/aStreet.html',
    controller: function($scope){
        $scope.className = "fa fa-info-circle";
        $scope.blur = function(){
            if($scope.$parent.form.street.$dirty){
                $scope.className = ($scope.$parent.form.street.$valid) ? "fa fa-check" : "fa fa-times";
            }
        }
    }
});

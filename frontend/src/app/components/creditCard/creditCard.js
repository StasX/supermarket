app.component("creditCard", {
    bindings : {
        className : "<"
    },
    templateUrl : "/app/components/creditCard/creditCard.html",
    controller : function($scope){
        $scope.className = "fa fa-info-circle";
        $scope.blur = function(){
            if($scope.$parent.form["credit-card"].$dirty){
                $scope.className = ($scope.$parent.form["credit-card"].$valid) ? "fa fa-check" : "fa fa-times";
            }
        }
    }
});

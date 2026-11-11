app.component('firstName', {
    bindings: {
        className: '<'
    },
    templateUrl: '/app/components/firstName/firstName.html',
    controller: function($scope){
        $scope.className = 'fa fa-info-circle';
        $scope.blur = function(){
            if($scope.$parent.form['first-name'].$dirty){
                $scope.className = ($scope.$parent.form['first-name'].$valid) ? 'fa fa-check' : 'fa fa-times';
            }
        }
    }
});

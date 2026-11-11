app.component('userLogout', {
template : '<a ui-sref="login" ng-click="logout()">Logout</a>',
controller : function($scope, $http, $state, $rootScope){
    $scope.logout = function(){
        $http.get('/logout').then(function(data){
            delete $rootScope.userData;
            data.data.success ? $state.go('login') : swal('Please try again');
        }, function(){
            swal('Please try again');
        });
    }
}
});

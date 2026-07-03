app.component('userName', {
    bindings : {
        user : '<'
    },
    template : 'Hello {{user}}',
    controller : function($scope, $rootScope){
        $rootScope.userData = $rootScope.userData || {};
        $scope.user = $rootScope.userData.name;
    }
});
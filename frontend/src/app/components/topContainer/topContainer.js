app.component('topContainer', {
    /*bindings : {
        isSearchable : '<',
        isAuthorized : '='
    },*/
    templateUrl: 'app/components/topContainer/topContainer.html',
    controller: function ($scope, $state){
        var url = $state.current.url;
        $scope.isSearchable = ((url === '/store') || (url === '/cart') || (url === '/management'));
        $scope.isAuthorized = ((url !== '/login') && (url !== '/sign-up/1') && (url !== '/sign-up/2'));
        $scope.find = function(){
            console.log(this);
            console.log($scope.parent)
        }
    }
});

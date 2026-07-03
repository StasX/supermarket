app.component('signupStep',  {
templateUrl:'/app/components/signupStep/signupStep.html', 
controller:function($scope, $state) {
    var url = $state.current.url;

    $scope.step = url.substring((url.lastIndexOf('\/')+1));
    //($state.current.url === '/sign-up/1') ? 1 : 2;
}
}); 
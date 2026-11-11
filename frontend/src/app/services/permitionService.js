app.service('permitionService', function(){
    this.check= function($rootScope, $state ,$http){
        if($rootScope.userData === undefined || $rootScope.userData.role === undefined){
            $http.get('/reconect').then(function(data){
                data = data.data;
                if (data.success){
                    $rootScope.userData = {role : data.role, user : data.user, name :data.name};
                }  else{
                    $state.go('login');
                }
            },function(){
                $state.go('login');
            });
        }   else {
            var role = $rootScope.userData.role;
            switch($state.current.url){
                case '/about' : {
                    if (role !== 0)  $state.go('login');
                    break;
                } case '/info' : {
                    if (role !== 0) $state.go('login');
                    break;
                } case '/welcome' : {
                    if (role !== 0) $state.go('login');
                    break;
                } case '/store' : {
                    if (role !== 0) $state.go('login');
                    break;
                } case '/order' : {
                    if (role !== 0) $state.go('login');
                    break;
                } case '/management' : {
                    if (role !== 1) $state.go('login');
                    break;
                } default : {
                    $state.go('login');
                }
            }
        }
    }
});

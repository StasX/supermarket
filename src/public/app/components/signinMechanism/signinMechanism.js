app.component('signinMechanism', {
    bindings: {

    },
    templateUrl: '/app/components/signinMechanism/signinMechanism.html',
    controller: function($scope, $state, $http, $rootScope){
        $scope.alert = false;// User not press login button so don't show alert messag yet
            $scope.login = function(){
                if($scope.form.$valid){
                $http({method : 'post', url : '/login', 
                    data: {
                        username: $scope.form.user.$modelValue,
                        password: $scope.form.pass.$modelValue,
                    } 
                }).then(function(data){ 
                    data =data.data;
                    if(data.success){
                        $rootScope.userData = {role : data.role, user : data.user, name :data.name};
                        (data.role !== 1) ? $state.go('about') : $state.go('management');
                    }   else{
                        $scope.alert = true;
                    }
                } , function(err){
                   console.warn(err);
                   swal('Some error occurred', "Please try again later");
                });
            }   else{
                $scope.alert = true;
            }
            }
    }
});
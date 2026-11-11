app.controller('createUserController', function($scope, $state,$http){
    $scope.alert = false; // Dont show allert yet
    if($scope.$parent.data){
        //once user leave this page he begin registration from the start...
        //this page accessable only from "signup step 1" page... 
        $scope.id = $scope.$parent.data.id;
        $scope.email = $scope.$parent.data.email;
        $scope.pass = $scope.$parent.data.pass;
        delete $scope.$parent.data;// remove data passed from previus form
        $scope.save = function(){
            if ($scope.form.$valid) {
                
                $http({method:'post',url:'/sign-up', 
                    data:{
                        id : $scope.id,
                        email : $scope.email,
                        pass : $scope.pass,
                        city : $scope.form.city.$modelValue,
                        street : $scope.form.street.$modelValue,
                        firstName : $scope.form['first-name'].$modelValue,
                        lastName : $scope.form['last-name'].$modelValue
                    }
                }).then(function(data) {
                    console.log(data)
                    data.data.created ? $state.go('login') : swal({
                        title:'<h1>Something wrong!</h1>',
                        text: 'Please try again!',
                        type: 'warning',  
                    }).then(function(){
                        $state.go('signup.step1');
                    });   
                }, function(data){
                    window.console.warn(data)
                });
            //...
            //$state.go("login")
            }   else {
                $scope.alert = true; //One or more fields are wrong, so show alert message
            }
        }
    }   else{
        $state.go('signup.step1');
    }
});

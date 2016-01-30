L.mapbox.accessToken = config.mapboxToken;

var map = L.mapbox.map('map', config.baseMap, {zoomControl: false})
    .setView(config.center, config.zoom);

var defaultStyle = config.defaultStyle;

var highlightStyle = config.highlightStyle;

var featureLayer = L.mapbox.featureLayer().addTo(map);
var disableHighlight = false;

var app = angular.module("app", ["firebase", "ui.bootstrap", "formly", "formlyBootstrap", "ngNumeraljs"]);


app.filter('inThousands', function() {
    return function(input) {
        return input / 1000;
    };
});


app.filter('inMillions', function() {
    return function(input) {
        return input / 1000000;
    };
});


var readFirebasePlaces = function ($rootScope) {

	$rootScope.db = {};
	$rootScope.$broadcast('dataUpdated');

	var placesRef = new Firebase($rootScope.firebaseUrl()).child("places");

	placesRef.on("child_added", function (snapshot) {
		$rootScope.db[snapshot.key()] = snapshot.val();
		$rootScope.$broadcast('dataUpdated');
	});

	placesRef.on("child_changed", function (snapshot) {
		$rootScope.db[snapshot.key()] = snapshot.val();
		$rootScope.$broadcast('dataUpdated');
	});

	placesRef.on("child_removed", function (snapshot) {
		delete $rootScope.db[snapshot.key()];
		$rootScope.$broadcast('dataUpdated');
	});
}


app.run(function($rootScope, $firebaseArray) {

	$rootScope.safeApply = function(fn) {
		var phase = this.$root.$$phase;
		if(phase == '$apply' || phase == '$digest') {
			if(fn && (typeof(fn) === 'function')) {
				fn();
			}
		} else {
			this.$apply(fn);
		}
	};

	$rootScope.firebaseUrl = function () {
		return config.firebaseUrl + "/" + $rootScope.activeScenario;
	};

	var ref = new Firebase(config.firebaseUrl).child("scenarios");
	$rootScope.scenarios = $firebaseArray(ref);
	$rootScope.activeScenario = config.defaultScenario;

	$rootScope.$watch("activeScenario", function () {
		readFirebasePlaces($rootScope);
	});

	// global configuration

    d3.json(config.shpsfile, function(error, shapes) {

    	// read a geojson file - I'm sure there's lots of places for
    	// shapes to come from but this is a common one

    	$rootScope.db = {};
    	$rootScope.features = shapes.features;
    	$rootScope.$broadcast('dataUpdated');

    	// move data to firebase
    	// this overwrites ALL firebase data!
    	// config.initializeData(shapes.features, $rootScope.firebaseUrl());

		featureLayer.setGeoJSON(shapes);

		featureLayer.eachLayer(function (layer) {

			layer.setStyle(defaultStyle);

			layer.on("mouseover", function (e) {
				if(disableHighlight) return;
		        	layer.setStyle(highlightStyle);
			});

			layer.on("mouseout", function (e) {
		    		if(disableHighlight) return;
		        	layer.setStyle(defaultStyle);
			});
		});
    });
});


app.controller("navbarCtrl", function ($scope, $rootScope, $firebaseObject, $uibModal) {

	$scope.activeScenarioName = function () {
		var rec = $scope.scenarios.$getRecord($scope.activeScenario);
		return rec ? rec.name : '';
	};

	$scope.setActive = function (scenario) {
		$rootScope.activeScenario = scenario.$id;
	};

	$scope.open = function (mode) {

		$uibModal.open({
			templateUrl: 'scenarioPickerModal.html',
			controller: 'scenarioPickerModalCtrl',
			size: "sm",
			resolve: {
				mode: function () { mode || "new" }
			}
		}).result.then(function (name) {
			$rootScope.scenarios.$add({ name: name }).then(function(ref) {
				$rootScope.activeScenario = ref.key();
			});
		});
	};
});


app.controller('scenarioPickerModalCtrl', function ($scope, $uibModalInstance, mode) {

	$scope.ok = function () {
		$uibModalInstance.close($scope.name);
	};

	$scope.cancel = function () {
		$uibModalInstance.dismiss();
	};
});


app.controller("mainCtrl", function($scope, $rootScope, $firebaseObject) {

	// root controller for the whole app

	$scope.showToolbar = true;
	$scope.showPlace = false;
});


var throttledAnalytics = _.throttle(config.runAnalytics, 500);

app.controller("analyticsCtrl", function($scope, $rootScope) {

	// controller for the analytics window

	$rootScope.$on("dataUpdated", function (features) {

		var features = config.mergeGeojsonFirebase(
			$rootScope.features, $rootScope.db);

		if(!features) return;

		var v = throttledAnalytics(features, function (v) {
			$rootScope.safeApply(function () {

				$scope.analytics = v;
			})
		});
	});
});


app.controller("placeCtrl", function($scope, $rootScope, $firebaseObject) {

	// controller for the place description window

	$scope.placeFields = config.placeForm();

	$scope.activatePlace = function (feature) {

		$scope.$parent.showToolbar = true;
		$scope.$parent.showPlace = true;
		$scope.feature = feature;

		var ref = new Firebase($scope.firebaseUrl()).child("places").child(feature.properties.parcel_id);

		if($scope.unbind) {
			$scope.unbind();
		}

		$firebaseObject(ref).$bindTo($scope, "place").then(function(unbind) {
			$scope.unbind = unbind;
		});
	};

	featureLayer.on('click', function(e) {

		if($scope.activeLayer) $scope.activeLayer.setStyle(defaultStyle);
		$scope.activeLayer = e.layer;
		disableHighlight = true;
		e.layer.setStyle(highlightStyle);

		$scope.$apply(function () {
			$scope.activatePlace(e.layer.feature);
		});
	});

	var hidePlace = function () {
		if($scope.activeLayer) $scope.activeLayer.setStyle(defaultStyle);
		disableHighlight = false;
		$scope.activeLayer = undefined;

		$rootScope.safeApply(function () {
			$scope.$parent.showPlace = false;
		});
	}

	map.on('click', function (e) {
		hidePlace();
	});

	$rootScope.$watch("activeScenario", function () {
		hidePlace();
	});
});
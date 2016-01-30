L.mapbox.accessToken = config.mapboxToken;

var map = L.mapbox.map('map', config.baseMap, {zoomControl: false})
    .setView(config.center, config.zoom);

var defaultStyle = config.defaultStyle;

var highlightStyle = config.highlightStyle;

var featureLayer = L.mapbox.featureLayer().addTo(map);
var disableHighlight = false;

var FIREBASE_URL = config.firebaseUrl + "/" + config.defaultScenario;

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


app.run(function($rootScope) {

	// global configuration

    d3.json(config.shpsfile, function(error, shapes) {

    	// read a geojson file - I'm sure there's lots of places for
    	// shapes to come from but this is a common one

    	$rootScope.db = {};
    	$rootScope.features = shapes.features;
    	$rootScope.$broadcast('dataUpdated');

    	// move data to firebase
    	// this overwrites ALL firebase data!
    	// config.initializeData(shapes.features);

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

		// read all the data from firebase

		var placesRef = new Firebase(FIREBASE_URL).child("places");

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
    });
});


app.controller("mainCtrl", function($scope, $firebaseObject) {

	// root controller for the whole app

	$scope.showToolbar = true;
	$scope.showPlace = false;
});


var throttledAnalytics = _.throttle(config.runAnalytics, 250);

app.controller("analyticsCtrl", function($scope, $rootScope) {

	// controller for the analytics window

	$rootScope.$on("dataUpdated", function (features) {

		var features = config.mergeGeojsonFirebase(
			$rootScope.features, $rootScope.db);

		if(!features) return;

		var v = throttledAnalytics(features, function (v) {
			$scope.$apply(function () {
				$scope.analytics = v;
			})
		});
	});
});


app.controller("placeCtrl", function($scope, $firebaseObject) {

	// controller for the place description window

	$scope.placeFields = config.placeForm();

	$scope.activatePlace = function (feature) {

		$scope.$parent.showToolbar = true;
		$scope.$parent.showPlace = true;
		$scope.feature = feature;
		$scope.place = {};

		var ref = new Firebase(FIREBASE_URL).child("places").child(feature.properties.parcel_id);

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

	map.on('click', function (e) {

		if($scope.activeLayer) $scope.activeLayer.setStyle(defaultStyle);
		disableHighlight = false;
		$scope.activeLayer = undefined;

		$scope.$apply(function () {
			$scope.$parent.showPlace = false;
		});
	});
});
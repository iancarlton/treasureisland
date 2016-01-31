L.mapbox.accessToken = config.mapboxToken;

var map = L.mapbox.map('map', config.baseMap, {zoomControl: false})
    .setView(config.center, config.zoom);

var defaultStyle = config.defaultStyle;

var highlightStyle = _.clone(config.highlightStyle);

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

	$rootScope.firebaseUrl = function (scenario) {
		return config.firebaseUrl + "/" + (scenario || $rootScope.activeScenario);
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
		        layer.setStyle(layer.style || defaultStyle);
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

	$scope.notBaseline = function () {
		return $scope.activeScenario != config.defaultScenario;
	};

	$scope.delete = function () {
		var rec = $scope.scenarios.$getRecord($scope.activeScenario);
		$rootScope.scenarios.$remove(rec);
		new Firebase($rootScope.firebaseUrl()).remove();
		$rootScope.safeApply(function () {
			$rootScope.activeScenario = config.defaultScenario;
		});
	};

	$scope.open = function (mode) {

		$uibModal.open({
			templateUrl: 'scenarioPickerModal.html',
			controller: 'scenarioPickerModalCtrl',
			size: "sm",
			resolve: {
				mode: function () { return mode || "New" }
			}
		}).result.then(function (obj) {

			$rootScope.scenarios.$add({ name: obj.name }).then(function(ref) {
				if(obj.mode == "Copy") {

					var oldRef = new Firebase($rootScope.firebaseUrl()),
					    newRef = new Firebase($rootScope.firebaseUrl(ref.key()));

					oldRef.once('value', function(v)  {
          				newRef.set(v.val(), function () {
          					$rootScope.safeApply(function () {
          						$rootScope.activeScenario = ref.key();
          					});
          				});
          			});

				} else {
					$rootScope.safeApply(function () {
						$rootScope.activeScenario = ref.key();
					});
				}
			});
		});
	};
});


app.controller('scenarioPickerModalCtrl', function ($scope, $uibModalInstance, mode) {

	$scope.mode = mode;

	$scope.ok = function () {
		$uibModalInstance.close({name: $scope.name, mode: $scope.mode});
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

	$scope.selectedTheme = "Default";
	$scope.themes = _.keys(config.themes);

	$scope.switchTheme = function (t) {

		if(t == "Default") {

			highlightStyle.fillColor = config.highlightStyle.fillColor;
			highlightStyle.color = config.highlightStyle.color;

			console.log(config.highlightStyle, highlightStyle);
			featureLayer.eachLayer(function (layer) {
				layer.style = undefined;
				layer.setStyle(config.defaultStyle);
			});
			return;
		}

		t = config.themes[t];

		var getAttr = function (layer, attr) {
			var key = layer.feature.properties[config.keyAttr];
			var rec = $rootScope.db[key];
			return rec[attr];
		}

		var vals = [];
		featureLayer.eachLayer(function (layer) {
			vals.push(getAttr(layer, t.attr));
		});

		var scale = d3.scale.linear()
			.domain(d3.extent(vals))
			.interpolate(d3.interpolateRgb)
			.range(t.interpolate)

		featureLayer.eachLayer(function (layer) {

			var v = getAttr(layer, t.attr);
			var style = {
				fillColor: scale(v)
			};

			if(t.opacity) style.fillOpacity = t.opacity;
			if(!v) style.fillOpacity = 0;
			if(t.outlineColor) {
				style.color = t.outlineColor;
				highlightStyle.color = t.outlineColor;
			}
			if(t.highlightColor) highlightStyle.fillColor = t.highlightColor;

			layer.style = style;
			layer.setStyle(style);
		});
	};

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

		if($scope.activeLayer) $scope.activeLayer.setStyle(
			$scope.activeLayer.style || defaultStyle);

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
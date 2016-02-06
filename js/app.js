L.mapbox.accessToken = config.mapboxToken;

var map = L.mapbox.map('map', config.baseMap, {zoomControl: false})
    .setView(config.center, config.zoom);

var defaultStyle = config.defaultStyle;

var highlightStyle = _.clone(config.highlightStyle);

var featureLayer = L.mapbox.featureLayer().addTo(map);
var disableHighlight = false;

var app = angular.module("app", ["firebase", "ui.bootstrap", "formly",
    "formlyBootstrap", "ngNumeraljs", "toastr", "angularMoment"]);


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


app.config(function(toastrConfig) {
  angular.extend(toastrConfig, {
    positionClass: 'toast-bottom-left'
  });
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

    $rootScope.keydown = function (key) {
        $rootScope.keyDown = key.code;
        $rootScope.maybePaint($rootScope.hoverFeature);
    };

    $rootScope.keyup = function (key) {
        $rootScope.keyDown = undefined;
    };

    $rootScope.maybePaint = function (feature) {
        
        var pc = $rootScope.paintConfiguration;
        if(!pc) return false;
        if(!feature) return false;
        if($rootScope.keyDown != "Space") return false;

        var ref = new Firebase($rootScope.firebaseUrl()).child("places").child(feature.properties[config.keyAttr]);

        if(pc.mode == "set") {
            ref.child(pc.attr).set(pc.amount);
        } else {
            var amt = pc.mode == "add" ? pc.amount : -1 * pc.amount;
            ref.child(pc.attr).transaction(function (current_value) {
                return (current_value || 0) + amt;
            });
        }
    };

    $rootScope.getFullFeatures = function(features, db) {

        if(!features) return;

        return _.map(features, function (f) {

            return config.getFullFeature(f, db);
        });
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

                $rootScope.safeApply(function () {
                    // set to root scope the current shape
                    // being hovered over
                    $rootScope.hoverFeature = 
                        config.getFullFeature(
                            layer.feature, $rootScope.db);
                });

                if(disableHighlight) return;

                if($rootScope.paintConfiguration) {
                    if(!$rootScope.maybePaint(layer.feature)) {
                        layer.setStyle(highlightStyle);
                    }
                } else {
                    layer.setStyle(highlightStyle);
                }
            });

            layer.on("mouseout", function (e) {

                $rootScope.safeApply(function () {
                    $rootScope.hoverFeature = undefined;
                });

                if(disableHighlight) return;
                layer.setStyle(layer.style || defaultStyle);
            });
        });
    });
});


app.controller("navbarCtrl", function ($scope, $rootScope, $firebaseObject, $uibModal,
    toastr) {

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

    $scope.paint = function (mode) {

        var attrs = _.map(config.editableAttributes(), function (obj) {
            return {
                name: obj.label,
                value: obj.key
            }
        });
        var defaultAttr = config.editableAttributes()[0].key;

        $uibModal.open({
            templateUrl: 'genericModal.html',
            controller: 'genericModalCtrl',
            size: "sm",
            resolve: {
                title: function () { 
                    return "Paint Attribute Config";
                },
                submitText: function () {
                    return "Configure";
                },
                initialValue: function () {
                    return {
                        attr: defaultAttr,
                        mode: "set",
                        amount: 10
                    }
                },
                form: function () {
                    return [{
                        key: "attr",
                        type: "select",
                        templateOptions: {
                            label: "Pick Attribute",
                            options: attrs
                        },
                    }, {
                        key: "mode",
                        type: "select",
                        templateOptions: {
                            label: "Paint Mode",
                            options: [{
                                name: "Set",
                                value: "set"
                            }, {
                                name: "Add",
                                value: "add"
                            }, {
                                name: "Subtract",
                                value: "subtract"
                            }]
                        }
                    }, {
                        key: "amount",
                        type: "input",
                        templateOptions: {
                            type: "number",
                            label: "Amount"
                        }
                    }]
                }
            }
        }).result.then(function (obj) {
            $rootScope.paintConfiguration = obj;
            toastr.success('Use space bar to paint attribute to parcel!', 'Paint configured');
        });
    };
});


app.controller('genericModalCtrl', function ($scope,
    $uibModalInstance, title, submitText, form, initialValue) {

    $scope.title = title;
    $scope.submitText = submitText;
    $scope.intputConfig = form;
    $scope.inputs = initialValue;

    $scope.ok = function () {
        $uibModalInstance.close($scope.inputs);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss();
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


var throttledAnalytics = _.throttle(config.aggregateAnalytics, 500);

app.controller("analyticsCtrl", function($scope, $rootScope, $firebaseObject) {

    // controller for the analytics window

    $scope.selectedTheme = "Default";
    $scope.themes = _.keys(config.themes);

    $rootScope.$watch("activeScenario", function () {
        $scope.switchTheme($scope.selectedTheme);

        var ref = new Firebase($scope.firebaseUrl()).child("assumptions");

        if($scope.unbind) {
            $scope.unbind();
        }

        $firebaseObject(ref).$bindTo($scope, "assumptionsObj").then(function(unbind) {
            $scope.unbind = unbind;
        });
    });

    $scope.assumptions = function () {
        // I'm not totally sure why this needs to be a function - but it
        // has something to do with the scope changing inside the ui-tabset
        return $scope.assumptionsObj;
    }

    $scope.assumptionsObj = {};
    $scope.globalFields = config.globalForm();

    $scope.switchTheme = function (t) {

        if(t == "Default") {

            highlightStyle.fillColor = config.highlightStyle.fillColor;
            highlightStyle.color = config.highlightStyle.color;

            featureLayer.eachLayer(function (layer) {
                layer.style = undefined;
                layer.setStyle(config.defaultStyle);
            });
            return;
        }

        t = config.themes[t];

        var getAttr = function (layer, attr) {
            var f = config.getFullFeature(layer.feature, $rootScope.db);
            return +f.properties[attr];
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

        var features = $rootScope.getFullFeatures(
            $rootScope.features, $rootScope.db);

        if(!features) return;

        $scope.switchTheme($scope.selectedTheme);

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
        $rootScope.activePlace = $scope.feature = feature;   
        
        var ref = new Firebase($scope.firebaseUrl()).child("places").child(feature.properties[config.keyAttr]);

        if($scope.unbind) {
            $scope.unbind();
        }

        $firebaseObject(ref).$bindTo($scope, "place").then(function(unbind) {
            $scope.unbind = unbind;
        });
    };

    featureLayer.on('click', function(e) {

        if($scope.activeLayer) $scope.activeLayer.setStyle(
            $scope.activeLayer.style || defaultStyle);

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


app.controller("commentCtrl", function($scope, $rootScope, 
    $firebaseArray, toastr) {

    $scope.comments = [];

    $scope.comment = {
        showMakeComment: false,
        showMakeReply: false,
        commentText: "",
        heading: ""
    };

    $scope.commentRef = function () {

        var featureId = $rootScope.activePlace.properties[config.keyAttr];
        return new Firebase(config.firebaseUrl).child("comments").child(featureId);
    }

    $rootScope.$watch("activePlace", function (v) {

        if(!v) return;

        $scope.comments = $firebaseArray($scope.commentRef());
    });

    $scope.noComments = function () {
        return $scope.comments.length == 0;
    };

    $scope.hideMakeComment = function () {
        $scope.comment.showMakeComment = false;
        $scope.comment.heading = "";
        $scope.comment.commentText = "";
    };

    $scope.hideMakeReply = function () {
        $scope.comment.showMakeReply = false;
        $scope.comment.commentText = "";
    };

    $scope.divideDate = function (date) {
        return date/1000;
    };

    $scope.setReply = function (id) {
        $scope.replyId = id;
        $scope.comment.showMakeReply = id;
    }

    $scope.lessThanADayAgo = function (unixDate) {
        var now = moment(new Date());
        var then = moment(unixDate);
        var diff = now.diff(then, 'days')
        return diff < 1;
    };

    $scope.makeReply = function () {

        var commentText = $scope.comment.commentText;

        if(!commentText) {
            toastr.error("No comment text, can't submit comment");
            return;
        }

        $scope.commentRef().child($scope.replyId).child("replies").push({
            commentText: commentText,
            date: Firebase.ServerValue.TIMESTAMP
        });

        $scope.hideMakeReply();
    }

    $scope.makeComment = function (heading, commentText) {

        var heading = $scope.comment.heading;
        var commentText = $scope.comment.commentText;

        if(!heading) {
            toastr.error("No heading, can't submit comment");
            return;
        }

        if(!commentText) {
            toastr.error("No comment text, can't submit comment");
            return;
        }

        $scope.comments.$add({
            heading: heading,
            commentText: commentText,
            date: Firebase.ServerValue.TIMESTAMP
        });

        $scope.hideMakeComment();
    };
});
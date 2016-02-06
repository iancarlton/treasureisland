config = {

    mapboxToken: 'pk.eyJ1IjoiZnNjb3R0Zm90aSIsImEiOiJLVHVqNHlNIn0.T0Ca4SWbbTc1p2jogYLQyA',

    defaultScenario: "-K9JUejl-avKZl9oAIVH",

    firebaseUrl: "https://treasureisland.firebaseio.com",

    center: [37.823512, -122.368358],
    zoom: 16,
    shpsfile: "ti.geojson",
    baseMap: "fscottfoti.kaeo1aml",

    keyAttr: "parcel_id",

    defaultStyle: {
        color: "#2262CC",
        weight: 2,
        opacity: 0.6,
        fillOpacity: 0.1,
        fillColor: "#2262CC"
    },

    highlightStyle: {
        color: '#2262CC', 
        weight: 3,
        opacity: 0.6,
        fillOpacity: 0.65,
        fillColor: '#2262CC'
    },

    themes: {
        "Max Dua": {
            attr: "maxDua",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: '#ffffcc',
            interpolate: ["#fff5eb", "#7f2704"]
        },
        "Max Far": {
            attr: "maxFar",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: "#ffb3ff",
            interpolate: ["#f7fbff", "#08306b"]
        },
        "Residential Units": {
            attr: "residentialUnits",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: '#ffffcc',
            interpolate: ["#fff7ec", "#7f0000"]
        },
        "Non-residential Sqft": {
            attr: "nonResidentialSqft",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: "#ffb3ff",
            interpolate: ["#fff7fb", "#023858"]
        },

    },

    editableAttributes: function () {
        return  [
            //{key: "residentialUnits", label: "Residential Units"},
            //{key: "nonResidentialSqft", label: "Non-residential Sqft"},
            {key: "maxDua", label: "Max DUA"},
            {key: "maxFar", label: "Max FAR"},
            {key: "rentSqftRes", label: "Residential Rent ($/sqft/month)"},
            {key: "rentSqftComm", label: "Non-residential Rent ($/sqft/year)"},
            {key: "landPrep", label: "Land Prep Cost (Demo Cost)"}
        ]
    },

    placeForm: function () {

        var placeFields = [];

        this.editableAttributes().forEach(function (obj) {
            placeFields.push({
                key: obj.key,
                type: 'input',
                templateOptions: {
                    type: 'text',
                    label: obj.label
                }
            });
        });

        return placeFields;
    },

    runAnalytics: function (features, callback) {

        // global assumptions, hard coded for now, but
        // will be entered by the user
        var globals = {
            constructCost: 185, // $/SqFt hard cost
            softCost: 0.40, // % of hard cost
            capRate: 0.045,
            goInCapSpread: 0.20, // % over blended CAP
            inclusionary: 0.20, // % of Res sq ft
            affDepth: 0.6 // % of AMI
        };

        var defaults = {
            rentSqftRes: 4, // $/SqFt/month
            rentSqftComm: 20, // $/SqFt/year NNN
            maxDua: 0,
            maxFar: 0,
            landPrep: 0
        };

        var proFormas = _.map(features, function (f) {
            var p = f.properties;
            _.each(_.keys(defaults), function (prop) {
                if(!p[prop]) p[prop] = defaults[prop];
            });
            if(!p.parcelSize) p.parcelSize = f.parcel_size;
            return ROCpencil(p, globals);
        });

        var v = {
            "raw_residential_capacity": d3.sum(features, function (v) {
                return v.properties.maxDua * v.properties.parcelAcres;
            }),
            "raw_non_residential_capacity": d3.sum(features, function (v) {
                return v.properties.maxFar * v.properties.parcelAcres * 43560;
            }),
            "total_residential_units": d3.sum(proFormas, function (pf) {
                return pf.unitsTotal;
            }),
            "total_affordable_units": d3.sum(proFormas, function (pf) {
                return pf.unitsAff;
            }),
            "total_non_residential_sqft": d3.sum(proFormas, function (pf) {
                return pf.commSqFt;
            }),
            "total_tif_capacity": d3.sum(proFormas, function (pf) {
                return pf.tifCapacity;
            }),
            "total_residential_land": d3.sum(proFormas, function (pf) {
                return pf.residualLand;
            }),
            "total_acres": d3.sum(features, function (v) {
                return v.properties.parcelAcres;
            })
        };

        // asynchronous
        callback(v);
    },

    mergeFeatureAndRec: function (f, db) {
        f = JSON.parse(JSON.stringify(f));
        _.extend(f["properties"], db[f.properties[config.keyAttr]]);
        return f;
    },

    // this is a rather odd but important function which merged the "base"
    // data which comes out of the geojson with the override attribute
    // data which comes out of firebase

    mergeGeojsonFirebase: function(features, db) {

        if(!features) return;

        var features = JSON.parse(JSON.stringify(features));

        return _.map(features, function (f) {

            _.extend(f["properties"], db[f.properties[config.keyAttr]]);
            return f;

        });
    },

    // this method moves data from the geojson into firebase - this only
    // really needs to be done once, although I guess you can do it
    // multiple times when debugging to reset to the initial state

    initializeData: function (features, url) {

        _.each(features, function (feature) {
            var ref = new Firebase(url).child("places").child(feature.properties.parcel_id);

            [
                //{key: "residentialUnits", prop: "total_residential_units"},
                //{key: "nonResidentialSqft", prop: "total_non_residential_sqft"},
                //{key: "parcelSize", prop: "parcel_size"},
                //{key: "parcelAcres", prop: "parcel_acres"}
                
            ].forEach(function (obj) {

                ref.child(obj.key).set(feature.properties[obj.prop]);

            });
        });
    }
};

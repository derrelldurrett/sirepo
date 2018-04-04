'use strict';

var srlog = SIREPO.srlog;
var srdbg = SIREPO.srdbg;

SIREPO.appLocalRoutes.visualization = '/visualization/:simulationId';
SIREPO.PLOTTING_SUMMED_LINEOUTS = true;
SIREPO.SINGLE_FRAME_ANIMATION = ['beamEvolutionAnimation', 'coolingRatesAnimation'];
SIREPO.FILE_UPLOAD_TYPE = {
    'ring-lattice': '.tfs',
};
SIREPO.appReportTypes = [
    '<div data-ng-switch-when="rateCalculation" data-rate-calculation-panel="" class="sr-plot"></div>',
].join('');
SIREPO.appFieldEditors = [
    '<div data-ng-switch-when="ElegantSimList" data-ng-class="fieldClass">',
      '<div data-elegant-sim-list="" data-model="model" data-field="field"></div>',
    '</div>',
].join('');

SIREPO.app.config(function($routeProvider, localRoutesProvider) {
    if (SIREPO.IS_LOGGED_OUT) {
        return;
    }
    var localRoutes = localRoutesProvider.$get();
    $routeProvider
        .when(localRoutes.source, {
            controller: 'SourceController as source',
            templateUrl: '/static/html/jspec-source.html' + SIREPO.SOURCE_CACHE_KEY,
        })
        .when(localRoutes.visualization, {
            controller: 'VisualizationController as visualization',
            templateUrl: '/static/html/jspec-visualization.html' + SIREPO.SOURCE_CACHE_KEY,
        });
});

SIREPO.app.controller('SourceController', function(appState, panelState, $scope) {
    var self = this;

    function processElectronBeamShape() {
        var shape = appState.models.electronBeam.shape;
        panelState.showField('electronBeam', 'radius', shape == 'dc_uniform' || shape == 'bunched_uniform');
        panelState.showField('electronBeam', 'current', shape == 'dc_uniform' || shape == 'bunched_uniform' || shape == 'bunched_uniform_elliptic');
        panelState.showField('electronBeam', 'length', shape == 'bunched_uniform' || shape == 'bunched_uniform_elliptic');
        ['e_number', 'sigma_x', 'sigma_y', 'sigma_z'].forEach(function(f) {
            panelState.showField('electronBeam', f, shape == 'bunched_gaussian');
        });
        ['rh', 'rv'].forEach(function(f) {
            panelState.showField('electronBeam', f, shape == 'bunched_uniform_elliptic');
        });
        // dynamically set the help text in the schema for the selected beam shape
        SIREPO.APP_SCHEMA.enum.ElectronBeamShape.forEach(function(v, i) {
            if (v[0] == shape) {
                SIREPO.APP_SCHEMA.model.electronBeam.shape[3] = SIREPO.APP_SCHEMA.enum.ElectronBeamShapeDescription[i][1];
            }
        });
    }

    function processElectronBeamType() {
        var ebeam = appState.models.electronBeam;
        var beam_type = ebeam.beam_type;
        if (beam_type == 'continuous') {
            // only one shape choice for continuous beams
            ebeam.shape = 'dc_uniform';
        }
        else {
            if (ebeam.shape == 'dc_uniform') {
                ebeam.shape = 'bunched_uniform';
            }
        }
        SIREPO.APP_SCHEMA.enum.ElectronBeamShape.forEach(function(v) {
            if (v[0].indexOf('bunched') >= 0) {
                panelState.showEnum('electronBeam', 'shape', v[0], beam_type == 'bunched');
            }
            else {
                panelState.showEnum('electronBeam', 'shape', v[0], beam_type == 'continuous');
            }
        });
    }

    function processGamma() {
        var ionBeam = appState.models.ionBeam;
        var gamma = 0;
        if (ionBeam.mass != 0) {
            gamma = (1 + ionBeam.kinetic_energy / ionBeam.mass).toFixed(6);
        }
        // electronBeam.gamma is not directly used on server side calculation
        appState.models.electronBeam.gamma = gamma;
        appState.applicationState().electronBeam.gamma = gamma;
        panelState.enableField('electronBeam', 'gamma', false);
    }

    function processIntrabeamScatteringMethod() {
        var method = appState.models.intrabeamScatteringRate.longitudinalMethod;
        panelState.showField('intrabeamScatteringRate', 'nz', method == 'nz');
        panelState.showField('intrabeamScatteringRate', 'log_c', method == 'log_c');
    }

    function processIonBeamType() {
        panelState.showField('ionBeam', 'rms_bunch_length', appState.models.ionBeam.beam_type == 'bunched');
    }

    function processLatticeSource() {
        var latticeSource = appState.models.ring.latticeSource;
        panelState.showField('ring', 'lattice', latticeSource == 'madx');
        panelState.showField('ring', 'elegantTwiss', latticeSource == 'elegant');
        panelState.showField('ring', 'elegantSirepo', latticeSource == 'elegant-sirepo');
    }

    self.handleModalShown = function(name) {
        if (name == 'rateCalculationReport') {
            processIntrabeamScatteringMethod();
        }
    };

    appState.whenModelsLoaded($scope, function() {
        processElectronBeamType();
        processElectronBeamShape();
        processLatticeSource();
        processGamma();
        appState.watchModelFields($scope, ['ionBeam.beam_type'], processIonBeamType);
        appState.watchModelFields($scope, ['electronBeam.shape', 'electronBeam.beam_type'], processElectronBeamShape);
        appState.watchModelFields($scope, ['electronBeam.beam_type'], processElectronBeamType);
        appState.watchModelFields($scope, ['intrabeamScatteringRate.longitudinalMethod'], processIntrabeamScatteringMethod);
        appState.watchModelFields($scope, ['ring.latticeSource'], processLatticeSource);
        appState.watchModelFields($scope, ['ionBeam.mass', 'ionBeam.kinetic_energy'], processGamma);
    });
});

SIREPO.app.controller('VisualizationController', function(appState, frameCache, panelState, persistentSimulation, requestSender, $scope) {
    var self = this;
    var isComputingRanges = false;
    var fieldRange;
    self.settingsModel = 'simulationStatus';
    self.panelState = panelState;
    self.hasParticles = false;
    self.hasRates = false;

    function handleStatus(data) {
        if (data.startTime && ! data.error) {
            if (self.simState.isStateRunning()) {
                appState.models.particleAnimation.isRunning = 1;
            }
            ['beamEvolutionAnimation', 'coolingRatesAnimation', 'particleAnimation'].forEach(function(m) {
                appState.models[m].startTime = data.startTime;
                appState.saveQuietly(m);
                self.hasParticles = data.hasParticles;
                self.hasRates = data.hasRates;
                frameCache.setFrameCount(data.frameCount, m);
            });
            if (data.percentComplete == 100 && ! isComputingRanges) {
                fieldRange = null;
                isComputingRanges = true;
                requestSender.getApplicationData(
                    {
                        method: 'compute_particle_ranges',
                        simulationId: appState.models.simulation.simulationId,
                    },
                    function(data) {
                        isComputingRanges = false;
                        if (appState.isLoaded() && data.fieldRange) {
                            appState.models.particleAnimation.isRunning = 0;
                            appState.saveQuietly('particleAnimation');
                            fieldRange = data.fieldRange;
                        }
                    });
            }
        }
        frameCache.setFrameCount(data.frameCount || 0);
    }

    function processColorRange() {
        ['colorMin', 'colorMax'].forEach(function(f) {
            panelState.showField('particleAnimation', f, appState.models.particleAnimation.colorRangeType == 'fixed');
        });
    }

    function processModel() {
        var settings = appState.models.simulationSettings;
        panelState.showField('simulationSettings', 'save_particle_interval', settings.model == 'particle');
        panelState.showField('simulationSettings', 'sample_number', settings.model == 'particle' && settings.e_cool == '0');
        panelState.showRow('simulationSettings', 'ref_bet_x', settings.model == 'particle' && settings.e_cool == '0');
    }

    function processPlotRange() {
        var particleAnimation = appState.models.particleAnimation;
        panelState.showEnum('particleAnimation', 'plotRangeType', 'fit', fieldRange);
        panelState.showRow('particleAnimation', 'horizontalSize', particleAnimation.plotRangeType != 'none');
        ['horizontalSize', 'horizontalOffset', 'verticalSize', 'verticalOffset'].forEach(function(f) {
            panelState.enableField('particleAnimation', f, particleAnimation.plotRangeType == 'fixed');
        });
        if (particleAnimation.plotRangeType == 'fit' && fieldRange) {
            setFieldRange('horizontal', particleAnimation, 'x');
            setFieldRange('vertical', particleAnimation, 'y');
        }
    }

    function setFieldRange(prefix, particleAnimation, field) {
        var f = particleAnimation[field];
        if (f == 'dpp') {
            f = 'dp/p';
        }
        var range = fieldRange[f];
        particleAnimation[prefix + 'Size'] = range[1] - range[0];
        particleAnimation[prefix + 'Offset'] = (range[0] + range[1]) / 2;
    }

    self.handleModalShown = function(name) {
        if (name == 'particleAnimation') {
            processColorRange();
            processPlotRange();
        }
    };

    self.notRunningMessage = function() {
        if (self.hasParticles) {
            return '';
        }
        return 'Simulation ' + self.simState.stateAsText();
    };

    self.runningMessage = function() {
        if (self.hasParticles) {
            return '';
        }
        return 'Simulation running';
    };

    appState.whenModelsLoaded($scope, function() {
        processModel();
        appState.watchModelFields($scope, ['simulationSettings.model', 'simulationSettings.e_cool'], processModel);
        appState.watchModelFields($scope, ['particleAnimation.plotRangeType'], processPlotRange);
        appState.watchModelFields($scope, ['particleAnimation.colorRangeType'], processColorRange);
    });

    self.simState = persistentSimulation.initSimulationState($scope, 'animation', handleStatus, {
        beamEvolutionAnimation: [SIREPO.ANIMATION_ARGS_VERSION + '2', 'y1', 'y2', 'y3', 'startTime'],
        coolingRatesAnimation: [SIREPO.ANIMATION_ARGS_VERSION + '1', 'y1', 'y2', 'y3', 'startTime'],
        particleAnimation: [SIREPO.ANIMATION_ARGS_VERSION + '2', 'x', 'y', 'histogramBins', 'plotRangeType', 'horizontalSize', 'horizontalOffset', 'verticalSize', 'verticalOffset', 'isRunning', 'startTime'],
    });
});

SIREPO.app.directive('appFooter', function() {
    return {
        restrict: 'A',
        scope: {
            nav: '=appFooter',
        },
        template: [
            '<div data-common-footer="nav"></div>',
            '<div data-import-dialog=""></div>',
        ].join(''),
    };
});

SIREPO.app.directive('appHeader', function() {
    return {
        restrict: 'A',
        scope: {
            nav: '=appHeader',
        },
        template: [
            '<div data-app-header-brand="nav"  data-app-url="/#/jspec"></div>',
            '<div data-app-header-left="nav"></div>',
            '<div data-app-header-right="nav">',
              '<app-header-right-sim-loaded>',
		'<div data-sim-sections="">',
                  '<li class="sim-section" data-ng-class="{active: nav.isActive(\'source\')}"><a href data-ng-click="nav.openSection(\'source\')"><span class="glyphicon glyphicon-flash"></span> Source</a></li>',
                  '<li class="sim-section" data-ng-class="{active: nav.isActive(\'visualization\')}"><a href data-ng-click="nav.openSection(\'visualization\')"><span class="glyphicon glyphicon-picture"></span> Visualization</a></li>',
                '</div>',
              '</app-header-right-sim-loaded>',
              '<app-settings>',
		//  '<div>App-specific setting item</div>',
	      '</app-settings>',
              '<app-header-right-sim-list>',
              '</app-header-right-sim-list>',
            '</div>',
	].join(''),
    };
});

SIREPO.app.directive('elegantSimList', function(appState, requestSender, $window) {
    return {
        restrict: 'A',
        template: [
            '<div style="white-space: nowrap">',
              '<select style="display: inline-block" class="form-control" data-ng-model="model[field]" data-ng-options="item.simulationId as item.name for item in simList"></select>',
              ' ',
              '<button type="button" title="View Simulation" class="btn btn-default" data-ng-click="openElegantSimulation()"><span class="glyphicon glyphicon-eye-open"></span></button>',
            '</div>',
        ].join(''),
        controller: function($scope) {
            $scope.simList = null;
            $scope.openElegantSimulation = function() {
                if ($scope.model && $scope.model[$scope.field]) {
                    //TODO(pjm): this depends on the visualization route being present in both jspec and elegant apps
                    // need meta data for a page in another app
                    var url = '/elegant#' + requestSender.formatUrlLocal('visualization', {
                        ':simulationId': $scope.model[$scope.field],
                    });
                    $window.open(url, '_blank');
                }
            };
            appState.whenModelsLoaded($scope, function() {
                requestSender.getApplicationData(
                    {
                        method: 'get_elegant_sim_list',
                    },
                    function(data) {
                        if (appState.isLoaded() && data.simList) {
                            $scope.simList = data.simList.sort(function(a, b) {
                                return a.name.localeCompare(b.name);
                            });
                        }
                    });
            });
        },
    };
});

SIREPO.app.directive('rateCalculationPanel', function(appState, plotting) {
    return {
        restrict: 'A',
        scope: {},
        template: [
            '<div data-ng-if="! rates">',
              '<div class="lead">&nbsp;</div>',
            '</div>',
            '<div data-ng-if="rates">',
              '<div data-ng-repeat="rate in rates">',
                '<div class="col-sm-12">',
                  '<label>{{ rate[0] }}</label>',
                '</div>',
                '<div data-ng-repeat="value in rate[1] track by $index" class="text-right col-sm-4">{{ value }}</div>',
              '</div>',
            '</div>',
        ].join(''),
        controller: function($scope) {
            //TODO(pjm): these should be no-op in sirepo-plotting, for text reports
            var noOp = function() {};
            $scope.clearData = noOp;
            $scope.destroy = noOp;
            $scope.init = noOp;
            $scope.resize = noOp;
            $scope.load = function(json) {
                $scope.rates = json.rate;
            };
        },
        link: function link(scope, element) {
            scope.modelName = 'rateCalculationReport';
            plotting.linkPlot(scope, element);
        },
    };
});

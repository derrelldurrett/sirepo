'use strict';

app.directive('basicEditorPanel', function(appState, panelState) {
    return {
        scope: {
            modelName: '@',
        },
        template: [
            '<div class="panel panel-info">',
              '<div class="panel-heading" data-panel-heading="{{ panelTitle }}" data-model-name="{{ modelName }}" data-editor-id="{{ editorId }}"></div>',
              '<div class="panel-body cssFade" data-ng-hide="panelState.isHidden(modelName)">',
                '<form name="form" class="form-horizontal" novalidate>',
                  '<div class="form-group form-group-sm" data-ng-repeat="f in basicFields">',
                    '<div data-field-editor="f" data-model-name="modelName" data-model="appState.models[modelName]" class="model-{{modelName}}-{{f}}"></div>',
                  '</div>',
                  '<div data-buttons="" data-model-name="modelName"></div>',
                '</form>',
              '</div>',
            '</div>',
        ].join(''),
        controller: function($scope) {
            $scope.appState = appState;
            $scope.panelState = panelState;
            $scope.basicFields = appState.viewInfo($scope.modelName).basic;
            $scope.panelTitle = appState.viewInfo($scope.modelName).title;
            $scope.editorId = 'srw-' + $scope.modelName + '-editor';
            $scope.isStringField = function(f) {
                return typeof(f) == 'string' ? true : false;
            };
        },
    };
});

app.directive('beamlineIcon', function() {
    return {
        scope: {
            item: '=',
        },
        template: [
            '<svg class="srw-beamline-item-icon" viewbox="0 0 50 60" data-ng-switch="item.type">',
              '<g data-ng-switch-when="lens">',
                '<path d="M25 0 C30 10 30 50 25 60" class="srw-lens" />',
                '<path d="M25 60 C20 50 20 10 25 0" class="srw-lens" />',
              '</g>',
              '<g data-ng-switch-when="aperture">',
                '<rect x="23", y="0", width="5", height="24" class="srw-aperture" />',
                '<rect x="23", y="36", width="5", height="24" class="srw-aperture" />',
              '</g>',
              '<g data-ng-switch-when="mirror">',
                '<rect x="23" y="0" width="5", height="60" class="srw-mirror" />',
              '</g>',
              '<g data-ng-switch-when="obstacle">',
                '<rect x="15" y="20" width="20", height="20" class="srw-obstacle" />',
              '</g>',
              '<g data-ng-switch-when="crl">',
                '<rect x="15", y="0", width="20", height="60" class="srw-crl" />',
                '<path d="M25 0 C30 10 30 50 25 60" class="srw-lens" />',
                '<path d="M25 60 C20 50 20 10 25 0" class="srw-lens" />',
                '<path d="M15 0 C20 10 20 50 15 60" class="srw-lens" />',
                '<path d="M15 60 C10 50 10 10 15 0" class="srw-lens" />',
                '<path d="M35 0 C40 10 40 50 35 60" class="srw-lens" />',
                '<path d="M35 60 C30 50 30 10 35 0" class="srw-lens" />',
              '</g>',
              '<g data-ng-switch-when="watch">',
                '<path d="M5 30 C 15 45 35 45 45 30" class="srw-watch" />',
                '<path d="M45 30 C 35 15 15 15 5 30" class="srw-watch" />',
                '<circle cx="25" cy="30" r="10" class="srw-watch" />',
                '<circle cx="25" cy="30" r="4" class="srw-watch-pupil" />',
              '</g>',
            '</svg>',
        ].join(''),
    };
});

app.directive('beamlineItem', function($timeout) {
    return {
        scope: {
            item: '=',
        },
        template: [
            '<span class="srw-beamline-badge badge">{{ item.position }}m</span>',
            '<span data-ng-click="removeElement(item)" class="srw-beamline-close-icon glyphicon glyphicon-remove-circle"></span>',
            '<div class="srw-beamline-image">',
              '<span data-beamline-icon="", data-item="item"></span>',
            '</div>',
            '<div data-ng-attr-id="srw-item-{{ item.id }}" class="srw-beamline-element-label">{{ item.title }}<span class="caret"></span></div>',
        ].join(''),
        controller: function($scope) {
            $scope.removeElement = function(item) {
                $scope.$parent.beamline.removeElement(item);
            };
        },
        link: function(scope, element) {
            scope.$watchCollection('item', function(newValue, oldValue) {
                if (newValue != oldValue)
                    scope.$parent.beamline.isDirty = true;
            });
            var el = $(element).find('.srw-beamline-element-label');
            el.popover({
                html: true,
                placement: 'bottom',
                container: '.srw-popup-container-lg',
                viewport: { selector: '.srw-beamline'},
                content: $('#srw-' + scope.item.type + '-editor'),
                trigger: 'manual',
            }).on('show.bs.popover', function() {
                scope.$parent.beamline.activeItem = scope.item;
            }).on('shown.bs.popover', function() {
                $('.popover-content .form-control').first().select();
            }).on('hide.bs.popover', function() {
                scope.$parent.beamline.activeItem = null;
                var editor = el.data('bs.popover').getContent();
                // return the editor to the editor-holder so it will be available for the
                // next element of this type
                if (editor)
                    $('.srw-editor-holder').append(editor);
            });

            function togglePopover() {
                $('.srw-beamline-element-label').not(el).popover('hide');
                el.popover('toggle');
                scope.$apply();
            }
            if (scope.$parent.beamline.isTouchscreen()) {
                var hasTouchMove = false;
                $(element).bind('touchstart', function() {
                    hasTouchMove = false;
                });
                $(element).bind('touchend', function() {
                    if (! hasTouchMove)
                        togglePopover();
                    hasTouchMove = false;
                });
                $(element).bind('touchmove', function() {
                    hasTouchMove = true;
                });
            }
            else {
                $(element).click(function() {
                    togglePopover();
                });
            }
            if (scope.item.showPopover) {
                delete scope.item.showPopover;
                // when the item is added, it may have been dropped between items
                // don't show the popover until the position has been determined
                $timeout(function() {
                    var position = el.parent().position().left;
                    var width = $('.srw-beamline-container').width();
                    var itemWidth = el.width();
                    if (position + itemWidth > width) {
                        var scrollPoint = $('.srw-beamline-container').scrollLeft();
                        $('.srw-beamline-container').scrollLeft(position - width + scrollPoint + itemWidth);
                    }
                    el.popover('show');
                }, 500);
            }
            scope.$on('$destroy', function() {
                if (scope.$parent.beamline.isTouchscreen()) {
                    $(element).bind('touchstart', null);
                    $(element).bind('touchend', null);
                    $(element).bind('touchmove', null);
                }
                else {
                    $(element).off();
                }
                var el = $(element).find('.srw-beamline-element-label');
                el.off();
                var popover = el.data('bs.popover');
                // popover has a memory leak with $tip user_data which needs to be cleaned up manually
                if (popover && popover.$tip)
                    popover.$tip.removeData('bs.popover');
                el.popover('destroy');
            });
        },
    };
});

app.directive('beamlineItemEditor', function(appState) {
    return {
        scope: {
            modelName: '@',
        },
        template: [
            '<div>',
              '<form name="form" class="form-horizontal" novalidate>',
                '<div class="form-group form-group-sm" data-ng-repeat="f in advancedFields">',
                  '<div data-field-editor="f" data-model-name="modelName" data-model="beamline.activeItem"></div>',
                '</div>',
                '<div class="form-group">',
                  '<div class="col-sm-offset-6 col-sm-3">',
                    '<button ng-click="beamline.dismissPopup()" style="width: 100%" type="submit" class="btn btn-primary">Close</button>',
                  '</div>',
                '</div>',
                '<div class="form-group" data-ng-show="beamline.isTouchscreen()">',
                  '<div class="col-sm-offset-6 col-sm-3">',
                    '<button ng-click="removeActiveItem()" style="width: 100%" type="submit" class="btn btn-danger">Delete</button>',
                  '</div>',
                '</div>',
              '</form>',
            '</div>',
        ].join(''),
        controller: function($scope) {
            $scope.beamline = $scope.$parent.beamline;
            $scope.advancedFields = appState.viewInfo($scope.modelName).advanced;
            $scope.removeActiveItem = function() {
                $scope.beamline.removeElement($scope.beamline.activeItem);
            }
            //TODO(pjm): investigate why id needs to be set in html for revisiting the beamline page
            //$scope.editorId = 'srw-' + $scope.modelName + '-editor';
        },
    };
});

app.directive('buttons', function(appState) {
    return {
        scope: {
            modelName: '=',
            modalId: '@',
        },
        template: [
            '<div class="col-sm-6 pull-right cssFade" data-ng-show="form.$dirty">',
            '<button data-ng-click="saveChanges()" class="btn btn-primary {{ form.$valid ? \'\' : \'disabled\' }}">Save Changes</button> ',
              '<button data-ng-click="cancelChanges()" class="btn btn-default">Cancel</button>',
            '</div>',
        ].join(''),
        controller: function($scope) {
            $scope.form = $scope.$parent.form;
            function changeDone() {
                $scope.form.$setPristine();
                if ($scope.modalId)
                    $('#' + $scope.modalId).modal('hide');
            }
            $scope.$on($scope.modelName + '.changed', function() {
                changeDone();
            });
            $scope.saveChanges = function() {
                if ($scope.form.$valid)
                    appState.saveChanges($scope.modelName);
            };
            $scope.cancelChanges = function() {
                appState.cancelChanges($scope.modelName);
                changeDone();
            };
        }
    };
});

app.directive('fieldEditor', function(appState, $http) {
    return {
        restirct: 'A',
        scope: {
            fieldEditor: '=',
            model: '=',
            modelName: '=',
            customLabel: '=',
            labelSize: "@",
            numberSize: "@",
            isReadOnly: "=",
        },
        template: [
            '<label data-ng-hide="customLabel" class="col-sm-{{ labelSize || \'5\' }} control-label">{{ info[0] }}</label>',
            '<label data-ng-show="customLabel" class="col-sm-{{ labelSize || \'5\' }} control-label">{{ customLabel }}</label>',
            '<div data-ng-switch="info[1]">',
              '<div data-ng-switch-when="BeamList" class="col-sm-5">',
                '<div class="dropdown">',
                  '<button class="btn btn-default dropdown-toggle form-control" type="button" data-toggle="dropdown">{{ model[fieldEditor] }}</button>',
                  '<ul class="dropdown-menu">',
                    '<li class="dropdown-header">Predefined Electron Beams</li>',
                    '<li data-ng-repeat="item in appState.beams track by item.name">',
                      '<a href data-ng-click="selectBeam(item)">{{ item.name }}</a>',
                    '</li>',
                    '<li class="divider"></li>',
                    '<li class="dropdown-header">User Defined Electron Beams</li>',
                    '<li data-ng-repeat="item in appState.models.electronBeams track by item.name">',
                      '<a href data-ng-click="selectBeam(item)">{{ item.name }}</a>',
                    '</li>',
                    '<li><a href data-ng-click="newUserDefinedBeam()"><span class="glyphicon glyphicon-plus"></span> New</a></li>',
                  '</ul>',
                '</div>',
              '</div>',
              '<div data-ng-switch-when="Float" class="col-sm-{{ numberSize || \'3\' }}">',
                '<input string-to-number="" data-ng-model="model[fieldEditor]" class="form-control" style="text-align: right" data-ng-readonly="isReadOnly">',
              '</div>',
              '<div data-ng-switch-when="Integer" class="col-sm-{{ numberSize || \'3\' }}">',
                '<input data-ng-model="model[fieldEditor]" class="form-control" style="text-align: right" data-ng-readonly="isReadOnly">',
              '</div>',
              //TODO(pjm): need file interface
              '<div data-ng-switch-when="File" class="col-sm-5">',
                '<p class="form-control-static"><a href="/static/dat/mirror_1d.dat"><span class="glyphicon glyphicon-file"></span> mirror_1d.dat</a></p>',
              '</div>',
              '<div data-ng-switch-when="String" class="col-sm-5">',
                '<input data-ng-model="model[fieldEditor]" class="form-control" required data-ng-readonly="isReadOnly">',
              '</div>',
              // assume it is an enum
              '<div data-ng-switch-default class="col-sm-5">',
                '<select number-to-string class="form-control" data-ng-model="model[fieldEditor]" data-ng-options="item[0] as item[1] for item in enum[info[1]]"></select>',
              '</div>',
            '</div>',
        ].join(''),
        controller: function($scope) {
            $scope.appState = appState;

            var match = $scope.fieldEditor.match(/(.*?)\.(.*)/);
            if (match) {
                $scope.modelName = match[1];
                $scope.fieldEditor = match[2];
            }

            // field def: [label, type]
            $scope.info = appState.modelInfo($scope.modelName)[$scope.fieldEditor];
            $scope.selectBeam = function(item) {
                $scope.model = item;
                $scope.model[$scope.fieldEditor] = item.name;
                $scope.$parent.form.$setDirty();
            };
            $scope.newUserDefinedBeam = function() {
                // copy the current beam, rename and show editor
                appState.addNewElectronBeam();
                $('#srw-electronBeam-editor').modal('show');
            };
        },
        link: function link(scope) {
            scope.enum = APP_SCHEMA.enum;
            //TODO(pjm): move list loading logic into pre angular load, along with schema.json
            if (scope.info[1] == 'BeamList') {
                if (appState.beams)
                    return;
                $http['get']('/static/json/beams.json?' + SIREPO_APP_VERSION)
                    .success(function(data, status) {
                        appState.beams = data;
                    })
                    .error(function() {
                        console.log('get beams.json failed!');
                    });
            }
        },
    };
});

app.directive('columnEditor', function(appState) {
    return {
        scope: {
            columnFields: '=',
            modelName: '=',
            fullModelName: '=',
            isReadOnly: '=',
        },
        template: [
            '<div class="row">',
              '<div class="col-sm-6" data-ng-repeat="col in columnFields">',
                '<div class="lead text-center">{{ col[0] }}</div>',
                '<div class="form-group form-group-sm" data-ng-repeat="f in col[1]">',
                  '<div data-field-editor="f" data-label-size="7" data-number-size="5" data-custom-label="customLabel(col[0], f)" data-model-name="modelName" data-model="appState.models[fullModelName]" data-is-read-only="isReadOnly" class="model-{{modelName}}-{{f}}"></div>',
                '</div>',
              '</div>',
            '</div>',
        ].join(''),
        controller: function($scope) {
            $scope.appState = appState;
            $scope.customLabel = function(heading, f) {
                var info = appState.modelInfo($scope.modelName)[f];
                var label = info[0];
                heading = heading.replace(/ .*/, '');
                label = label.replace(heading, '');
                return label;
            };
        },
        link: function(scope, element) {
        },
    };
});

app.directive('modalEditor', function(appState) {
    return {
        scope: {
            modalEditor: '@',
            // optional, for watch reports
            itemId: '@',
            isReadOnly: '=',
        },
        template: [
            '<div class="modal fade" id="{{ editorId }}" tabindex="-1" role="dialog">',
              '<div class="modal-dialog modal-lg">',
                '<div class="modal-content">',
                  '<div class="modal-header bg-info">',
  	            '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>',
	            '<span class="lead modal-title text-info">{{ appState.getReportTitle(fullModelName) }}</span>',
	          '</div>',
                  '<div class="modal-body">',
                    '<div class="container-fluid">',
                      '<div class="row">',
                        '<form name="form" class="form-horizontal" novalidate>',
                          '<div data-ng-repeat="f in advancedFields">',
                            '<div class="form-group form-group-sm model-{{modalEditor}}-{{f}}" data-ng-if="isStringField(f)" data-field-editor="f" data-model-name="modalEditor" data-model="appState.models[fullModelName]" data-is-read-only="isReadOnly"></div>',
                            '<div data-ng-if="! isStringField(f)" data-column-editor="" data-column-fields="f" data-model-name="modalEditor" data-full-model-name="fullModelName" data-is-read-only="isReadOnly"></div>',
                          '</div>',
                          '<div data-buttons="" data-model-name="fullModelName" data-modal-id="{{ editorId }}"></div>',
                        '</form>',
                      '</div>',
                    '</div>',
                  '</div>',
                '</div>',
              '</div>',
            '</div>',
        ].join(''),
        controller: function($scope) {
            $scope.appState = appState;
            $scope.advancedFields = appState.viewInfo($scope.modalEditor).advanced;
            $scope.fullModelName = $scope.modalEditor + ($scope.itemId || '');
            $scope.editorId = 'srw-' + $scope.fullModelName + '-editor';
            $scope.isStringField = function(f) {
                return typeof(f) == 'string' ? true : false;
            };
        },
        link: function(scope, element) {
            $(element).on('shown.bs.modal', function() {
                if (! scope.isReadOnly)
                    $('#' + scope.editorId + ' .form-control').first().select();
            });
            $(element).on('hidden.bs.modal', function(e) {
                // ensure that a dismissed modal doesn't keep changes
                // ok processing will have already saved data before the modal is hidden
                appState.cancelChanges(scope.fullModelName);
                scope.$apply();
            });
            scope.$on('$destroy', function() {
                // release modal data to prevent memory leak
                $(element).off();
                $('.modal').modal('hide').removeData('bs.modal');
            });
        },
    };
});

app.directive('numberToString', function() {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, element, attrs, ngModel) {
            ngModel.$parsers.push(function(value) {
                if (ngModel.$isEmpty(value))
                    return null;
                return '' + value;
            });
            ngModel.$formatters.push(function(value) {
                if (ngModel.$isEmpty(value))
                    return value;
                return value.toString();
            });
        }
    };
});

app.directive('panelHeading', function(panelState, appState) {
    return {
        restrict: 'A',
        scope: {
            panelHeading: '@',
            modelName: '@',
            editorId: '@',
            allowFullScreen: '@',
        },
        controller: function($scope) {
            $scope.panelState = panelState;
            $scope.showEditor = function() {
                $('#' + $scope.editorId).modal('show');
            };
            $scope.showAdvancedEditor = appState.viewInfo($scope.modelName)
                && appState.viewInfo($scope.modelName).advanced.length == 0 ? false : true;
        },
        template: [
            '<span class="lead">{{ panelHeading }}</span>',
            '<div class="srw-panel-options pull-right">',
            '<a href data-ng-show="showAdvancedEditor" data-ng-click="showEditor()" title="Edit"><span class="lead glyphicon glyphicon-pencil"></span></a> ',
            //'<a href data-ng-show="allowFullScreen" title="Download"><span class="lead glyphicon glyphicon-cloud-download"></span></a> ',
            //'<a href data-ng-show="allowFullScreen" title="Full screen"><span class="lead glyphicon glyphicon-fullscreen"></span></a> ',
            '<a href data-ng-click="panelState.toggleHidden(modelName)" data-ng-hide="panelState.isHidden(modelName)" title="Hide"><span class="lead glyphicon glyphicon-triangle-top"></span></a> ',
            '<a href data-ng-click="panelState.toggleHidden(modelName)" data-ng-show="panelState.isHidden(modelName)" title="Show"><span class="lead glyphicon glyphicon-triangle-bottom"></span></a>',
            '</div>',
        ].join(''),
    };
});

app.directive('reportPanel', function(appState, panelState) {
    return {
        restrict: 'A',
        scope: {
            reportPanel: '@',
            modelName: '@',
            // optional, for watch reports
            item: '=',
        },
        template: [
            '<div class="panel panel-info">',
              '<div class="panel-heading" data-panel-heading="{{ appState.getReportTitle(fullModelName) }}" data-model-name="{{ fullModelName }}" data-editor-id="{{ editorId }}" data-allow-full-screen="1"></div>',

              '<div data-ng-class="{\'srw-panel-loading\': panelState.isLoading(fullModelName), \'srw-panel-error\': panelState.getError(fullModelName)}" class="panel-body cssFade" data-ng-hide="panelState.isHidden(fullModelName)">',
            '<div data-ng-show="panelState.isLoading(fullModelName)" class="lead srw-panel-wait"><span class="glyphicon glyphicon-hourglass"></span> Refreshing...</div>',
            '<div data-ng-show="panelState.getError(fullModelName)" class="lead srw-panel-wait"><span class="glyphicon glyphicon-exclamation-sign"></span> {{ panelState.getError(fullModelName) }}</div>',

                '<div data-ng-switch="reportPanel" class="{{ panelState.getError(fullModelName) ? \'srw-hide-report\' : \'\' }}">',
                  '<div data-ng-switch-when="2d" data-plot2d="" class="srw-plot" data-model-name="{{ fullModelName }}"></div>',
                  '<div data-ng-switch-when="3d" data-plot3d="" class="srw-plot" data-model-name="{{ fullModelName }}"></div>',
                  '<div data-ng-switch-when="heatmap" data-heatmap="" class="srw-plot" data-model-name="{{ fullModelName }}"></div>',
                '</div>',
              '</div>',
            '</div>',
        ].join(''),
        controller: function($scope) {
            var itemId = $scope.item ? $scope.item.id : '';
            $scope.appState = appState;
            $scope.panelState = panelState;
            $scope.fullModelName = $scope.modelName + itemId;
            $scope.editorId = 'srw-' + $scope.fullModelName + '-editor';
        },
    };
});

app.directive('stringToNumber', function() {
    var NUMBER_REGEXP = /^\s*(\-|\+)?(\d+|(\d*(\.\d*)))([eE][+-]?\d+)?\s*$/;
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, element, attrs, ngModel) {
            ngModel.$parsers.push(function(value) {
                if (ngModel.$isEmpty(value))
                    return null;
                if (NUMBER_REGEXP.test(value))
                    return parseFloat(value);
                return undefined;
            });
            ngModel.$formatters.push(function(value) {
                if (ngModel.$isEmpty(value))
                    return value;
                return value.toString();
            });
        }
    };
});
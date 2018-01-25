var moment = require('moment');
var $ = require('jquery');

angular.module('angular-lightning.datepicker', [])

.constant('DateConfig', {
	numWeeksShown: 6,
	dateFormat: 'MM/DD/YYYY',
	dateModel: 'YYYY-MM-DD',
	dateTimeFormat: 'MM/DD/YYYY hh:mm A',
	datetimeModel: 'YYYY-MM-DD HH:mm:ss'
})

.value('iconConfig', {
	iconUrl: '/apexpages/slds/latest/assets/icons/'
})
.directive('ngModel', function( $filter ) {
    return {
        require: '?ngModel',
        link: function(scope, elem, attr, ngModel) {
            if( !ngModel )
                return;
            if( attr.type !== 'time' )
                return;
                    
            ngModel.$formatters.unshift(function(value) {
                return value.replace(/:00\.000$/, '')
            });
        }
    }   
})   
.service('DateService', ['DateConfig','$rootScope', function(DateConfig,$rootScope) {
	'use strict';

	var Day = function(startMoment, currentMonth) {
		this.moment = startMoment.clone();
		this.label = this.moment.format('D');
		this.inCurrentMonth = (startMoment.month() === currentMonth);
		return this;
	};

	var Week = function(startMoment) {
		this.days = [];
		var start = startMoment.clone();
		var currentMonth = startMoment.month();
		start = startMoment.startOf('week');
		for(var i=0; i<7; i++) {
			this.days.push(new Day(start, $rootScope.currentMonth));
			start = start.add('1', 'days');
		}
		return this;
	};

	var Month = function(startMoment) {
		this.weeks = [];
		this.label = startMoment.format('MMMM');
		this.year = startMoment.format('YYYY');
		var start = this.currentDate = startMoment.clone();
		start = start.startOf('month');
		for(var i=0; i<DateConfig.numWeeksShown; i++) {
			var startWeek = start.clone().add(i, 'weeks');
			this.weeks.push(new Week(startWeek));
		}
		return this;
	};

	var Year = function(startMoment) {
		this.moment = startMoment.clone();
		this.label = startMoment.format('YYYY');
		return this;
	};

	return {
		getDate: function(value) {
			if(value) {
				return moment(value);
			}
			else {
				return null;
			}

		},
		buildMonth: function(currentDate) {
			var start = currentDate.clone();
			$rootScope.currentMonth=start.month();
			return new Month(start);
		},
		buildYearsAroundCurrent: function(currentYearMoment) {
			var years = [];
			var startYear = currentYearMoment.clone();
			for(var i=0; i<9; i++) {
				years.push(new Year(startYear.clone().subtract(4-i, 'years')));
			}
			return years;
		}
	};
}])

.controller('DateDropdownController', ['$scope', '$document', 'DateService', '$compile', 'DateConfig', function(_originalScope, $document, DateService, $compile, DateConfig) {
	'use strict';

	var self = this;
	var ngModelCtrl, inputEl, $popup, $yearPicker, $scope;

	var dateFormat = DateConfig.dateFormat;
	var dateModel = DateConfig.dateModel;

	$scope = _originalScope;

	var _buildCalendar = function() {
		if(ngModelCtrl.$modelValue) {
			$scope.month = DateService.buildMonth(moment(ngModelCtrl.$modelValue, dateModel));
		}
		else {
			$scope.month = DateService.buildMonth(moment());
		}

		// only render if its not rendered already
		if(!$popup) {
			var popupEl = angular.element('<div li-date-dropdown ng-show="isOpen" ng-click="isOpen = true"></div>');

			$popup = $compile(popupEl)($scope);

			$(inputEl).after($popup);
		}

	};

	this.init = function(element, controllers, attrs) {
		this.controllers = controllers;
		this.element = inputEl = element;

		$scope.showTime = false;
		if (attrs.datepickerType && attrs.datepickerType === 'datetime') {
			dateFormat = DateConfig.dateTimeFormat;
			dateModel = DateConfig.datetimeModel;
			$scope.showTime = true;
		}

		ngModelCtrl = controllers[1];

		ngModelCtrl.$parsers.push(function(value) {
			if (value) {
				value = moment(value);

				$scope.hour = value.hour();
				if (value.format('A') === 'PM') {
					$scope.hour -= 12;
				}
				$scope.minute = value.minute();
				$scope.ampm = value.format('A');

				return value.format(dateModel);
			}
			else {
				return null;
			}
		});

		ngModelCtrl.$formatters.push(function(value) {
			if (value && moment.isMoment(value)) {
				$scope.hour = value.hour();
				if (value.format('A') === 'PM') {
					$scope.hour -= 12;
				}
				$scope.minute = value.minute();
				$scope.ampm = value.format('A');
				_buildCalendar();
				return value.format(dateFormat);
			}
			_buildCalendar();
		});

		var unwatch = $scope.$watch(function() {
			if (ngModelCtrl.$modelValue) {
				return moment(ngModelCtrl.$modelValue, dateModel);
			}
		}, function(val) {
			if (val) {
				var theDate = DateService.getDate(val);
				theDate.second(0);
				ngModelCtrl.$setViewValue(theDate.format(dateFormat));
				ngModelCtrl.$render();
			}

			unwatch();
			_buildCalendar();
		});

		inputEl.bind('focus', function() {
			$scope.isOpen = true;
			$scope.yearPickerOpen = false;
			$scope.$digest();
		});

		// ngModelCtrl.$render = function() {
		// 	console.log(ngModelCtrl);
		// }

	};

	var documentClickBind = function(event) {
		// check if the click event contains the dropdown or the input itself, if it contains neither, don't set isOpen false, otherwise do.
		// todo: this requires Jquery - i would love to get rid of this dependency by registering the popup as a dom element in this directive

		//var clickedElementIsInInput = $(self.element)[0].contains(event.target);
		//var clickedElementIsInPopupElement = $(self.element).parents('.slds-form-element').siblings('.smb-date-dropdown')[0].contains(event.target);

		var clickedElementIsInInput = inputEl[0].contains(event.target);
		var clickedElementIsInPopup = $popup[0].contains(event.target);

		if($scope.isOpen && !(clickedElementIsInInput || clickedElementIsInPopup )) {
			$scope.isOpen = false;
			$scope.$apply();
		}
	};

	$scope.$watch('isOpen', function(value) {
		if(value) {
			$document.bind('click', documentClickBind);
		}
		else {
			$document.unbind('click', documentClickBind);
		}
	});

	//build the calendar around the current date
	$scope.month = {};

	$scope.$watch('yearPickerOpen', function(val) {
		if(val) {

			// if its already created then do nothing
			if($yearPicker) {
				return;
			}

			var yearPickerEl = angular.element('<span li-date-year-picker></span>');
			yearPickerEl.attr({
				'current-year' : 'getCurrentDate()'
			});

			$yearPicker = $compile(yearPickerEl)($scope);
			$($popup).find('#year').after($yearPicker);
		}

	});

	$scope.getCurrentDate = function() {
		if(ngModelCtrl.$modelValue) {
			return moment(ngModelCtrl.$modelValue, dateModel);
		}
		else {
			return moment();
		}
	};

	$scope.getCurrentDateAsMoment = function() {
		return moment(ngModelCtrl.$modelValue, dateModel);
	};

	$scope.nextMonth = function() {
		var currentStart = moment($scope.month.currentDate).clone().startOf('month');
		$scope.month = DateService.buildMonth(currentStart.add('1', 'month'));
	};
	$scope.previousMonth = function() {
		var currentStart = moment($scope.month.currentDate).clone().startOf('month');
		$scope.month = DateService.buildMonth(currentStart.subtract('1', 'month'));
	};
	$scope.selectDay = function(day) {
		ngModelCtrl.$setViewValue(day.moment.format(dateFormat));
		ngModelCtrl.$render();
	};
	$scope.selectYear = function(year) {
		ngModelCtrl.$setViewValue(year.format(dateFormat));
		ngModelCtrl.$render();
		$scope.month = DateService.buildMonth(moment(ngModelCtrl.$modelValue, dateModel));
	};

	$scope.changeHour = function(val) {
		val = Number(val);
		var momentModel = DateService.getDate(ngModelCtrl.$modelValue);

		if (momentModel.format('A') === 'PM') {
			val += 12;
		}
		momentModel.hour(val);
		ngModelCtrl.$setViewValue(momentModel.format(dateFormat));
		ngModelCtrl.$render();

		$scope.ampm = momentModel.format('A');
	};
	$scope.changeMinute = function(val) {
		var momentModel = DateService.getDate(ngModelCtrl.$modelValue);

		momentModel.minute(val);
		ngModelCtrl.$setViewValue(momentModel.format(dateFormat));
		ngModelCtrl.$render();
	};
	$scope.changeAMPM = function() {
		var momentModel = DateService.getDate(ngModelCtrl.$modelValue);

		if (momentModel.format('A') === 'AM') {
			momentModel.add(12, 'hours');
		}
		else {
			momentModel.subtract(12, 'hours');
		}

		ngModelCtrl.$setViewValue(momentModel.format(dateFormat));
		ngModelCtrl.$render();

		$scope.ampm = momentModel.format('A');
	};

	return this;
}])
.directive('liIcon', ['iconConfig', function(iconConfig) {
	'use strict'; 
	return {
		template: require('../../views/util/icon.html'), 
		scope: {

		},
		replace: true,
		link: function(scope, element, attrs) {
			var options =({
				type: attrs.type,
				icon: attrs.icon,
				size: attrs.size,
				color: attrs.color,
				classes: attrs.addClasses,
				noDefaultIcon: attrs.noDefaultIcon
			}); 

			scope.options = options;

			var url=iconConfig.iconUrl;
			var classes = [];

			var svgElement = $(element).find('svg');

			var useElement = $(element).find('use');
			var newRef = url + options.type + '-sprite/svg/symbols.svg#' + options.icon;
			$(useElement).attr('xlink:href', newRef);

			if(options.type === 'action') {
				$(element).addClass('slds-icon__container--circle slds-media__figure');
			}
		
			// todo .. make this just append the slds-icon-text-[whatever color]
			if(options.color) {
				if(options.color === 'warning') {
					classes.push('slds-icon-text-warning');
				}
				else if(options.color === 'default') {
					classes.push('slds-icon-text-default');	
				}
				else if(options.color === 'success') {
					classes.push('slds-icon-text-success');
				}
			}
			else {
				//classes.push('slds-icon-text-default');	
			}
			

			// apply the color and style w/ icon specific class
			// if its a icon like new_custom4 we need the class to be new-custom-4 but the iconpath will be the un-changed new_custom4 (stupid!)
			var adjustedClass = options.icon.replace(/([A-Z]+)(_.*?)*(\d*)/ig, function(match, p1, p2, p3) {
				if(p3) {
					// we have a digit, so we'll concat p1 and p3
					return p1 + '-' + p3;
				}
				else if(p2) {
					return p1 + '-';
				}
				else {
					return match;
				}
			});

			var colorclass = 'slds-icon-' + options.type + '-' + adjustedClass;
			if(options.type !== 'utility') {
				$(element).addClass(colorclass);
				//classes.push(colorclass);
			}
			else {
				//$(svgElement).addClass('slds-icon');
				
			}

			// always add 
			if(!options.noDefaultIcon) {
				classes.push('slds-icon');	
			}
			
			// if(options.inputIcon) {
			// 	classes.push('slds-input__icon');
			// }
			if(options.classes) {
				classes = classes.concat(options.classes.split(' '));
			}
			
			// push size
			//classes.push('slds-icon--small');
			if(options.size === 'large') {
				classes.push('slds-icon--large');
			}
			else if(options.size === 'small') {
				classes.push('slds-icon--small');
			}
			else if(options.size === 'x-small') {
				classes.push('slds-icon--x-small');
			}

			scope.classes = classes.join(' ');


		}
	};
}])
.directive('liDatepicker', ['DateService', function(DateService) {
	'use strict';
	return {
		require: ['liDatepicker','ngModel'],
		controller: 'DateDropdownController',
		scope: true,
		link: function(scope, element, attrs, controllers) {
			controllers[0].init(element, controllers, attrs);
			return this;
		}
	};
}])

.directive('liDateDropdown', [function() {
	'use strict';
	return {
		template: require('../../views/fields/date/field-date-dropdown.html'),
		//require: ['smbFieldDateDropdown', '^smbFieldDate'],
		//controller: 'DateDropdownController',
		link: function(scope, element, attrs, controllers) {
			//controllers[0].init(element, controllers);
			//return this;
		}
	};
}])

.directive('liDateYearPicker', ['DateService', function(DateService) {
	'use strict';
	return {
		template: require('../../views/fields/date/field-date-yearpicker.html'),
		link: function(scope, element, attrs, controllers) {
			var currentIndex = 0;
			var currentYear;

			if (moment.isMoment(scope.getCurrentDate()) && scope.getCurrentDate().isValid()) {
				currentYear = moment(scope.getCurrentDate()).clone();
			}
			else {
				currentYear = moment();
			}

			scope.years = DateService.buildYearsAroundCurrent(currentYear);

			scope.yearNextPage = function() {
				currentIndex = currentIndex + 1;
				scope.years = DateService.buildYearsAroundCurrent(currentYear.clone().add(currentIndex*9, 'years'));
			};

			scope.yearPrevPage = function() {
				currentIndex = currentIndex - 1;
				scope.years = DateService.buildYearsAroundCurrent(currentYear.clone().add(currentIndex*9, 'years'));
			};
		}
	};
}])

;

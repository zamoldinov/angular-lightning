angular.module('angular-lightning.datepicker', [])

.constant('DateConfig', {
	numWeeksShown: 5
})

.service('DateService', ['DateConfig', function(DateConfig) {
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
			this.days.push(new Day(start, currentMonth));
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
			return moment(value);
		},
		buildMonth: function(currentDate) {
			var start = currentDate.clone();
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

.controller('DateDropdownController', ['$scope', '$document', 'DateService', '$compile', function($scope, $document, DateService, $compile) {
	'use strict';

	var self = this;
	var ngModelCtrl, inputEl, $popup, $yearPicker;

	this.init = function(element, controllers) {
		this.controllers = controllers;
		this.element = inputEl = element;
		ngModelCtrl = controllers[2];

		var unwatch = $scope.$watch(function() {
			return ngModelCtrl.$modelValue;
		}, function(val) {
			console.log(val);
			ngModelCtrl.$setViewValue(DateService.getDate(val));
			unwatch();
			_buildCalendar();
		});

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
	
	var _buildCalendar = function() {
		if(ngModelCtrl.$modelValue) {
			$scope.month = DateService.buildMonth(ngModelCtrl.$modelValue);
		}
		else { 
			$scope.month = DateService.buildMonth(moment());
		}

		var popupEl = angular.element('<div smb-field-date-dropdown ng-show="isOpen" ng-click="isOpen = true" class="smb-date-dropdown"></div>');

		$popup = $compile(popupEl)($scope);
		$(inputEl).after($popup);


	};

	$scope.$watch('yearPickerOpen', function(val) {
		if(val) {

			// if its already created then do nothing
			if($yearPicker) {
				return;
			}

			var yearPickerEl = angular.element('<span smb-field-date-year-picker></span>');
			yearPickerEl.attr({
				'current-year' : 'getCurrentDate()'
			});	

			$yearPicker = $compile(yearPickerEl)($scope);
			$($popup).find('#year').after($yearPicker);
		}
	
	});

	$scope.getCurrentDate = function() { 
		return ngModelCtrl.$modelValue;
	};

	$scope.nextMonth = function() {
		var currentStart = $scope.month.currentDate.clone().startOf('month');
		$scope.month = DateService.buildMonth(currentStart.add('1', 'month'));
	};
	$scope.previousMonth = function() {
		var currentStart = $scope.month.currentDate.clone().startOf('month');
		$scope.month = DateService.buildMonth(currentStart.subtract('1', 'month'));
	};
	$scope.selectDay = function(day) {
		ngModelCtrl.$setViewValue(day.moment);
		ngModelCtrl.$render();
	};
	$scope.selectYear = function(year) {
		ngModelCtrl.$setViewValue(year);
		ngModelCtrl.$render();
		$scope.month = DateService.buildMonth(ngModelCtrl.$modelValue);
	};

	return this;	
}])

.directive('smbFieldDate', ['DateService', function(DateService) {
	'use strict';
	return {
		templateUrl: 'views/fields/date/field-date.html',
		require: ['smbFieldDate'],
		controller: function($scope) {
			this.init = function(element, controllers) {
				this.controllers = controllers;
				this.element = element;		
			};

			return this;
		},
		link: function(scope, element, attrs, controllers) {
			controllers[0].init(element, controllers);
			return this;
		}
	};
}])

.directive('smbFieldDateInput', ['DateService', function(DateService) {
	'use strict';
	return {
		require: ['smbFieldDateInput','?^smbFieldDate', 'ngModel'],
		controller: 'DateDropdownController',
		// controller: function($scope) {


		// 	this.init = function(element, controllers) {				
		// 		this.controllers = controllers;
		// 		this.element =  element;
		// 		var ngModelCtrl = controllers[2];

		// 		// turn the date string into a Date object (should turn into moment for future purposes)
		// 		//$scope.field.value = DateService.getDate($scope.field.value);
		// 		// ngModelCtrl.$setViewValue(DateService.getDate(ngModelCtrl.$viewValue));
		// 		var unwatch = $scope.$watch(function() {
		// 			return ngModelCtrl.$modelValue;
		// 		}, function(val) {
		// 			console.log(val);
		// 			ngModelCtrl.$setViewValue(DateService.getDate(val));
		// 			unwatch();
		// 		});
				
		// 	};

		// 	return this;
		// },
		link: function(scope, element, attrs, controllers) {
			controllers[0].init(element, controllers);
			return this;
		}
	};
}])

.directive('smbFieldDateDropdown', [function() {
	'use strict';
	return {
		templateUrl: 'views/fields/date/field-date-dropdown.html',
		//require: ['smbFieldDateDropdown', '^smbFieldDate'],
		//controller: 'DateDropdownController',
		link: function(scope, element, attrs, controllers) {
			//controllers[0].init(element, controllers);
			//return this;
		}
	};
}])

.directive('smbFieldDateYearPicker', ['DateService', function(DateService) {
	'use strict';
	return {
		templateUrl: 'views/fields/date/field-date-yearpicker.html',
		link: function(scope, element, attrs, controllers) {
			var currentIndex = 0;
			var currentYear = scope.getCurrentDate().clone();
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
}]);
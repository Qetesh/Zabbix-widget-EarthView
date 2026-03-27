<?php declare(strict_types = 0);

namespace Modules\EarthView\Actions;

use API,
	CControllerDashboardWidgetView,
	CControllerResponseData,
	CSeverityHelper;

class WidgetView extends CControllerDashboardWidgetView {

	private const NO_PROBLEMS_MARKER_COLOR = '#009900';

	protected function init(): void {
		parent::init();

		$this->addValidationRules([
			'with_config' => 'in 1',
			'widgetid' => 'db widget.widgetid',
			'unique_id' => 'required|string'
		]);
	}

	protected function doAction(): void {
		$hosts = $this->getHosts();

		$data = [
			'name' => $this->getInput('name', $this->widget->getDefaultName()),
			'user' => [
				'debug_mode' => $this->getDebugMode()
			],
			'unique_id' => $this->getInput('unique_id'),
			'vars' => [
				'hosts' => self::convertToMarkers($hosts)
			]
		];

		if ($this->hasInput('with_config')) {
			$data['vars']['config'] = [
				'severities' => self::getSeveritySettings()
			];
		}

		$data['vars']['fields_values'] = [
			'dark_mode' => (int) $this->fields_values['dark_mode'],
			'auto_rotate' => (int) $this->fields_values['auto_rotate'],
			'rotation_speed' => (float) $this->fields_values['rotation_speed'],
			'initial_lat' => (float) $this->fields_values['initial_lat'],
			'initial_lon' => (float) $this->fields_values['initial_lon']
		];

		$this->setResponse(new CControllerResponseData($data));
	}

	private function getHosts(): array {
		if ($this->isTemplateDashboard()) {
			if ($this->fields_values['override_hostid']) {
				$hosts = API::Host()->get([
					'output' => ['hostid', 'name'],
					'selectInventory' => ['location_lat', 'location_lon'],
					'hostids' => $this->fields_values['override_hostid'],
					'filter' => [
						'inventory_mode' => [HOST_INVENTORY_MANUAL, HOST_INVENTORY_AUTOMATIC]
					],
					'monitored_hosts' => true,
					'preservekeys' => true
				]);
			}
			else {
				return [];
			}
		}
		else {
			$filter_groupids = $this->fields_values['groupids'] ? getSubGroups($this->fields_values['groupids']) : null;

			$hosts = API::Host()->get([
				'output' => ['hostid', 'name'],
				'selectInventory' => ['location_lat', 'location_lon'],
				'groupids' => $filter_groupids,
				'hostids' => $this->fields_values['hostids'] ?: null,
				'evaltype' => $this->fields_values['evaltype'],
				'tags' => $this->fields_values['tags'],
				'filter' => [
					'inventory_mode' => [HOST_INVENTORY_MANUAL, HOST_INVENTORY_AUTOMATIC]
				],
				'monitored_hosts' => true,
				'preservekeys' => true
			]);
		}

		$hosts = array_filter($hosts, static function ($host) {
			$lat = $host['inventory']['location_lat'];
			$lng = $host['inventory']['location_lon'];

			return (is_numeric($lat) && $lat >= GEOMAP_LAT_MIN && $lat <= GEOMAP_LAT_MAX
				&& is_numeric($lng) && $lng >= GEOMAP_LNG_MIN && $lng <= GEOMAP_LNG_MAX);
		});

		$triggers = API::Trigger()->get([
			'output' => [],
			'selectHosts' => ['hostid'],
			'hostids' => array_keys($hosts),
			'filter' => [
				'value' => TRIGGER_VALUE_TRUE
			],
			'monitored' => true,
			'preservekeys' => true
		]);

		$problems = API::Problem()->get([
			'output' => ['objectid', 'severity'],
			'objectids' => array_keys($triggers),
			'symptom' => false
		]);

		$problems_by_host = [];
		foreach ($problems as $problem) {
			foreach ($triggers[$problem['objectid']]['hosts'] as $trigger_host) {
				if (!array_key_exists($trigger_host['hostid'], $problems_by_host)) {
					$problems_by_host[$trigger_host['hostid']] = [
						TRIGGER_SEVERITY_DISASTER => 0,
						TRIGGER_SEVERITY_HIGH => 0,
						TRIGGER_SEVERITY_AVERAGE => 0,
						TRIGGER_SEVERITY_WARNING => 0,
						TRIGGER_SEVERITY_INFORMATION => 0,
						TRIGGER_SEVERITY_NOT_CLASSIFIED => 0
					];
				}

				$problems_by_host[$trigger_host['hostid']][$problem['severity']]++;
			}
		}

		$result_hosts = [];
		foreach ($hosts as $host) {
			$problems = array_key_exists($host['hostid'], $problems_by_host)
				? $problems_by_host[$host['hostid']]
				: [
					TRIGGER_SEVERITY_DISASTER => 0,
					TRIGGER_SEVERITY_HIGH => 0,
					TRIGGER_SEVERITY_AVERAGE => 0,
					TRIGGER_SEVERITY_WARNING => 0,
					TRIGGER_SEVERITY_INFORMATION => 0,
					TRIGGER_SEVERITY_NOT_CLASSIFIED => 0
				];

			$result_hosts[] = $host + ['problems' => $problems];
		}

		return $result_hosts;
	}

	private static function getSeveritySettings(): array {
		$severity_config = [
			-1 => [
				'name' => _('No problems'),
				'color' => self::NO_PROBLEMS_MARKER_COLOR,
				'style' => ''
			]
		];

		$severities = CSeverityHelper::getSeverities();

		foreach ($severities as $severity) {
			$severity_config[$severity['value']] = [
				'name' => $severity['label'],
				'color' => '#'.CSeverityHelper::getColor($severity['value']),
				'style' => $severity['style']
			];
		}

		return $severity_config;
	}

	/**
	 * Convert hosts to flat marker array for the 3D globe.
	 */
	private static function convertToMarkers(array $hosts): array {
		$markers = [];

		foreach ($hosts as $host) {
			$problems = array_filter($host['problems']);
			$severities = array_keys($problems);
			$top_severity = reset($severities);

			$markers[] = [
				'hostid' => $host['hostid'],
				'name' => $host['name'],
				'lat' => (float) $host['inventory']['location_lat'],
				'lon' => (float) $host['inventory']['location_lon'],
				'severity' => ($top_severity === false) ? -1 : (int) $top_severity,
				'problems' => $problems
			];
		}

		return $markers;
	}
}

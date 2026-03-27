<?php declare(strict_types = 0);

namespace Modules\EarthView;

use Zabbix\Core\CWidget;

class Widget extends CWidget {

	public const DARK_MODE_OFF = 0;
	public const DARK_MODE_ON = 1;
	public const DARK_MODE_AUTO = 2;

	public function getDefaultName(): string {
		return _('Earth View');
	}

	public function getTranslationStrings(): array {
		return [
			'class.widget.js' => [
				'Host' => _('Host')
			]
		];
	}
}

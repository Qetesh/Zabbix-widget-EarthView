<?php declare(strict_types = 0);

/**
 * Earth View widget view.
 *
 * @var CView $this
 * @var array $data
 */

$view = new CWidgetView($data);

foreach ($data['vars'] as $name => $value) {
	$view->setVar($name, $value);
}

$view
	->addItem([
		(new CDiv())
			->setId($data['unique_id'])
			->addClass('earth-view-container')
			->addItem([
				(new CTag('canvas', true))
					->addClass('earth-view-canvas'),
				(new CDiv())
					->addClass('earth-view-overlay')
			])
	])
	->show();

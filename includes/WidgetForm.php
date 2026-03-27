<?php declare(strict_types = 0);


namespace Modules\EarthView\Includes;

use Modules\EarthView\Widget;

use Zabbix\Widgets\CWidgetForm;

use Zabbix\Widgets\Fields\{
	CWidgetFieldCheckBox,
	CWidgetFieldMultiSelectGroup,
	CWidgetFieldMultiSelectHost,
	CWidgetFieldMultiSelectOverrideHost,
	CWidgetFieldRadioButtonList,
	CWidgetFieldSelect,
	CWidgetFieldTags,
	CWidgetFieldTextBox
};

/**
 * Earth View widget form.
 */
class WidgetForm extends CWidgetForm {

	public function addFields(): self {
		return $this
			->addField($this->isTemplateDashboard()
				? null
				: new CWidgetFieldMultiSelectGroup('groupids', _('Host groups'))
			)
			->addField($this->isTemplateDashboard()
				? null
				: new CWidgetFieldMultiSelectHost('hostids', _('Hosts'))
			)
			->addField($this->isTemplateDashboard()
				? null
				: (new CWidgetFieldRadioButtonList('evaltype', _('Tags'), [
					TAG_EVAL_TYPE_AND_OR => _('And/Or'),
					TAG_EVAL_TYPE_OR => _('Or')
				]))->setDefault(TAG_EVAL_TYPE_AND_OR)
			)
			->addField($this->isTemplateDashboard()
				? null
				: new CWidgetFieldTags('tags')
			)
			->addField(
				(new CWidgetFieldSelect('dark_mode', _('Theme'), [
					Widget::DARK_MODE_OFF => _('Light'),
					Widget::DARK_MODE_ON => _('Dark'),
					Widget::DARK_MODE_AUTO => _('Auto')
				]))->setDefault(Widget::DARK_MODE_AUTO)
			)
			->addField(
				(new CWidgetFieldCheckBox('auto_rotate', _('Auto rotate')))->setDefault(1)
			)
			->addField(
				(new CWidgetFieldTextBox('rotation_speed', _('Rotation speed')))
					->setDefault('0.002')
			)
			->addField(
				(new CWidgetFieldTextBox('initial_lat', _('Initial latitude')))
					->setDefault('0')
			)
			->addField(
				(new CWidgetFieldTextBox('initial_lon', _('Initial longitude')))
					->setDefault('0')
			)
			->addField(
				new CWidgetFieldMultiSelectOverrideHost()
			);
	}
}

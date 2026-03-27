<?php declare(strict_types = 0);

/**
 * Earth View widget form view.
 *
 * @var CView $this
 * @var array $data
 */

$groupids = array_key_exists('groupids', $data['fields'])
	? new CWidgetFieldMultiSelectGroupView($data['fields']['groupids'])
	: null;

(new CWidgetFormView($data))
	->addField($groupids)
	->addField(array_key_exists('hostids', $data['fields'])
		? (new CWidgetFieldMultiSelectHostView($data['fields']['hostids']))
			->setFilterPreselect([
				'id' => $groupids->getId(),
				'accept' => CMultiSelect::FILTER_PRESELECT_ACCEPT_ID,
				'submit_as' => 'groupid'
			])
		: null
	)
	->addField(array_key_exists('evaltype', $data['fields'])
		? new CWidgetFieldRadioButtonListView($data['fields']['evaltype'])
		: null
	)
	->addField(array_key_exists('tags', $data['fields'])
		? new CWidgetFieldTagsView($data['fields']['tags'])
		: null
	)
	->addFieldset(
		(new CWidgetFormFieldsetCollapsibleView(_('Globe settings')))
			->addField(
				new CWidgetFieldSelectView($data['fields']['dark_mode'])
			)
			->addField(
				new CWidgetFieldCheckBoxView($data['fields']['auto_rotate'])
			)
			->addField(
				new CWidgetFieldTextBoxView($data['fields']['rotation_speed'])
			)
			->addField(
				new CWidgetFieldTextBoxView($data['fields']['initial_lat'])
			)
			->addField(
				new CWidgetFieldTextBoxView($data['fields']['initial_lon'])
			)
	)
	->show();

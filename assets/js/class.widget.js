class CWidgetEarthView extends CWidget {

	static SEVERITY_NO_PROBLEMS = -1;
	static SEVERITY_NOT_CLASSIFIED = 0;
	static SEVERITY_INFORMATION = 1;
	static SEVERITY_WARNING = 2;
	static SEVERITY_AVERAGE = 3;
	static SEVERITY_HIGH = 4;
	static SEVERITY_DISASTER = 5;
	static DARK_MODE_OFF = 0;
	static DARK_MODE_ON = 1;
	static DARK_MODE_AUTO = 2;

	#hosts = [];
	#hosts_map = new Map();
	#selected_hostid = null;
	#globe = null;
	#canvas = null;
	#overlay = null;
	#container = null;
	#phi = 0;
	#theta = 0.3;
	#target_phi = 0;
	#target_theta = 0.3;
	#is_dragging = false;
	#drag_start_x = 0;
	#drag_start_y = 0;
	#drag_start_phi = 0;
	#drag_start_theta = 0;
	#drag_pointer_id = null;
	#auto_rotate = true;
	#rotation_speed = 0.005;
	#dark_mode = CWidgetEarthView.DARK_MODE_AUTO;
	#theme_dark = false;
	#theme_media_query = null;
	#theme_media_listener = null;
	#severity_levels = new Map();
	#marker_elements = new Map();
	#cached_globe_markers = [];
	#markers_dirty = true;
	#theme_dirty = true;
	#initial_load = true;
	#animation_frame_id = null;
	#last_frame_time = 0;
	#frame_interval = 1000 / 30;
	#globe_radius = 0;

	promiseReady() {
		return super.promiseReady();
	}

	getUpdateRequestData() {
		return {
			...super.getUpdateRequestData(),
			unique_id: this._unique_id,
			with_config: this.#initial_load ? 1 : undefined
		};
	}

	setContents(response) {
		if (this.#initial_load) {
			super.setContents(response);

			this.#container = this._body.querySelector(`#${this._unique_id}`);
			this.#canvas = this.#container.querySelector('.earth-view-canvas');
			this.#overlay = this.#container.querySelector('.earth-view-overlay');
			this.#initThemeWatcher();

			if (response.config) {
				this.#initSeverities(response.config.severities);
			}

			this.#applyFieldValues(response.fields_values);
			this.#initGlobe();
			this.#initDragHandlers();
		}
		else if (response.fields_values) {
			this.#applyFieldValues(response.fields_values);
		}

		this.#hosts = response.hosts || [];
		this.#rebuildHostsMap();
		this.#syncMarkerDom();

		if (this.isReferred() && (this.isFieldsReferredDataUpdated() || !this.hasEverUpdated())) {
			if (this.#selected_hostid === null || !this.#hasSelectable()) {
				this.#selected_hostid = this.#getDefaultSelectable();
			}

			if (this.#selected_hostid !== null) {
				this.#updateMarkerStyles();
				this.#broadcast();
			}
		}
		else if (this.#selected_hostid !== null) {
			this.#updateMarkerStyles();
		}

		this.#initial_load = false;
	}

	#rebuildHostsMap() {
		this.#hosts_map.clear();
		for (const host of this.#hosts) {
			this.#hosts_map.set(host.hostid, host);
		}
	}

	#applyFieldValues(fv) {
		if (!fv) return;

		this.#dark_mode = Number.parseInt(fv.dark_mode, 10);
		this.#auto_rotate = parseInt(fv.auto_rotate, 10) === 1;
		this.#rotation_speed = parseFloat(fv.rotation_speed) || 0.005;

		const lat_deg = parseFloat(fv.initial_lat) || 0;
		const lon_deg = parseFloat(fv.initial_lon) || 0;

		if (this.#initial_load) {
			this.#phi = lon_deg * Math.PI / 180;
			this.#theta = lat_deg * Math.PI / 180;
			this.#target_phi = this.#phi;
			this.#target_theta = this.#theta;
		}

		this.#applyTheme();
		this.#requestRender();
	}

	#initThemeWatcher() {
		if (this.#theme_media_query !== null || typeof window.matchMedia !== 'function') {
			return;
		}

		this.#theme_media_query = window.matchMedia('(prefers-color-scheme: dark)');
		this.#theme_media_listener = () => {
			if (this.#dark_mode === CWidgetEarthView.DARK_MODE_AUTO) {
				this.#applyTheme(true);
			}
		};

		if (typeof this.#theme_media_query.addEventListener === 'function') {
			this.#theme_media_query.addEventListener('change', this.#theme_media_listener);
		}
		else if (typeof this.#theme_media_query.addListener === 'function') {
			this.#theme_media_query.addListener(this.#theme_media_listener);
		}
	}

	#destroyThemeWatcher() {
		if (this.#theme_media_query === null || this.#theme_media_listener === null) {
			return;
		}

		if (typeof this.#theme_media_query.removeEventListener === 'function') {
			this.#theme_media_query.removeEventListener('change', this.#theme_media_listener);
		}
		else if (typeof this.#theme_media_query.removeListener === 'function') {
			this.#theme_media_query.removeListener(this.#theme_media_listener);
		}

		this.#theme_media_query = null;
		this.#theme_media_listener = null;
	}

	#resolveDarkTheme() {
		switch (this.#dark_mode) {
			case CWidgetEarthView.DARK_MODE_OFF:
				return false;

			case CWidgetEarthView.DARK_MODE_ON:
				return true;

			default:
				return this.#theme_media_query?.matches ?? false;
		}
	}

	#applyTheme(force = false) {
		const theme_dark = this.#resolveDarkTheme();

		if (!force && theme_dark === this.#theme_dark) {
			return;
		}

		this.#theme_dark = theme_dark;
		this.#theme_dirty = true;
		this.#container?.classList.toggle('earth-view-theme-dark', theme_dark);
		this.#container?.classList.toggle('earth-view-theme-light', !theme_dark);

		if (this.#globe !== null && this.#container !== null && !this.#initial_load) {
			this.#recreateGlobe();
			return;
		}

		this.#requestRender();
	}

	#getGlobeThemeOptions() {
		return this.#theme_dark
			? {
				dark: 0.7,
				diffuse: 1.2,
				mapBrightness: 6,
				mapBaseBrightness: 0,
				baseColor: [1, 1, 1],
				glowColor: [0.16, 0.16, 0.16]
			}
			: {
				dark: 0,
				diffuse: 1.2,
				mapBrightness: 0,
				mapBaseBrightness: 0,
				baseColor: [1, 1, 1],
				glowColor: [1, 1, 1]
			};
	}

	#getMapSamples(width, height) {
		return 20000;
	}

	#initGlobe() {
		const container = this.#container;
		const cw = container.offsetWidth;
		const ch = container.offsetHeight;
		if (cw <= 0 || ch <= 0) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		const theme = this.#getGlobeThemeOptions();
		const map_samples = this.#getMapSamples(cw, ch);

		this.#canvas.width = cw * dpr;
		this.#canvas.height = ch * dpr;
		this.#canvas.style.width = `${cw}px`;
		this.#canvas.style.height = `${ch}px`;

		this.#globe_radius = Math.min(cw, ch) / 2;

		if (this.#globe) {
			this.#globe.destroy();
			this.#globe = null;
		}

		const createGlobe = COBE.default;

		this.#globe = createGlobe(this.#canvas, {
			devicePixelRatio: dpr,
			width: cw,
			height: ch,
			phi: this.#phi,
			theta: this.#theta,
			dark: theme.dark,
			diffuse: theme.diffuse,
			mapSamples: map_samples,
			mapBrightness: theme.mapBrightness,
			mapBaseBrightness: theme.mapBaseBrightness,
			baseColor: theme.baseColor,
			markerColor: [0.1, 0.8, 0.1],
			glowColor: theme.glowColor,
			markers: this.#cached_globe_markers,
			markerElevation: 0,
			scale: 1,
			offset: [0, 0]
		});

		this.#markers_dirty = false;
		this.#theme_dirty = false;
		this.#startAnimationLoop();
	}

	#initDragHandlers() {
		const canvas = this.#canvas;

		const onPointerDown = (e) => {
			if (e.button !== 0) return;

			e.preventDefault();
			this.#is_dragging = true;
			this.#drag_pointer_id = e.pointerId;
			this.#drag_start_x = e.clientX;
			this.#drag_start_y = e.clientY;
			this.#drag_start_phi = this.#target_phi;
			this.#drag_start_theta = this.#target_theta;

			canvas.setPointerCapture(e.pointerId);
			this.#requestRender();
		};

		const onPointerMove = (e) => {
			if (!this.#is_dragging || e.pointerId !== this.#drag_pointer_id) return;

			const dx = e.clientX - this.#drag_start_x;
			const dy = e.clientY - this.#drag_start_y;

			const sensitivity = Math.PI / this.#globe_radius;
			this.#target_phi = this.#drag_start_phi + dx * sensitivity;
			this.#target_theta = Math.max(-Math.PI / 2, Math.min(Math.PI / 2,
				this.#drag_start_theta + dy * sensitivity
			));
			this.#requestRender();
		};

		const onPointerUp = (e) => {
			if (this.#drag_pointer_id !== null && e.pointerId !== this.#drag_pointer_id) {
				return;
			}

			this.#is_dragging = false;
			this.#drag_pointer_id = null;

			if (canvas.hasPointerCapture(e.pointerId)) {
				canvas.releasePointerCapture(e.pointerId);
			}

			this.#requestRender();
		};

		canvas.addEventListener('pointerdown', onPointerDown);
		canvas.addEventListener('pointermove', onPointerMove);
		canvas.addEventListener('pointerup', onPointerUp);
		canvas.addEventListener('pointercancel', onPointerUp);
		canvas.addEventListener('lostpointercapture', onPointerUp);
	}

	#projectAllMarkers() {
		const width = this.#canvas.offsetWidth;
		const height = this.#canvas.offsetHeight;
		const stacks = new Map();

		if (width <= 0 || height <= 0) {
			return;
		}

		for (const [hostid, el] of this.#marker_elements) {
			const host = this.#hosts_map.get(hostid);
			if (!host) {
				el.style.display = 'none';
				continue;
			}

			const location = this.#normalizeLocation(host);

			if (location === null) {
				el.style.display = 'none';
				continue;
			}

			const projected = this.#projectLocation(location.lat, location.lon, width, height);

			if (!projected.visible || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
				el.style.display = 'none';
				continue;
			}

			const stack_key = `${Math.round(projected.x / 28)}:${Math.round(projected.y / 20)}`;

			if (!stacks.has(stack_key)) {
				stacks.set(stack_key, []);
			}

			stacks.get(stack_key).push({el, host, projected});
		}

		for (const stack of stacks.values()) {
			stack.sort((a, b) => {
				if (a.host.severity !== b.host.severity) {
					return b.host.severity - a.host.severity;
				}

				return a.host.name.localeCompare(b.host.name);
			});

			const gap = 6;
			const sizes = stack.map(({el}) => ({
				width: el.offsetWidth || 160,
				height: el.offsetHeight || 30
			}));
			const total_height = sizes.reduce((sum, size) => sum + size.height, 0) + gap * (stack.length - 1);
			const anchor_x = stack.reduce((sum, entry) => sum + entry.projected.x, 0) / stack.length;
			const anchor_y = stack[0].projected.y;
			let current_top = Math.max(8, Math.min(height - total_height - 8, anchor_y - total_height / 2));

			stack.forEach(({el}, index) => {
				const label_width = sizes[index].width;
				const label_height = sizes[index].height;
				const horizontal_margin = label_width / 2 + 8;
				const left = Math.max(
					horizontal_margin,
					Math.min(width - horizontal_margin, anchor_x + 16 + label_width / 2)
				);
				const top = current_top + label_height / 2;

				el.style.left = `${left}px`;
				el.style.top = `${top}px`;
				el.style.opacity = '1';
				el.style.display = '';

				current_top += label_height + gap;
			});
		}
	}

	#syncMarkerDom() {
		const current_ids = new Set(this.#hosts.map(h => h.hostid));

		for (const [hostid, el] of this.#marker_elements) {
			if (!current_ids.has(hostid)) {
				el.remove();
				this.#marker_elements.delete(hostid);
			}
		}

		for (const host of this.#hosts) {
			let el = this.#marker_elements.get(host.hostid);

			if (!el) {
				el = document.createElement('div');
				el.classList.add('earth-view-marker');
				el.dataset.hostid = host.hostid;

				const label = document.createElement('span');
				label.classList.add('earth-view-marker-label');

				const dot = document.createElement('span');
				dot.classList.add('earth-view-marker-status');

				const text = document.createElement('span');
				text.classList.add('earth-view-marker-text');

				label.append(dot, text);
				el.appendChild(label);

				el.addEventListener('click', (e) => {
					e.stopPropagation();
					const h = this.#hosts_map.get(host.hostid);
					if (h) {
						this.#onMarkerClick(host.hostid, el, h);
					}
				});

				this.#overlay.appendChild(el);
				this.#marker_elements.set(host.hostid, el);
			}

			const label = el.querySelector('.earth-view-marker-label');
			const dot = el.querySelector('.earth-view-marker-status');
			const text = el.querySelector('.earth-view-marker-text');
			const severity_color = this.#getSeverityColor(host.severity);

			text.textContent = host.name;
			dot.style.backgroundColor = severity_color;
		}

		this.#updateMarkerStyles(false);
		this.#flushRender();
	}

	#getSeverityColor(severity) {
		if (this.#severity_levels.has(severity)) {
			return this.#severity_levels.get(severity).color;
		}
		return '#009900';
	}

	#normalizeLocation(host) {
		const lat = Number(host.lat);
		const lon = Number(host.lon);

		if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
			return null;
		}

		return {lat, lon};
	}

	#projectLocation(lat, lon, width, height) {
		const lat_r = lat * Math.PI / 180;
		const lon_r = lon * Math.PI / 180 - Math.PI;
		const cos_lat = Math.cos(lat_r);
		const marker_radius = 0.8;
		const point = [
			-Math.cos(lon_r) * cos_lat * marker_radius,
			Math.sin(lat_r) * marker_radius,
			Math.sin(lon_r) * cos_lat * marker_radius
		];
		const cos_theta = Math.cos(this.#theta);
		const sin_theta = Math.sin(this.#theta);
		const cos_phi = Math.cos(this.#phi);
		const sin_phi = Math.sin(this.#phi);
		const projected_x = cos_phi * point[0] + sin_phi * point[2];
		const projected_y = sin_phi * sin_theta * point[0] + cos_theta * point[1]
			- cos_phi * sin_theta * point[2];
		const visible = (-sin_phi * cos_theta * point[0] + sin_theta * point[1]
			+ cos_phi * cos_theta * point[2]) >= 0
			|| projected_x * projected_x + projected_y * projected_y >= 0.64;

		return {
			x: ((projected_x / (width / height)) + 1) * 0.5 * width,
			y: ((-projected_y) + 1) * 0.5 * height,
			visible
		};
	}

	#getMarkerId(hostid) {
		return `host-${hostid}`;
	}

	#onMarkerClick(hostid, marker_el, host) {
		this.#selected_hostid = hostid;
		this.#updateMarkerStyles();
		this.#broadcast();
		this.#showHintbox(marker_el, host);
	}

	#updateMarkerStyles(schedule_render = true) {
		for (const [hostid, el] of this.#marker_elements) {
			el.classList.toggle('selected', hostid === this.#selected_hostid);
		}

		this.#rebuildGlobeMarkers(schedule_render);
	}

	#rebuildGlobeMarkers(schedule_render = true) {
		this.#cached_globe_markers = this.#hosts
			.map(host => ({
				...host,
				location: this.#normalizeLocation(host)
			}))
			.filter(host => host.location !== null)
			.map(host => ({
				id: this.#getMarkerId(host.hostid),
				location: [host.location.lat, host.location.lon],
				size: host.hostid === this.#selected_hostid ? 0.022 : 0.014,
				color: this.#toCobeColor(this.#getSeverityColor(host.severity))
			}));
		this.#markers_dirty = true;

		if (schedule_render) {
			this.#requestRender();
		}
	}

	#flushRender() {
		if (!this.#globe) {
			return;
		}

		const update = {
			phi: this.#phi,
			theta: this.#theta
		};
		const theme = this.#theme_dirty ? this.#getGlobeThemeOptions() : null;

		if (theme !== null) {
			update.dark = theme.dark;
			update.diffuse = theme.diffuse;
			update.mapBrightness = theme.mapBrightness;
			update.mapBaseBrightness = theme.mapBaseBrightness;
			update.baseColor = theme.baseColor;
			update.glowColor = theme.glowColor;
		}

		if (this.#markers_dirty) {
			update.markers = this.#cached_globe_markers;
		}

		this.#globe.update(update);
		this.#theme_dirty = false;
		this.#markers_dirty = false;
		this.#projectAllMarkers();
	}

	#recreateGlobe() {
		this.#stopAnimationLoop();

		if (this.#globe) {
			this.#globe.destroy();
			this.#globe = null;
		}

		this.#theme_dirty = true;
		this.#markers_dirty = true;
		this.#initGlobe();
		this.#flushRender();
	}

	#renderFrame(timestamp = 0) {
		this.#animation_frame_id = null;

		if (!this.#globe) {
			return;
		}

		if (
			this.#last_frame_time !== 0
			&& timestamp !== 0
			&& timestamp - this.#last_frame_time < this.#frame_interval
		) {
			this.#requestRender();
			return;
		}

		const previous_time = this.#last_frame_time || timestamp;
		const delta_factor = timestamp > 0
			? Math.min((timestamp - previous_time) / (1000 / 60), 3)
			: 1;
		const view_before_phi = this.#phi;
		const view_before_theta = this.#theta;
		let needs_more_frames = false;

		if (!this.#is_dragging && this.#auto_rotate) {
			this.#target_phi += this.#rotation_speed * delta_factor;
			needs_more_frames = true;
		}

		const easing = Math.min(1, 0.12 * delta_factor);
		this.#phi += (this.#target_phi - this.#phi) * easing;
		this.#theta += (this.#target_theta - this.#theta) * easing;

		if (Math.abs(this.#target_phi - this.#phi) > 0.0002 || Math.abs(this.#target_theta - this.#theta) > 0.0002) {
			needs_more_frames = true;
		}
		else {
			this.#phi = this.#target_phi;
			this.#theta = this.#target_theta;
		}

		const view_changed = Math.abs(this.#phi - view_before_phi) > 0.00001
			|| Math.abs(this.#theta - view_before_theta) > 0.00001;
		const update = {};
		const theme = this.#theme_dirty ? this.#getGlobeThemeOptions() : null;

		if (theme !== null) {
			update.dark = theme.dark;
			update.diffuse = theme.diffuse;
			update.mapBrightness = theme.mapBrightness;
			update.mapBaseBrightness = theme.mapBaseBrightness;
			update.baseColor = theme.baseColor;
			update.glowColor = theme.glowColor;
		}

		if (this.#markers_dirty) {
			update.markers = this.#cached_globe_markers;
		}

		if (view_changed || theme !== null || this.#markers_dirty || this.#last_frame_time === 0) {
			update.phi = this.#phi;
			update.theta = this.#theta;
		}

		if (Object.keys(update).length > 0) {
			this.#globe.update(update);
			this.#theme_dirty = false;
			this.#markers_dirty = false;
			this.#projectAllMarkers();
		}

		this.#last_frame_time = timestamp;

		if (needs_more_frames || this.#theme_dirty || this.#markers_dirty || this.#is_dragging) {
			this.#requestRender();
		}
	}

	#startAnimationLoop() {
		this.#last_frame_time = 0;
		this.#requestRender();
	}

	#stopAnimationLoop() {
		if (this.#animation_frame_id !== null) {
			cancelAnimationFrame(this.#animation_frame_id);
			this.#animation_frame_id = null;
		}

		this.#last_frame_time = 0;
	}

	#hasPendingViewMotion() {
		return this.#is_dragging
			|| this.#auto_rotate
			|| Math.abs(this.#target_phi - this.#phi) > 0.0002
			|| Math.abs(this.#target_theta - this.#theta) > 0.0002;
	}

	#requestRender() {
		if (
			!this.#globe
			|| this.#animation_frame_id !== null
			|| (this._state !== WIDGET_STATE_ACTIVE && !this.#initial_load)
		) {
			return;
		}

		if (!this.#theme_dirty && !this.#markers_dirty && !this.#hasPendingViewMotion() && !this.#initial_load) {
			return;
		}

		this.#animation_frame_id = requestAnimationFrame((timestamp) => this.#renderFrame(timestamp));
	}

	#toCobeColor(color) {
		const match = /^#?([0-9a-f]{6})$/i.exec(color);

		if (!match) {
			return [0.13, 0.77, 0.37];
		}

		const hex = match[1];

		return [
			parseInt(hex.slice(0, 2), 16) / 255,
			parseInt(hex.slice(2, 4), 16) / 255,
			parseInt(hex.slice(4, 6), 16) / 255
		];
	}

	#broadcast() {
		this.broadcast({
			[CWidgetsData.DATA_TYPE_HOST_ID]: [this.#selected_hostid],
			[CWidgetsData.DATA_TYPE_HOST_IDS]: [this.#selected_hostid]
		});
	}

	#getDefaultSelectable() {
		if (this.#hosts.length === 0) return null;
		return this.#hosts[0].hostid;
	}

	#hasSelectable() {
		return this.#hosts_map.has(this.#selected_hostid);
	}

	onReferredUpdate() {
		if (this.#hosts.length === 0) return;

		if (this.#selected_hostid === null) {
			this.#selected_hostid = this.#getDefaultSelectable();

			if (this.#selected_hostid !== null) {
				this.#updateMarkerStyles();
				this.#broadcast();
			}
		}
	}

	#showHintbox(marker_el, host) {
		if ('hintBoxItem' in marker_el) {
			return;
		}

		const rect = marker_el.getBoundingClientRect();
		const client_x = rect.left + rect.width / 2;
		const client_y = rect.top + rect.height / 2;
		const anchor = {
			left: client_x + window.scrollX,
			top: rect.top + window.scrollY,
			width: 0,
			height: 0
		};
		const hintbox = document.createElement('div');
		hintbox.classList.add('earth-view-hintbox');
		hintbox.append(this.#makePopupContent([host]));

		marker_el.hintBoxItem = hintBox.createBox(
			{
				clientX: client_x,
				clientY: client_y,
				pageX: client_x + window.scrollX,
				pageY: client_y + window.scrollY,
				target: marker_el
			},
			marker_el,
			hintbox,
			'',
			true
		);

		if (marker_el.hintBoxItem) {
			marker_el.hintBoxItem.position({
				my: 'center bottom',
				at: 'center top',
				of: anchor,
				collision: 'fit'
			});

			Overlay.prototype.recoverFocus.call({'$dialogue': marker_el.hintBoxItem});
			Overlay.prototype.containFocus.call({'$dialogue': marker_el.hintBoxItem});
		}
	}

	#makePopupContent(hosts) {
		const makeHostBtn = (host) => {
			const data_menu_popup = JSON.stringify({type: 'host', data: {hostid: host.hostid}});
			const btn = document.createElement('a');
			btn.ariaExpanded = false;
			btn.ariaHaspopup = true;
			btn.role = 'button';
			btn.setAttribute('data-menu-popup', data_menu_popup);
			btn.classList.add('link-action');
			btn.href = 'javascript:void(0)';
			btn.textContent = host.name;
			return btn;
		};

		const makeDataCell = (host, severity) => {
			if (severity in host.problems && host.problems[severity] > 0) {
				const cls = this.#severity_levels.has(severity)
					? this.#severity_levels.get(severity).class
					: '';
				return `<td class="${cls}">${host.problems[severity]}</td>`;
			}
			return '<td></td>';
		};

		const sorted = [...hosts].sort((a, b) => a.name.localeCompare(b.name));

		const rows = sorted.map(host => {
			const row_class = host.hostid === this.#selected_hostid
				? `class="${ZBX_STYLE_ROW_SELECTED}"`
				: '';

			return `
				<tr data-hostid="${host.hostid}" ${row_class}>
					<td class="nowrap">${makeHostBtn(host).outerHTML}</td>
					${makeDataCell(host, CWidgetEarthView.SEVERITY_DISASTER)}
					${makeDataCell(host, CWidgetEarthView.SEVERITY_HIGH)}
					${makeDataCell(host, CWidgetEarthView.SEVERITY_AVERAGE)}
					${makeDataCell(host, CWidgetEarthView.SEVERITY_WARNING)}
					${makeDataCell(host, CWidgetEarthView.SEVERITY_INFORMATION)}
					${makeDataCell(host, CWidgetEarthView.SEVERITY_NOT_CLASSIFIED)}
				</tr>`;
		}).join('');

		const abbr = (sev, fallback) =>
			this.#severity_levels.has(sev) ? this.#severity_levels.get(sev).abbr : fallback;

		const html = `
			<table class="${ZBX_STYLE_LIST_TABLE}">
			<thead>
			<tr>
				<th>${t('Host')}</th>
				<th>${abbr(5, 'D')}</th>
				<th>${abbr(4, 'H')}</th>
				<th>${abbr(3, 'A')}</th>
				<th>${abbr(2, 'W')}</th>
				<th>${abbr(1, 'I')}</th>
				<th>${abbr(0, 'N')}</th>
			</tr>
			</thead>
			<tbody>${rows}</tbody>
			</table>`;

		const tpl = document.createElement('template');
		tpl.innerHTML = html;

		tpl.content.querySelector('tbody').addEventListener('click', e => {
			if (e.target.closest('a') !== null) return;

			const row = e.target.closest('tr');
			if (row !== null) {
				const hostid = row.dataset.hostid;
				if (hostid !== undefined) {
					this.#selected_hostid = hostid;
					this.#updateMarkerStyles();
					this.#broadcast();
				}
			}
		});

		return tpl.content;
	}

	#initSeverities(severities) {
		for (let i = CWidgetEarthView.SEVERITY_NO_PROBLEMS; i <= CWidgetEarthView.SEVERITY_DISASTER; i++) {
			const sev = severities[i];
			if (!sev) continue;

			this.#severity_levels.set(i, {
				name: sev.name,
				color: sev.color,
				abbr: sev.name.charAt(0),
				class: sev.style || ''
			});
		}
	}

	#removeHintBoxes() {
		for (const [, el] of this.#marker_elements) {
			if ('hintboxid' in el) {
				hintBox.deleteHint(el);
			}
		}
	}

	onResize() {
		super.onResize();

		if (this._state === WIDGET_STATE_ACTIVE && this.#container) {
			this.#removeHintBoxes();
			this.#stopAnimationLoop();

			if (this.#globe) {
				this.#globe.destroy();
				this.#globe = null;
			}

			this.#initGlobe();
		}
	}

	onClearContents() {
		this.#stopAnimationLoop();

		if (this.#globe) {
			this.#globe.destroy();
			this.#globe = null;
		}

		for (const [, el] of this.#marker_elements) {
			el.remove();
		}
		this.#marker_elements.clear();
		this.#hosts_map.clear();
		this.#cached_globe_markers = [];
		this.#markers_dirty = true;
		this.#theme_dirty = true;
		this.#initial_load = true;
	}

	onEdit() {
	}

	onActivate() {
		this.#startAnimationLoop();
	}

	onDeactivate() {
		this.#stopAnimationLoop();
	}

	onDestroy() {
		this.#stopAnimationLoop();
		this.#destroyThemeWatcher();
	}

	hasPadding() {
		return false;
	}
}

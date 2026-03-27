# Earth View

`Earth View` is a Zabbix dashboard widget that places hosts on an interactive 3D globe.

It uses host inventory coordinates (`location_lat`, `location_lon`) and renders them with a locally bundled copy of [COBE](https://github.com/shuding/cobe), so the widget can run as a self-contained Zabbix module without external CDN dependencies.

<p align="center">
  <img src="https://github.com/user-attachments/assets/f18bfb2d-a063-46f8-a7e1-1f16a2c3a9ec" alt="Zabbix 3D Globe Widget Demo" width="600">
</p>

## Features

- Interactive 3D globe widget for Zabbix dashboards
- Host placement from inventory latitude and longitude
- Severity-colored host markers
- Host labels stacked on the right side of each location cluster
- Clickable host labels with Zabbix popup details
- Light, dark, and auto theme modes
- Auto-rotation with manual drag control
- Local static COBE bundle and local map texture

## Requirements

- Tested with Zabbix 7.4.x
- Hosts must have valid inventory coordinates:
  - `location_lat`
  - `location_lon`
- Node.js and npm are only required if you want to rebuild the bundled `cobe.js`

## Installation

1. Copy this module directory into your Zabbix modules path.

Typical example:

```text
ui/modules/EarthView
```

2. Ensure the folder contains at least:

```text
manifest.json
Widget.php
actions/
assets/
includes/
views/
```

3. In Zabbix, enable the module.

4. Add the `Earth View` widget to a dashboard.

## Widget Configuration

The widget supports:

- Host groups
- Hosts
- Tag filtering
- Theme: `Light`, `Dark`, `Auto`
- Auto rotate
- Rotation speed
- Initial latitude
- Initial longitude

## How Host Data Is Mapped

The backend collects monitored hosts through the Zabbix API and keeps only hosts with valid inventory coordinates.

Each host is converted into a globe marker with:

- `hostid`
- `name`
- `lat`
- `lon`
- highest active problem severity
- per-severity problem counters for the popup

Severity colors are taken from Zabbix severity settings.

## Development

### Install Dependencies

```bash
npm install
```

### Rebuild the Local COBE Bundle

```bash
npm run build:cobe
```

This script:

- reads `node_modules/cobe/dist/index.esm.js`
- extracts the embedded world texture
- writes `assets/img/cobe-world.png`
- generates a browser-loadable `assets/js/cobe.js`

## Project Structure

```text
.
├── actions/WidgetView.php        # Backend data loading and marker conversion
├── assets/css/widget.css         # Widget styles
├── assets/js/cobe.js             # Local COBE runtime bundle
├── assets/js/class.widget.js     # Frontend widget logic
├── assets/img/cobe-world.png     # Local globe texture
├── includes/WidgetForm.php       # Widget form definition
├── views/widget.edit.php         # Widget edit form view
├── views/widget.view.php         # Widget runtime view
├── manifest.json                 # Zabbix module manifest
└── scripts/build-cobe.js         # COBE local bundle generator
```

## Notes

- The widget is designed to work fully offline after deployment of the module files.
- Theme switching recreates the globe instance to keep visual output consistent across light and dark modes.
- Marker labels are DOM elements layered on top of the globe, while the globe markers themselves are rendered by COBE.

## License

Apache 2.0 license.
(() => {
  const EarthViewClass = (() => {
    if (typeof CWidgetEarthView !== "undefined") {
      return CWidgetEarthView;
    }

    try {
      return globalThis.eval("CWidgetEarthView");
    }
    catch (error) {
      return null;
    }
  })();

  if (!EarthViewClass) {
    console.error("[EarthViewMock] CWidgetEarthView not found on this page.");
    return;
  }

  const STATE_KEY = "__EarthViewDemoMock";

  if (window[STATE_KEY]?.restore) {
    window[STATE_KEY].restore({ silent: true });
  }

  const makeProblems = (severity) => {
    const problems = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    switch (severity) {
      case -1:
        break;
      case 0:
        problems[0] = 1;
        break;
      case 1:
        problems[1] = 1;
        problems[0] = 1;
        break;
      case 2:
        problems[2] = 2;
        problems[1] = 1;
        break;
      case 3:
        problems[3] = 2;
        problems[2] = 1;
        break;
      case 4:
        problems[4] = 2;
        problems[3] = 1;
        problems[2] = 1;
        break;
      case 5:
        problems[5] = 1;
        problems[4] = 2;
        problems[2] = 3;
        break;
      default:
        break;
    }

    return problems;
  };

  const clusters = [
    {
      lat: 31.2304,
      lon: 121.4737,
      items: [
        ["Shanghai Core Router 01", 5],
        ["Shanghai App Cluster 02", 4],
        ["Shanghai Cache Node 03", 2],
        ["Shanghai Office Edge 04", -1]
      ]
    },
    {
      lat: 39.9042,
      lon: 116.4074,
      items: [
        ["Beijing ERP 01", 3],
        ["Beijing Proxy 02", 1]
      ]
    },
    {
      lat: 1.3521,
      lon: 103.8198,
      items: [
        ["Singapore Gateway 01", 4],
        ["Singapore Billing 02", 2],
        ["Singapore K8s 03", -1]
      ]
    },
    {
      lat: 35.6762,
      lon: 139.6503,
      items: [
        ["Tokyo Trading 01", 5],
        ["Tokyo DB Replica 02", 4],
        ["Tokyo VDI 03", 0]
      ]
    },
    {
      lat: 50.1109,
      lon: 8.6821,
      items: [
        ["Frankfurt DMZ 01", 4],
        ["Frankfurt ESXi 02", 3],
        ["Frankfurt Backup 03", 2],
        ["Frankfurt Office 04", -1]
      ]
    },
    {
      lat: 51.5072,
      lon: -0.1276,
      items: [
        ["London API 01", 2],
        ["London MQ 02", 1]
      ]
    },
    {
      lat: 40.7128,
      lon: -74.006,
      items: [
        ["New York Retail 01", 5],
        ["New York Redis 02", 3],
        ["New York WAF 03", 2],
        ["New York BI 04", -1]
      ]
    },
    {
      lat: 37.7749,
      lon: -122.4194,
      items: [
        ["San Francisco Edge 01", 4],
        ["San Francisco Search 02", 2],
        ["San Francisco Media 03", -1]
      ]
    },
    {
      lat: -23.5505,
      lon: -46.6333,
      items: [
        ["Sao Paulo MPLS 01", 3],
        ["Sao Paulo Office 02", 1]
      ]
    },
    {
      lat: 25.2048,
      lon: 55.2708,
      items: [
        ["Dubai Branch 01", 2],
        ["Dubai CCTV 02", -1]
      ]
    },
    {
      lat: -33.8688,
      lon: 151.2093,
      items: [
        ["Sydney CDN 01", 4],
        ["Sydney SAP 02", 3],
        ["Sydney Office 03", -1]
      ]
    }
  ];

  let hostSeq = 1;

  const hosts = clusters.flatMap(({ lat, lon, items }) =>
    items.map(([name, severity]) => ({
      hostid: `mock-${hostSeq++}`,
      name,
      lat,
      lon,
      severity,
      problems: makeProblems(severity)
    }))
  );

  const isObject = (value) => value !== null && (typeof value === "object" || typeof value === "function");
  const isDomNode = (value) => typeof Node !== "undefined" && value instanceof Node;

  const findEarthViewWidgets = () => {
    const roots = [window.ZABBIX, window.dashboard, window.Dashboard, window];
    const queue = roots.filter(isObject).map((value) => ({ value, depth: 0 }));
    const seen = new WeakSet();
    const found = new Set();
    const maxDepth = 4;
    const maxNodes = 6000;
    let visited = 0;

    while (queue.length > 0 && visited < maxNodes) {
      const { value, depth } = queue.shift();

      if (!isObject(value) || seen.has(value)) {
        continue;
      }

      seen.add(value);
      visited++;

      try {
        if (value instanceof EarthViewClass) {
          found.add(value);
          continue;
        }
      }
      catch (error) {
      }

      if (depth >= maxDepth || isDomNode(value)) {
        continue;
      }

      let children = [];

      try {
        children = Array.isArray(value) ? value : Object.values(value);
      }
      catch (error) {
        children = [];
      }

      for (const child of children) {
        if (isObject(child) && !isDomNode(child)) {
          queue.push({ value: child, depth: depth + 1 });
        }
      }
    }

    return [...found];
  };

  const originalSetContents = EarthViewClass.prototype.setContents;

  const patchedSetContents = function(response = {}) {
    const nextResponse = isObject(response) ? { ...response } : {};
    nextResponse.hosts = hosts;
    return originalSetContents.call(this, nextResponse);
  };

  EarthViewClass.prototype.setContents = patchedSetContents;

  const refresh = () => {
    const widgets = findEarthViewWidgets();

    for (const widget of widgets) {
      try {
        patchedSetContents.call(widget, { hosts });
      }
      catch (error) {
        console.warn("[EarthViewMock] Failed to inject mock data into a widget:", error);
      }
    }

    if (widgets.length === 0) {
      document.querySelectorAll(".dashboard-widget-earth_view").forEach((el) => {
        const root = el.closest(".dashboard-grid-widget, .dashboard-widget");

        if (!root) {
          return;
        }

        const event = new CustomEvent("earthview:demo-mock-refresh", {
          bubbles: true,
          detail: { hosts }
        });

        root.dispatchEvent(event);
      });
    }

    return widgets;
  };

  const restore = ({ silent = false } = {}) => {
    EarthViewClass.prototype.setContents = originalSetContents;

    const widgets = findEarthViewWidgets();

    for (const widget of widgets) {
      if (typeof widget._startUpdating === "function") {
        try {
          widget._startUpdating();
        }
        catch (error) {
        }
      }
    }

    delete window[STATE_KEY];

    if (!silent) {
      console.log("[EarthViewMock] Restored live backend data.");
    }
  };

  const widgets = refresh();

  window[STATE_KEY] = {
    hosts,
    clusters,
    refresh,
    restore
  };

  console.log(
    `[EarthViewMock] Injected ${hosts.length} mock hosts into ${widgets.length} Earth View widget(s).`
  );
  console.log("[EarthViewMock] Restore with: window.__EarthViewDemoMock.restore()");
  console.table(
    hosts.map(({ hostid, name, lat, lon, severity }) => ({ hostid, name, lat, lon, severity }))
  );
})();

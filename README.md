# Tracker Stats Exporter

A Prometheus exporter that retrieves user metrics (Upload, Download, Buffer, Ratio, Bonus Points, Seeding, Leeching, Hit & Runs) from one or more trackers and exposes them on a standard Prometheus `/metrics` endpoint.

The exporter has native support for private trackers running the [Unit3D](https://github.com/HDInnovations/UNIT3D-Community-Edition) engine (e.g., OnlyEncodes, SeedPool, etc.).

For trackers that do not provide an API, you can provide a session cookie and the exporter will scrape the stats from the profile pages using heuristics.

## Features

- **Multi-tracker support**: Monitor multiple trackers simultaneously.
- **Dynamic Configuration**: Configure trackers via environment variables without touching config files.
- **Standard Metrics**: Exposes comprehensive user statistics.
- **Throttling/Caching**: Configurable cache duration (default 15 minutes, minimum 5 minutes) to respect tracker API limits and avoid bans.
- **Dockerized**: Ready to deploy in any container environment.

## Configuration

Configuration is handled entirely through environment variables. You can configure as many trackers as you like using the following naming convention:

`TRACKER_{NAME}_{OPTION}`

Where `{NAME}` is a unique identifier for the tracker (e.g., `SEEDPOOL`) and `{OPTION}` is one of the required configuration keys.

### Exporter Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPORTER_PORT` | The port the exporter listens on | `9100` |
| `EXPORTER_PATH` | The path metrics are exposed at | `/metrics` |
| `STATS_TTL` | Cache duration for stats (min 5m) | `15m` |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARN, ERROR) | `INFO` |
| `SCRAPING_USER_AGENT` | User-Agent used by the scraping client | `Mozilla/5.0 ...` |

### Tracker Configuration


| Variable                      | Description                                             | Default     |
|-------------------------------|---------------------------------------------------------|-------------|
| `TRACKER_{NAME}_TYPE`         | Tracker type (`UNIT3D` or `SCRAPING`)                   | `UNIT3D`    |
| `TRACKER_{NAME}_URL`          | The base URL of the tracker                             | _(empty)_   |
| `TRACKER_{NAME}_API_KEY`      | Your API token (Required for UNIT3D)                    | _(empty)_   |
| `TRACKER_{NAME}_API_KEY_FILE` | Alternatively, specify the API token using a file       | _(empty)_   |
| `TRACKER_{NAME}_COOKIE`       | Your session cookie (Required for SCRAPING)             | _(empty)_   |
| `TRACKER_{NAME}_COOKIE_FILE`  | Alternatively, specify the session cookie using a file  | _(empty)_   |

### Global Proxy Configuration

You can configure a global proxy that will be used for all tracker requests. This is useful if you already have a container running behind a VPN with Privoxy enabled.

**Note**: The connection to the Ollama instance is direct and does **not** use this proxy.

| Variable | Description | Example |
|----------|-------------|---------|
| `PROXY_URL` | The URL of the proxy server (HTTP/HTTPS) | `http://qbittorrent:8118` |
| `PROXY_USERNAME` | Proxy username (optional) | `myuser` |
| `PROXY_PASSWORD` | Proxy password (optional) | `mypassword` |

### FlareSolverr Configuration

If you are scraping a tracker that uses Cloudflare, you can configure a [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr) instance to bypass the protection.

When a scraping request receives a 403 Forbidden response, the exporter will automatically attempt to solve the challenge using the configured FlareSolverr instance.

| Variable | Description | Default |
|----------|-------------|---------|
| `FLARESOLVERR_URL` | The URL of your FlareSolverr instance | _(empty)_ |
| `FLARESOLVERR_TIMEOUT` | Timeout for the FlareSolverr request | `60s` |

## Supported Trackers

- **UNIT3D**: Fully supported via API (e.g., OnlyEncodes, SeedPool). The following trackers are known to work in this mode:
  - OnlyEncodes+ (https://onlyencodes.cc)
  - SeedPool (https://seedpool.org)
  - DarkPeers (https://darkpeers.org)
  - ULCX (https://upload.cx)
- **Generic Scraping**: Any tracker with a visible stats page can be supported using the `SCRAPING` mode. The following trackers are known to work in this mode:
  - TorrentLeech

## Metrics

The exporter exposes the following metrics at `http://localhost:9100/metrics`:

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `tracker_upload_bytes` | Gauge | `tracker` | Total upload in bytes |
| `tracker_download_bytes` | Gauge | `tracker` | Total download in bytes |
| `tracker_buffer_bytes` | Gauge | `tracker` | Buffer in bytes |
| `tracker_ratio` | Gauge | `tracker` | User ratio |
| `tracker_bonus_points` | Gauge | `tracker` | User bonus points (seed bonus) |
| `tracker_seeding_count` | Gauge | `tracker` | Number of torrents seeding |
| `tracker_leeching_count` | Gauge | `tracker` | Number of torrents leeching |
| `tracker_hit_and_runs_count` | Gauge | `tracker` | Number of hit and runs |
| `tracker_up_status` | Gauge | `tracker` | 1 if scrape was successful, 0 otherwise |

### Grafana Dashboard

A simple dashboard is available: [simple_dashboard.json](grafana/simple_dashboard.json)

![](grafana/simple_dashboard.jpg)

## Deployment via Docker

The image is available on GHCR (GitHub Container Registry).

### Docker CLI

```bash
docker run -d \
  --name tracker-stats-exporter \
  -p 9100:9100 \
  -v /path/to/cookie/files:/data \
  -e STATS_TTL=1h \
  -e TRACKER_SEEDPOOL_URL=https://seedpool.org \
  -e TRACKER_SEEDPOOL_API_KEY=abcdef123456 \
  -e TRACKER_ULCX_URL=https://upload.cx \
  -e TRACKER_ULCX_COOKIE_FILE=/data/ulcx.cookie \
  ghcr.io/avargaskun/tracker-stats-exporter:latest
```

### Docker Compose

```yaml
services:
  tracker-stats-exporter:
    container_name: tracker-stats-exporter
    image: ghcr.io/avargaskun/tracker-stats-exporter:latest
    ports:
      - "9100:9100"
    volumes:
      - /path/to/cookie/files:/data
    environment:
      # Longer TTL recommended to avoid generating excessive traffic
      - STATS_TTL=1h
      # Example of a tracker that uses API key
      - TRACKER_SEEDPOOL_URL=https://seedpool.org
      - TRACKER_SEEDPOOL_API_KEY=abcdef123456
      # Example of a tracker that uses HTML scraping
      - TRACKER_TL_URL=https://www.torrentleech.org/profile/username/view
      - TRACKER_TL_COOKIE_FILE=/data/tl.cookie
      - TRACKER_TL_TYPE=SCRAPING
    restart: unless-stopped
```

## Prometheus Configuration

Add the exporter target to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'tracker-stats'
    static_configs:
      - targets: ['tracker-stats-exporter:9100']
```

**Note:** The application caches data for a configurable duration (default 15 minutes, min 5 minutes). Scrape intervals shorter than the configured TTL will return cached data.

## Scraping Considerations

To use the `SCRAPING` mode you need to take a few additional configuration steps.

### Tracker URL

When configuring a tracker for web scraping, you should provide the address to your user profile page in the `TRACKER_..._URL` variable. This page usually contains more detailed user stats that the scrapper will read from.

### Initial Cookie Retrieval

To retrieve the page HTML from the tracker, a session cookie is required for authentication. You will need to log into the tracker from a web browser and retrieve the session cookie:

1. Log in to your tracker in a web browser (Chrome/Firefox).
2. Open Developer Tools (F12) -> Network tab.
3. Refresh the page.
4. Click on the first request (usually the page name).
5. Under Request Headers, find the `cookie:` field.
6. Copy the entire value (e.g., `uid=123; pass=abc; ...`) and save it into a file.
7. Set the environment variable `TRACKER_..._COOKIE_FILE` to the file containing the cookie value.

### Cookie Updates

Most trackers will expire the session cookie over time. Expiration time could be anywhere from a few hours to a few days. In most cases, a new cookie will be provided by the tracker when the current session is close to the expiration time. This project will detect this and use the updated session cookie. In order to keep the updated cookie, it will attempt to write the updated value back into the file provided via `TRACKER_..._COOKIE_FILE`. For this reason, it is **important** to ensure the container has read-write access to this file.

## Comprehensive Example

This example demonstrates a complete docker-compose setup with the following configuration:

- [Gluetun](https://github.com/qdm12/gluetun) to provide an HTTP proxy with VPN
- [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr) to handle CloudFlare anti-bot challenges

```yaml
services:
  gluetun:
    image: qmcgaw/gluetun:latest
    container_name: gluetun
    cap_add:
      - NET_ADMIN
    environment:
      - VPN_SERVICE_PROVIDER=protonvpn
      - VPN_TYPE=wireguard
      - WIREGUARD_PRIVATE_KEY=${WIREGUARD_PRIVATE_KEY}
      - WIREGUARD_ADDRESSES=${WIREGUARD_ADDRESSES}
    ports:
      # HTTP proxy
      - "8888:8888/tcp"
    volumes:
      - /dev/net/tun:/dev/net/tun
    restart: unless-stopped
    networks:
      - exporters

  flaresolver:
    image: flaresolverr/flaresolverr:latest
    container_name: flaresolver
    environment:
      - LOG_LEVEL=info
      - TZ=UTC
    ports:
      - "8191:8191"
    depends_on:
      - gluetun
    restart: unless-stopped
    networks:
      - exporters

  tracker-stats-exporter:
    image: avargaskun/tracker-stats-exporter:latest
    container_name: tracker-stats-exporter
    environment:
      # Longer TTL recommended to avoid generating excessive traffic
      - STATS_TTL=1h 
      # Flaresolverr and Proxy configuration
      - FLARESOLVER_URL=http://flaresolver:8191/v1
      - PROXY_URL=http://gluetun:8888
      # Example of a tracker that uses API key
      - TRACKER_SEEDPOOL_URL=https://seedpool.org
      - TRACKER_SEEDPOOL_API_KEY=abcdef123456
      # Example of a tracker that uses HTML scraping
      - TRACKER_TL_URL=https://www.torrentleech.org/profile/username/view
      - TRACKER_TL_COOKIE_FILE=/data/tl.cookie
      - TRACKER_TL_TYPE=SCRAPING
    ports:
      - "9100:9100"
    volumes:
      # Make sure the container has RW access to the files in this folder
      # in order to keep cookies up-to-date when the current session rolls over
      - /path/to/cookie/files:/data
    depends_on:
      - gluetun
      - flaresolver
    networks:
      - exporters
    restart: unless-stopped

networks:
  exporters:
    driver: bridge
```

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build:
   ```bash
   npm run build
   ```
3. Run locally:
   ```bash
   export TRACKER_TEST_URL=https://...
   export TRACKER_TEST_API_KEY=...
   npm start
   ```
4. Run tests:
   ```bash
   npm test
   ```

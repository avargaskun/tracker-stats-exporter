# Tracker Stats Exporter

A Prometheus exporter that retrieves user metrics (Upload, Download, Buffer, Ratio, Bonus Points, Seeding, Leeching, Hit & Runs) from one or more trackers and exposes them on a standard Prometheus `/metrics` endpoint.

The exporter has native support for private trackers running the [Unit3D](https://github.com/HDInnovations/UNIT3D-Community-Edition) engine (e.g., OnlyEncodes, SeedPool, etc.).

For trackers that do not provide an API, you can provide a session cookie and the exporter will scrape the stats from the profile pages using a local LLM model.

## Features

- **Multi-tracker support**: Monitor multiple trackers simultaneously.
- **Dynamic Configuration**: Configure trackers via environment variables without touching config files.
- **Standard Metrics**: Exposes comprehensive user statistics.
- **Throttling/Caching**: Configurable cache duration (default 15 minutes, minimum 5 minutes) to respect tracker API limits and avoid bans.
- **Dockerized**: Ready to deploy in any container environment.
- **AI-Powered Scraping**: Use a local LLM to extract data from any tracker's profile page.

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

### Ollama Configuration (For Scraping)

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_HOST` | URL of the Ollama instance | `http://localhost:11434` |
| `OLLAMA_MODEL` | The model to use for extraction | `gemma3:270m` |

### Tracker Configuration

> [!NOTE]
> When extracting stats using scraping rather than API, you should set this variable to the URL of your profile page.

| Variable | Description | Default |
|----------|-------------|---------|
| `TRACKER_{NAME}_TYPE`    | Tracker type (`UNIT3D` or `SCRAPING`)        | `UNIT3D` |
| `TRACKER_{NAME}_URL`     | The base URL of the tracker                  | _(empty)_ |
| `TRACKER_{NAME}_API_KEY` | Your API token (Required for UNIT3D)         | _(empty)_ |
| `TRACKER_{NAME}_COOKIE`  | Your session cookie (Required for SCRAPING)  | _(empty)_ |

### Global Proxy Configuration

You can configure a global proxy that will be used for all tracker requests. This is useful if you already have a container running behind a VPN with Privoxy enabled.

**Note**: The connection to the Ollama instance is direct and does **not** use this proxy.

| Variable | Description | Example |
|----------|-------------|---------|
| `PROXY_URL` | The URL of the proxy server (HTTP/HTTPS) | `http://qbittorrent:8118` |
| `PROXY_USERNAME` | Proxy username (optional) | `myuser` |
| `PROXY_PASSWORD` | Proxy password (optional) | `mypassword` |

## Supported Trackers

- **UNIT3D**: Fully supported via API (e.g., OnlyEncodes, SeedPool). The following trackers are known to work:
  - OnlyEncodes+ (https://onlyencodes.cc)
  - SeedPool (https://seedpool.org)
  - DarkPeers (https://darkpeers.org)
  - ULCX (https://upload.cx)
- **Generic Scraping**: Any tracker with a visible stats page can be supported using the `SCRAPING` mode and Ollama.

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
  -e TRACKER_SEEDPOOL_URL=https://seedpool.org \
  -e TRACKER_SEEDPOOL_API_KEY=abcdef123456 \
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
    environment:
      - STATS_TTL=1h # Recommended to avoid getting banned for excessive traffic
      - TRACKER_SEEDPOOL_URL=https://seedpool.org
      - TRACKER_SEEDPOOL_API_KEY=abcdef123456
      - TRACKER_ONLYENCODES_URL=https://onlyencodes.cc
      - TRACKER_ONLYENCODES_API_KEY=98765zyxw
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

### Manual Cookie Retrieval

To retrieve the page HTML from the tracker, a session cookie is required for authentication. You will need to log into the tracker from a web browser and retrieve the session cookie:

1. Log in to your tracker in a web browser (Chrome/Firefox).
2. Open Developer Tools (F12) -> Network tab.
3. Refresh the page.
4. Click on the first request (usually the page name).
5. Under Request Headers, find the `cookie:` field.
6. Copy the entire value (e.g., `uid=123; pass=abc; ...`) and paste it into your `TRACKER_..._COOKIE` environment variable.

### Setup Ollama

The exporter needs access to a running instance of [Ollama](https://ollama.com/) in order to parse the tracker HTML using LLMs. You can run Ollama locally:

- Using Docker CLI:

```bash
# Create a network for the containers to communicate
docker network create inference
# Start the ollama container and attach to the network
docker run -d \
  --name ollama \
  -v ollama:/root/.ollama \
  ollama/ollama
docker network connect inference ollama
# Then start the exporter
docker run -d \
  --name tracker-stats-exporter \
  -p 9100:9100 \
  -e OLLAMA_HOST=http://ollama:11434
  -e TRACKER_OTHERTRACKER_TYPE=SCRAPING \
  -e TRACKER_OTHERTRACKER_URL=https://othertracker.org/user/profile \
  -e "TRACKER_OTHERTRACKER_COOKIE=uid=123; pass=abc;" \
  ghcr.io/avargaskun/tracker-stats-exporter:latest
docker network connect inference tracker-stats-exporter
```

- Using Docker Compose

```yaml
services:
  ollama:
    image: ollama/ollama
    container_name: ollama
    networks:
      - inference
    volumes:
      - ollama:/root/.ollama
    restart: unless-stopped

  tracker-stats-exporter:
    container_name: tracker-stats-exporter
    image: ghcr.io/avargaskun/tracker-stats-exporter:latest
    ports:
      - "9100:9100"
    networks:
      - inference
    environment:
      - STATS_TTL=1h
      - OLLAMA_HOST=http://ollama:11434
      - TRACKER_OTHERTRACKER_TYPE=SCRAPING
      - TRACKER_OTHERTRACKER_URL=https://othertracker.org/user/profile
      - TRACKER_OTHERTRACKER_COOKIE=uid=123; pass=abc;
    restart: unless-stopped
    depends_on:
      - ollama

volumes:
  ollama:

networks:
  inference: {}
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

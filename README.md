# Tracker Stats Exporter

A Prometheus exporter for private BitTorrent trackers running the [Unit3D](https://github.com/HDInnovations/UNIT3D-Community-Edition) engine (e.g., OnlyEncodes, SeedPool, etc.).

This application scrapes user metrics (Upload, Download, Buffer, Ratio, Bonus Points, Seeding, Leeching, Hit & Runs) from multiple configured trackers and exposes them on a standard Prometheus `/metrics` endpoint.

New in this version is a **Resilient LLM-Based Scraping Module** that allows you to monitor trackers that do not provide an API, by parsing their profile pages using a local Ollama instance.

## Features

- **Multi-tracker support**: Monitor multiple trackers simultaneously.
- **Dynamic Configuration**: Configure trackers via environment variables without touching config files.
- **Standard Metrics**: Exposes comprehensive user statistics.
- **Throttling/Caching**: Configurable cache duration (default 15 minutes, minimum 5 minutes) to respect tracker API limits and avoid bans.
- **Dockerized**: Ready to deploy in any container environment.
- **AI-Powered Scraping**: Use a local LLM (Ollama) to extract data from any tracker's HTML page without writing fragile regex parsers.

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

### Required Environment Variables per Tracker

| Variable | Description | Example |
|----------|-------------|---------|
| `TRACKER_{NAME}_URL` | The base URL of the tracker (or profile page for scraping) | `https://seedpool.org` |

### Optional Environment Variables per Tracker

| Variable | Description | Default |
|----------|-------------|---------|
| `TRACKER_{NAME}_API_KEY` | Your API token (Required for UNIT3D) | _(empty)_ |
| `TRACKER_{NAME}_COOKIE` | Your session cookie (Required for SCRAPING) | _(empty)_ |
| `TRACKER_{NAME}_TYPE` | Tracker type (`UNIT3D` or `SCRAPING`) | Auto-detected (UNIT3D) |

### Global Proxy Configuration

You can configure a global proxy that will be used for all tracker requests. This is useful if you already have a container running behind a VPN with Privoxy enabled.

**Note**: The connection to the Ollama instance is direct and does **not** use this proxy.

| Variable | Description | Example |
|----------|-------------|---------|
| `PROXY_URL` | The URL of the proxy server (HTTP/HTTPS) | `http://qbittorrent:8118` |
| `PROXY_USERNAME` | Proxy username (optional) | `myuser` |
| `PROXY_PASSWORD` | Proxy password (optional) | `mypassword` |

## Supported Trackers

- **UNIT3D**: Fully supported via API (e.g., OnlyEncodes, SeedPool).
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

## Setting up Ollama

To use the `SCRAPING` mode, you need an instance of [Ollama](https://ollama.com/) running.

### Manual Cookie Retrieval

To use the SCRAPING mode, you must provide a valid session cookie:

1. Log in to your tracker in a web browser (Chrome/Firefox).
2. Open Developer Tools (F12) -> Network tab.
3. Refresh the page.
4. Click on the first request (usually the page name).
5. Under Request Headers, find the `cookie:` field.
6. Copy the entire value (e.g., `uid=123; pass=abc; ...`) and paste it into your `TRACKER_..._COOKIE` environment variable.

## Deployment via Docker

The image is available on GHCR (GitHub Container Registry).

### Docker CLI (with Ollama)

First start Ollama:
```bash
docker run -d --name ollama -p 11434:11434 ollama/ollama
docker exec -it ollama ollama pull gemma3:270m
```

Then start the exporter:
```bash
docker run -d \
  --name tracker-stats-exporter \
  --link ollama \
  -p 9100:9100 \
  -e OLLAMA_HOST=http://ollama:11434 \
  -e TRACKER_MYTRACKER_TYPE=SCRAPING \
  -e TRACKER_MYTRACKER_URL=https://mytracker.org/profile/123 \
  -e "TRACKER_MYTRACKER_COOKIE=uid=123;pass=abc" \
  ghcr.io/avargaskun/tracker-stats-exporter:latest
```

### Docker Compose

```yaml
services:
  ollama:
    image: ollama/ollama
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

  tracker-stats-exporter:
    container_name: tracker-stats-exporter
    image: ghcr.io/avargaskun/tracker-stats-exporter:latest
    ports:
      - "9100:9100"
    environment:
      - STATS_TTL=1h
      - OLLAMA_HOST=http://ollama:11434
      # Example UNIT3D Tracker
      - TRACKER_SEEDPOOL_URL=https://seedpool.org
      - TRACKER_SEEDPOOL_API_KEY=abcdef123456
      # Example Scraped Tracker
      - TRACKER_OTHER_TYPE=SCRAPING
      - TRACKER_OTHER_URL=https://othertracker.org/user/profile
      - TRACKER_OTHER_COOKIE=uid=123; pass=abc;
    restart: unless-stopped
    depends_on:
      - ollama

volumes:
  ollama_data:
```

## Prometheus Configuration

Add the exporter target to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'tracker-stats'
    static_configs:
      - targets: ['tracker-stats-exporter:9100']
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

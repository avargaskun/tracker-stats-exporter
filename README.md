# Tracker Stats Exporter

A Prometheus exporter for private BitTorrent trackers running the [Unit3D](https://github.com/HDInnovations/UNIT3D-Community-Edition) engine (e.g., OnlyEncodes, DigitalCore, etc.).

This application scrapes user metrics (Upload, Download, Ratio, Bonus Points, Seeding Count) from multiple configured trackers and exposes them on a standard Prometheus `/metrics` endpoint.

## Features

- **Multi-tracker support**: Monitor multiple trackers simultaneously.
- **Dynamic Configuration**: Configure trackers via environment variables without touching config files.
- **Standard Metrics**: Exposes `tracker_upload_bytes`, `tracker_download_bytes`, `tracker_ratio`, `tracker_bonus_points`, `tracker_seeding_count`, and `tracker_up_status`.
- **Throttling/Caching**: Built-in 5-minute cache to respect tracker API limits and avoid bans.
- **Dockerized**: Ready to deploy in any container environment.

## Configuration

Configuration is handled entirely through environment variables. You can configure as many trackers as you like using the following naming convention:

`TRACKER_{NAME}_{OPTION}`

Where `{NAME}` is a unique identifier for the tracker (e.g., `DIGITALCORE`) and `{OPTION}` is one of the required configuration keys.

### Required Environment Variables per Tracker

| Variable | Description | Example |
|----------|-------------|---------|
| `TRACKER_{NAME}_URL` | The base URL of the tracker | `https://digitalcore.club` |
| `TRACKER_{NAME}_API_KEY` | Your API token | `abcdef123456` |
| `TRACKER_{NAME}_USERNAME` | Your username on the tracker | `MyUser` |

### Example Configuration

```bash
# Tracker 1: DigitalCore
TRACKER_DIGITALCORE_URL=https://digitalcore.club
TRACKER_DIGITALCORE_API_KEY=abcdef123456
TRACKER_DIGITALCORE_USERNAME=MyUser

# Tracker 2: OnlyEncodes
TRACKER_ONLYENCODES_URL=https://onlyencodes.cc
TRACKER_ONLYENCODES_API_KEY=98765zyxw
TRACKER_ONLYENCODES_USERNAME=MyUser
```

## Metrics

The exporter exposes the following metrics at `http://localhost:9100/metrics`:

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `tracker_upload_bytes` | Gauge | `tracker` | Total upload in bytes |
| `tracker_download_bytes` | Gauge | `tracker` | Total download in bytes |
| `tracker_ratio` | Gauge | `tracker` | User ratio |
| `tracker_bonus_points` | Gauge | `tracker` | Available bonus points (seed bonus) |
| `tracker_seeding_count` | Gauge | `tracker` | Number of torrents currently seeding |
| `tracker_up_status` | Gauge | `tracker` | 1 if scrape was successful, 0 otherwise |

## Deployment via Docker

The image is available on GHCR (GitHub Container Registry).

### Docker CLI

```bash
docker run -d \
  --name tracker-stats-exporter \
  -p 9100:9100 \
  -e TRACKER_MYSITE_URL=https://mysite.internal \
  -e TRACKER_MYSITE_API_KEY=myapikey \
  -e TRACKER_MYSITE_USERNAME=myuser \
  ghcr.io/owner/tracker-stats-exporter:latest
```

### Docker Compose

```yaml
version: '3'
services:
  tracker-stats-exporter:
    image: ghcr.io/owner/tracker-stats-exporter:latest
    ports:
      - "9100:9100"
    environment:
      - TRACKER_DIGITALCORE_URL=https://digitalcore.club
      - TRACKER_DIGITALCORE_API_KEY=abcdef123456
      - TRACKER_DIGITALCORE_USERNAME=MyUser
      - TRACKER_ONLYENCODES_URL=https://onlyencodes.cc
      - TRACKER_ONLYENCODES_API_KEY=98765zyxw
      - TRACKER_ONLYENCODES_USERNAME=MyUser
    restart: unless-stopped
```

## Prometheus Configuration

Add the exporter target to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'tracker-stats'
    static_configs:
      - targets: ['tracker-stats-exporter:9100']
    scrape_interval: 15m # Recommended to avoid hammering tracker APIs
```

**Note:** The application caches data for 5 minutes. Scrape intervals shorter than 5 minutes will return cached data.

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
   export TRACKER_TEST_USERNAME=...
   npm start
   ```
4. Run tests:
   ```bash
   npm test
   ```

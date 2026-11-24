# Local ports and a shared Postgres

How many products run on one machine at the same time with `docker compose`, without a clash of ports, databases or volumes. The same rules hold in `tl-product-webapp`.

## 1. What each product has of its own

| What | Where it is set | The starter's value |
| --- | --- | --- |
| The compose project name, so its own containers and volumes | `name:` in `docker-compose.yml` | `tl-product-saas` |
| The database `trislab_<slug>` | `POSTGRES_DB` and `DATABASE_URL` in `.env` | `trislab_saas` |
| A port block: the ports on your machine | `WEB_PORT` (the dashboard), `ADMIN_PORT`, `POSTGRES_PORT` and `ASPIRE_PORT` in `.env`; `S3_PUBLIC_ENDPOINT` and `PUBLIC_DASHBOARD_URL` follow `WEB_PORT` | Block 1 |

`init-product` writes all of them from the product's id and port block (`-Slug`, `-PortBlock`), in `.env.example` and `docker-compose.yml`. Copy `.env.example` to `.env` again after it changes.

## 2. The port blocks

Block `n` owns these ports on `127.0.0.1`:

| Port | Block `n` | Block 0 (`tl-product-webapp`) | Block 1 (this starter) |
| --- | --- | --- | --- |
| The web ports: `WEB_PORT` (the dashboard), `ADMIN_PORT` the next one, and the eight after it | `8080 + 10n` to `8089 + 10n` | `8080` | `8090` (dashboard), `8091` (admin) |
| This product's own Postgres (`POSTGRES_PORT`) | `5433 + n` | `5433` | `5434` |
| The Aspire dashboard (`ASPIRE_PORT`) | `18888 + n` | `18888` | `18889` |

Port `5432` is left for a shared Postgres. Blocks 0 and 1 are the starters'; a product takes the next free block, from 2, and its hand-off plan names it. The AppHost ([getting-started.md](getting-started.md#3-run-everything-with-the-apphost)) uses fixed ports, so run one product's AppHost at a time.

## 3. Its own Postgres or a shared one

`COMPOSE_PROFILES` in `.env` chooses:

| `COMPOSE_PROFILES` | Postgres | `DATABASE_URL` |
| --- | --- | --- |
| `own-db` (the default) | This product's own container, with its own volume, on `POSTGRES_PORT` | `postgresql://app:app@postgres:5432/trislab_<slug>` |
| Empty, or without `own-db` | One that already runs on your machine, shared by many products | `postgresql://<user>:<password>@host.docker.internal:5432/trislab_<slug>` |

With a shared Postgres, the migrator creates the product's database when it is missing, through the server's `postgres` database, so the user in `DATABASE_URL` needs the right to create a database (`CREATEDB`). Each product keeps its own database, so products never see each other's data. In a stamp the platform creates the database, and the migrator never does. The storage container and its volume stay the product's own.

## 4. Logs, traces and metrics: the Aspire dashboard

Add `aspire` to the profiles in `.env` and send the telemetry to it:

```sh
COMPOSE_PROFILES=own-db,aspire
OTEL_EXPORTER_OTLP_ENDPOINT=http://aspire-dashboard:18889
```

Then open `http://localhost:<ASPIRE_PORT>`. `api` and `migrator` send their logs, traces and metrics by OTLP; the framework turns the export on when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. The dashboard is bound to `127.0.0.1` and has no sign-in, so it is for your machine only. With `OTEL_EXPORTER_OTLP_ENDPOINT` empty nothing is exported, and the logs are in `docker compose logs`. The AppHost opens its own Aspire dashboard.

# The dashboard image. Stage 1 builds dist/ with npm. Stage 2 is unprivileged nginx
# serving dist/ on port 8080 as a non-root user, and proxying /api to the api
# app and /storage to the stamp's storage service. Both base images are pinned
# by digest; Renovate bumps them from roadmap phase 12 on. The build context
# is clients/dashboard (platform.yaml).

FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# @trislabcompany/framework-ui comes from GitHub Packages (.npmrc). The token is a BuildKit secret, never part of a layer.
RUN --mount=type=secret,id=packages PACKAGES_TOKEN="$(cat /run/secrets/packages)" npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31.7-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e
# Removes what the app never uses, so the image has less to scan and patch:
# curl, and the dynamic modules nginx doesn't load here. Then creates the
# folders docker-entrypoint.sh writes /config.json and the upstreams into,
# owned by the nginx user.
# Upgrades musl and zlib to the Alpine fixes of CVE-2026-107891 and
# CVE-2026-85091 until the base image is rebuilt with them; drop this line
# once Trivy passes without it.
USER root
RUN apk upgrade --no-cache musl musl-utils zlib
RUN apk del --no-network curl nginx-module-geoip nginx-module-image-filter nginx-module-njs nginx-module-xslt     && install -d -o nginx -g nginx /usr/share/nginx/config /etc/nginx/upstream
USER nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/config.json.template /etc/nginx/config.json.template
COPY --chmod=755 docker/docker-entrypoint.sh /docker-entrypoint.d/40-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080

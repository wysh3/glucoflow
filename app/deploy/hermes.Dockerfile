FROM ghcr.io/astral-sh/uv:0.12.13 AS uv

FROM python:3.14.7-slim-bookworm AS build
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_PROJECT_ENVIRONMENT=/opt/hermes/.venv UV_LINK_MODE=copy
WORKDIR /opt/hermes
COPY hermes/unpack_source.py ./
COPY hermes/vendor/manifest.json hermes/vendor/gluco-runtime-source.tar.gz ./vendor/
RUN python unpack_source.py && rm vendor/gluco-runtime-source.tar.gz
WORKDIR /opt/hermes/vendor/hermes-agent
RUN uv sync --frozen --no-dev --no-install-project --compile-bytecode --python /usr/local/bin/python3.14

WORKDIR /opt/hermes
COPY hermes/runtime.py hermes/policy.py ./
# Precompile precisely the imported agent path without credentials or provider calls.
# Isolated request workers may then read bytecode while runtime writes stay disabled.
RUN mkdir -p /tmp/gluco-build-profile \
    && HERMES_HOME=/tmp/gluco-build-profile HERMES_IGNORE_RULES=1 HERMES_CONTAINER=1 \
       HERMES_BUNDLED_PLUGINS=/tmp/gluco-build-profile/disabled-plugins \
       PYTHONPATH=/opt/hermes/vendor/hermes-agent .venv/bin/python runtime.py --check \
    && rm -rf /tmp/gluco-build-profile

FROM python:3.14.7-slim-bookworm
WORKDIR /opt/hermes
ENV PORT=8080 HERMES_BIND_HOST=0.0.0.0 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY --from=build /opt/hermes /opt/hermes
COPY hermes/server.py hermes/runtime.py hermes/policy.py hermes/LICENSE.hermes ./
COPY hermes/skills ./skills
RUN groupadd --gid 10001 gluco \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin gluco
USER gluco:gluco
EXPOSE 8080
CMD ["/opt/hermes/.venv/bin/python", "/opt/hermes/server.py"]

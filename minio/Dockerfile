FROM golang:1.24-bookworm AS build
WORKDIR /src
ARG MINIO_RELEASE=RELEASE.2025-09-07T16-13-09Z
RUN curl --fail --location --retry 3 "https://github.com/minio/minio/archive/refs/tags/${MINIO_RELEASE}.tar.gz" --output /tmp/minio.tar.gz \
    && tar -xzf /tmp/minio.tar.gz --strip-components=1 -C /src \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/minio .

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 minio \
    && useradd --uid 1000 --gid minio --no-create-home minio \
    && mkdir /data \
    && chown minio:minio /data
COPY --from=build /out/minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /usr/share/doc/minio/LICENSE
USER minio
EXPOSE 9000 9001
HEALTHCHECK --interval=5s --timeout=5s --retries=20 CMD ["curl", "--fail", "http://localhost:9000/minio/health/live"]
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]

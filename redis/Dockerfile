FROM redis:8-alpine
COPY redis/redis.conf /usr/local/etc/redis/redis.conf
USER redis:redis
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
    CMD ["redis-cli", "ping"]
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]

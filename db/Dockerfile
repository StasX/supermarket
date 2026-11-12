FROM mongo:9.0.8
HEALTHCHECK --interval=5s --timeout=5s --retries=20 --start-period=30s \
    CMD ["mongosh", "--quiet", "--host", "127.0.0.1", "--eval", "quit(db.adminCommand('ping').ok ? 0 : 1)"]
COPY db/seeds/ /seed/
COPY db/01-import.sh /docker-entrypoint-initdb.d/01-import.sh
# Keep initialization portable when checked out on Windows.
RUN sed -i 's/\r$//' /docker-entrypoint-initdb.d/01-import.sh

USER mongodb:mongodb

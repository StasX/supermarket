# Compatibility with the application's legacy Mongoose 5 driver.
FROM mongo:4.4.29
COPY db/seeds/ /seed/
COPY db/01-import.sh /docker-entrypoint-initdb.d/01-import.sh
# Keep initialization portable when checked out on Windows.
RUN sed -i 's/\r$//' /docker-entrypoint-initdb.d/01-import.sh

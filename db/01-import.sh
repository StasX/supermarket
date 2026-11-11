#!/bin/sh
set -eu

for collection in carts orders products users; do
    mongoimport --host 127.0.0.1 --port 27017 --db shop \
        --collection "$collection" --file "/seed/$collection.json" --stopOnError
done

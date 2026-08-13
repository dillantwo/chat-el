#!/bin/sh
set -eu

if [ -z "${MONGO_APP_USERNAME:-}" ] || [ -z "${MONGO_APP_PASSWORD:-}" ]; then
  echo "MONGO_APP_USERNAME and MONGO_APP_PASSWORD must be set" >&2
  exit 1
fi

mongosh \
  --host 127.0.0.1 \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  "$MONGO_INITDB_DATABASE" <<EOF
db.createUser({
  user: "$MONGO_APP_USERNAME",
  pwd: "$MONGO_APP_PASSWORD",
  roles: [{ role: "readWrite", db: "$MONGO_INITDB_DATABASE" }]
})
EOF
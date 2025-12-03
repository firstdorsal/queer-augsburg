#!/bin/bash
set -e

# Map Bitnami environment variables to standard MongoDB ones
export MONGO_INITDB_ROOT_USERNAME="${MONGODB_ROOT_USER:-root}"
export MONGO_INITDB_ROOT_PASSWORD="${MONGODB_ROOT_PASSWORD}"

# Default values
MONGODB_PORT="${MONGODB_PORT_NUMBER:-27017}"
MONGODB_REPLICA_SET="${MONGODB_REPLICA_SET_NAME:-replicaset}"
MONGODB_REPLICA_KEY="${MONGODB_REPLICA_SET_KEY:-defaultkey}"
MONGODB_HOSTNAME="${MONGODB_ADVERTISED_HOSTNAME:-localhost}"
MONGODB_ADV_PORT="${MONGODB_ADVERTISED_PORT_NUMBER:-$MONGODB_PORT}"

# Data directory (Bitnami compatibility)
DATA_DIR="/bitnami/mongodb/data"

# Create keyfile for replica set authentication
KEYFILE="/bitnami/mongodb/keyfile"
echo "$MONGODB_REPLICA_KEY" > "$KEYFILE"
chmod 600 "$KEYFILE"
chown mongodb:mongodb "$KEYFILE"

# Initialize MongoDB if data directory is empty
if [ -z "$(ls -A $DATA_DIR 2>/dev/null)" ]; then
    echo "Initializing MongoDB data directory..."

    # Start MongoDB temporarily without auth to initialize
    mongod --dbpath "$DATA_DIR" --port "$MONGODB_PORT" --bind_ip_all --fork --logpath /bitnami/mongodb/logs/init.log

    # Wait for MongoDB to be ready
    until mongosh --port "$MONGODB_PORT" --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
        echo "Waiting for MongoDB to start..."
        sleep 1
    done

    # Create root user
    mongosh --port "$MONGODB_PORT" <<EOF
use admin
db.createUser({
    user: "$MONGO_INITDB_ROOT_USERNAME",
    pwd: "$MONGO_INITDB_ROOT_PASSWORD",
    roles: ["root"]
})
EOF

    # Shutdown temporary instance
    mongosh --port "$MONGODB_PORT" admin --eval "db.shutdownServer()"
    sleep 2
fi

# Start MongoDB with replica set configuration
echo "Starting MongoDB with replica set '$MONGODB_REPLICA_SET'..."
mongod \
    --dbpath "$DATA_DIR" \
    --port "$MONGODB_PORT" \
    --bind_ip_all \
    --replSet "$MONGODB_REPLICA_SET" \
    --keyFile "$KEYFILE" \
    --fork \
    --logpath /bitnami/mongodb/logs/mongod.log

# Wait for MongoDB to be ready
until mongosh --port "$MONGODB_PORT" -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    echo "Waiting for MongoDB to be ready..."
    sleep 1
done

# Initialize replica set if not already done
RS_STATUS=$(mongosh --port "$MONGODB_PORT" -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --quiet --eval "try { rs.status().ok } catch(e) { 0 }")

if [ "$RS_STATUS" != "1" ]; then
    echo "Initializing replica set..."
    mongosh --port "$MONGODB_PORT" -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin <<EOF
rs.initiate({
    _id: "$MONGODB_REPLICA_SET",
    members: [{
        _id: 0,
        host: "$MONGODB_HOSTNAME:$MONGODB_ADV_PORT"
    }]
})
EOF

    # Wait for replica set to be ready
    echo "Waiting for replica set to initialize..."
    until mongosh --port "$MONGODB_PORT" -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --quiet --eval "rs.status().myState" 2>/dev/null | grep -q "1"; do
        sleep 1
    done
    echo "Replica set initialized successfully"
fi

echo "MongoDB is ready"

# Keep the container running by tailing the log
exec tail -f /bitnami/mongodb/logs/mongod.log
